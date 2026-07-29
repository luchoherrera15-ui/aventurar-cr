-- ------------------------------------------------------------
-- Reservar un servicio (photobooth, catering, barra...) en una sola
-- operación: la reserva y las líneas de su pedido nacen juntas, con
-- los cupos comprobados adentro de la misma transacción.
--
-- Es una función security definer por la misma razón que
-- completar_reserva_temporal (0026): el flujo público es justo donde
-- las políticas de RLS son más delicadas, y acá además hay que
-- escribir en dos tablas sin que quede una a medias.
--
-- Los precios NUNCA vienen del navegador: cada línea se relee de
-- rancho_items acá adentro. Lo único que manda el cliente es qué
-- ítems y cuántos.
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

create or replace function public.crear_reserva_servicio(
  p_rancho_id uuid,
  p_fecha date,
  p_pedido jsonb,              -- [{"item_id": "…", "cantidad": 2}, …]
  p_tipo_evento text,
  p_invitados integer,
  p_notas text,
  p_nombre text,
  p_correo text,
  p_whatsapp text,
  p_total_servicio numeric,    -- la parte cotizada por hora/persona/día
  p_metodo_pago text,
  p_deposito_comprobante_url text,
  p_terminos_aceptados boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho record;
  v_cupo integer;
  v_usadas integer;
  v_reserva_id uuid;
  v_linea record;
  v_item record;
  v_cantidad integer;
  v_tomadas integer;
  v_total_pedido numeric := 0;
  v_hay_precio boolean := false;
  v_hay_lineas boolean := false;
  v_detalle jsonb := '[]'::jsonb;
  v_deposito numeric;
begin
  if p_fecha < (now() at time zone 'America/Costa_Rica')::date then
    raise exception 'Esa fecha ya pasó — elegí una fecha futura.';
  end if;

  select id, categoria, eventos_por_dia, deposito_reserva
    into v_rancho
  from ranchos
  where id = p_rancho_id and estado = 'aprobado';

  if v_rancho.id is null then
    raise exception 'Esta publicación no está disponible para reservar.';
  end if;

  -- Mismo candado que el disparador del cupo (0049): serializa todas
  -- las reservas de este negocio para esta fecha, así dos clientes al
  -- mismo tiempo no pasan los dos por el mismo último espacio.
  perform pg_advisory_xact_lock(
    hashtext(p_rancho_id::text || ':' || p_fecha::text)
  );

  -- Cupo de eventos del día (pendientes cuentan: ya están en fila).
  v_cupo := coalesce(
    v_rancho.eventos_por_dia,
    case when v_rancho.categoria = 'lugares' then 1 else null end
  );
  if v_cupo is not null then
    select count(*) into v_usadas
    from reservas
    where rancho_id = p_rancho_id
      and fecha = p_fecha
      and estado in ('pendiente', 'confirmada');
    if v_usadas >= v_cupo then
      raise exception 'Ese día ya no tiene campo con este proveedor. Elegí otra fecha.';
    end if;
  end if;

  v_deposito := coalesce(v_rancho.deposito_reserva, 0);

  insert into reservas (
    rancho_id, cliente_id, fecha, tipo_evento, invitados, nombre,
    correo, whatsapp, notas, estado, origen,
    terminos_aceptados,
    deposito_monto, metodo_pago, deposito_comprobante_url
  ) values (
    p_rancho_id,
    auth.uid(),                       -- null si algún día reserva un anónimo
    p_fecha,
    nullif(trim(coalesce(p_tipo_evento, '')), ''),
    case when p_invitados > 0 then p_invitados else null end,
    nullif(trim(coalesce(p_nombre, '')), ''),
    nullif(trim(coalesce(p_correo, '')), ''),
    nullif(trim(coalesce(p_whatsapp, '')), ''),
    nullif(trim(coalesce(p_notas, '')), ''),
    'pendiente',
    'web',
    coalesce(p_terminos_aceptados, false),
    case when v_deposito > 0 then v_deposito else null end,
    case when p_metodo_pago in ('sinpe', 'transferencia') then p_metodo_pago else null end,
    nullif(trim(coalesce(p_deposito_comprobante_url, '')), '')
  )
  returning id into v_reserva_id;

  -- Cada línea del pedido: se relee el ítem de la base (precio real,
  -- nombre real), se aplican los mínimos y máximos del proveedor, y se
  -- comprueba el inventario del día ANTES de escribir.
  for v_linea in
    select (e->>'item_id')::uuid as item_id,
           (e->>'cantidad')::int as cantidad
    from jsonb_array_elements(coalesce(p_pedido, '[]'::jsonb)) e
    where (e->>'cantidad') ~ '^[0-9]+$'
      and (e->>'item_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  loop
    v_cantidad := v_linea.cantidad;
    if v_cantidad < 1 or v_cantidad > 999 then
      continue;
    end if;

    select id, nombre, precio, unidad, duracion_horas,
           min_por_reserva, max_por_reserva, capacidad_dia
      into v_item
    from rancho_items
    where id = v_linea.item_id
      and rancho_id = p_rancho_id
      and activo = true;

    if v_item.id is null then
      continue;  -- ítem borrado o pausado entre que se cargó la página y se reservó
    end if;

    if v_cantidad < v_item.min_por_reserva then
      raise exception '"%" se pide con un mínimo de % por reserva.',
        v_item.nombre, v_item.min_por_reserva;
    end if;
    if v_item.max_por_reserva is not null and v_cantidad > v_item.max_por_reserva then
      raise exception '"%" admite hasta % por reserva.',
        v_item.nombre, v_item.max_por_reserva;
    end if;

    if v_item.capacidad_dia is not null then
      select coalesce(sum(ri.cantidad), 0) into v_tomadas
      from reserva_items ri
      join reservas r on r.id = ri.reserva_id
      where ri.item_id = v_item.id
        and r.fecha = p_fecha
        and r.id <> v_reserva_id
        and (r.estado in ('pendiente', 'confirmada')
          or (r.estado = 'temporal' and r.expira_en > now()));
      if v_tomadas + v_cantidad > v_item.capacidad_dia then
        raise exception 'Ya no queda disponibilidad de "%" para esa fecha.',
          v_item.nombre;
      end if;
    end if;

    insert into reserva_items (
      reserva_id, item_id, nombre, precio_unitario, unidad,
      duracion_horas, cantidad
    ) values (
      v_reserva_id, v_item.id, v_item.nombre, v_item.precio, v_item.unidad,
      v_item.duracion_horas, v_cantidad
    );

    v_hay_lineas := true;
    if v_item.precio is not null then
      v_total_pedido := v_total_pedido + v_item.precio * v_cantidad;
      v_hay_precio := true;
    end if;

    -- El mismo snapshot de siempre, para el chat y las reservas viejas.
    v_detalle := v_detalle || jsonb_build_object(
      'item_id', v_item.id,
      'nombre', v_item.nombre,
      'precio', v_item.precio,
      'unidad', v_item.unidad,
      'cantidad', v_cantidad
    );
  end loop;

  update reservas
  set detalle_pedido = case
        when v_hay_lineas then jsonb_build_object(
          'items', v_detalle,
          'total_estimado', case when v_hay_precio then v_total_pedido else null end
        )
        else null
      end,
      monto_total = case
        when coalesce(p_total_servicio, 0) > 0 or v_hay_precio
          then coalesce(p_total_servicio, 0) + v_total_pedido
        else null
      end
  where id = v_reserva_id;

  return v_reserva_id;
end;
$$;

grant execute on function public.crear_reserva_servicio(
  uuid, date, jsonb, text, integer, text, text, text, text,
  numeric, text, text, boolean
) to anon, authenticated;

notify pgrst, 'reload schema';
