-- ------------------------------------------------------------
-- Servicios "pro": las 5 brechas del análisis por categoría
-- (docs/analisis-categorias-eventos.md).
--
--  1. HORA DEL EVENTO — reservas.hora_inicio + duracion_horas: el DJ,
--     el photobooth y la barra saben A QUÉ HORA es cada evento, y el
--     RPC rechaza dos eventos montados en la misma franja cuando el
--     proveedor limita sus eventos_por_dia.
--  2. PAQUETE BASE — rancho_items.es_paquete_base: un ítem `paquete`
--     puede SUSTITUIR la tarifa_evento/tarifa_paquete del cotizador
--     (montaje básico/medio/premium sin doble cobro). El precio del
--     paquete viaja por el pedido; el cotizador del cliente deja de
--     sumar la tarifa base (eso es código, acá solo vive la bandera).
--  3. MENÚ CON ELECCIÓN DE N — config por grupo en el jsonb
--     ranchos.detalles.elecciones_incluidas ({"Postres": 1, ...});
--     no necesita columna. Las elecciones del cliente van en notas.
--  4. MULTI-DÍA — reservas.fecha_fin: un alquiler de viernes a domingo
--     bloquea inventario y cupo TODO el rango (vistas + RPC).
--  5. MÍNIMOS — ranchos.monto_minimo (0018) y detalles.minimo_pedido
--     por fin se hacen cumplir dentro de crear_reserva_servicio.
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 1 y 4. Columnas nuevas de reservas (todas opcionales: las reservas
-- viejas y las de Lugares siguen igual, con estos campos en null).
-- ------------------------------------------------------------

alter table reservas add column if not exists hora_inicio time;
alter table reservas add column if not exists duracion_horas numeric;
alter table reservas add column if not exists fecha_fin date;

comment on column reservas.hora_inicio is
  'A qué hora empieza el evento (servicios). null = no se indicó.';
comment on column reservas.duracion_horas is
  'Horas contratadas del servicio (paquete + extras, u horas por hora).';
comment on column reservas.fecha_fin is
  'Último día de un alquiler multi-día. null = evento de un solo día.';

alter table reservas drop constraint if exists reservas_duracion_horas_check;
alter table reservas add constraint reservas_duracion_horas_check
  check (duracion_horas is null or (duracion_horas > 0 and duracion_horas <= 240));

alter table reservas drop constraint if exists reservas_fecha_fin_check;
alter table reservas add constraint reservas_fecha_fin_check
  check (fecha_fin is null or fecha_fin >= fecha);

-- ------------------------------------------------------------
-- 2. El paquete que sustituye la tarifa base del cotizador.
-- ------------------------------------------------------------

alter table rancho_items add column if not exists es_paquete_base boolean not null default false;

comment on column rancho_items.es_paquete_base is
  'true = al elegirlo, su precio SUSTITUYE la tarifa_evento/tarifa_paquete del cotizador (no se suman) y sus duracion_horas mandan para la hora extra.';

-- ------------------------------------------------------------
-- 4. Las vistas de disponibilidad aprenden a contar rangos: una
-- reserva con fecha_fin pinta ocupado (y descuenta inventario) en
-- CADA día del rango, no solo el primero. Mismas columnas y tipos
-- que antes — para reservas de un solo día no cambia nada.
-- ------------------------------------------------------------

create or replace view disponibilidad_rancho as
  select d.dia::date as fecha, r.estado, r.rancho_id
  from reservas r
  cross join lateral generate_series(
    r.fecha, coalesce(r.fecha_fin, r.fecha), interval '1 day'
  ) as d(dia)
  where r.estado in ('pendiente', 'confirmada')
     or (r.estado = 'temporal' and r.expira_en > now());

grant select on disponibilidad_rancho to anon, authenticated;

create or replace view disponibilidad_items as
  select ri.item_id,
         r.rancho_id,
         d.dia::date as fecha,
         sum(ri.cantidad)::int as reservadas
  from reserva_items ri
  join reservas r on r.id = ri.reserva_id
  cross join lateral generate_series(
    r.fecha, coalesce(r.fecha_fin, r.fecha), interval '1 day'
  ) as d(dia)
  where ri.item_id is not null
    and (
      r.estado in ('pendiente', 'confirmada')
      or (r.estado = 'temporal' and r.expira_en > now())
    )
  group by ri.item_id, r.rancho_id, d.dia;

grant select on disponibilidad_items to anon, authenticated;

-- ------------------------------------------------------------
-- El RPC de reserva de servicios, ahora con hora, duración y rango.
--
-- Se borra la firma vieja (13 argumentos) antes de crear la nueva:
-- los 3 parámetros nuevos tienen default, así que si conviven las dos
-- firmas, PostgREST no sabría cuál elegir para las llamadas viejas.
-- Las apps que todavía llamen con 13 argumentos siguen funcionando.
-- ------------------------------------------------------------

drop function if exists public.crear_reserva_servicio(
  uuid, date, jsonb, text, integer, text, text, text, text,
  numeric, text, text, boolean
);

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
  p_terminos_aceptados boolean,
  p_hora_inicio time default null,       -- a qué hora empieza el evento
  p_duracion_horas numeric default null, -- horas contratadas (para el choque)
  p_fecha_fin date default null          -- último día de un alquiler multi-día
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
  v_unidades integer := 0;
  v_hay_precio boolean := false;
  v_hay_lineas boolean := false;
  v_detalle jsonb := '[]'::jsonb;
  v_deposito numeric;
  v_fecha_fin date;
  v_dia date;
  v_ini_min integer;
  v_fin_min integer;
  v_choques integer;
  v_minimo numeric;
  v_min_pedido numeric;
  v_total numeric;
begin
  if p_fecha < (now() at time zone 'America/Costa_Rica')::date then
    raise exception 'Esa fecha ya pasó — elegí una fecha futura.';
  end if;

  -- El rango del alquiler: igual a la fecha si no es multi-día.
  if p_fecha_fin is not null and p_fecha_fin < p_fecha then
    raise exception 'El día final del alquiler no puede ser antes del inicial.';
  end if;
  if p_fecha_fin is not null and p_fecha_fin - p_fecha > 60 then
    raise exception 'Un alquiler puede abarcar como máximo 60 días.';
  end if;
  v_fecha_fin := coalesce(p_fecha_fin, p_fecha);

  if p_duracion_horas is not null
     and (p_duracion_horas <= 0 or p_duracion_horas > 240) then
    raise exception 'La duración del servicio no es válida.';
  end if;

  select id, categoria, eventos_por_dia, deposito_reserva, monto_minimo, detalles
    into v_rancho
  from ranchos
  where id = p_rancho_id and estado = 'aprobado';

  if v_rancho.id is null then
    raise exception 'Esta publicación no está disponible para reservar.';
  end if;

  -- Mismo candado que el disparador del cupo (0049), ahora por CADA
  -- día del rango (en orden, para no cruzarse entre transacciones):
  -- dos clientes al mismo tiempo no pasan por el mismo último espacio.
  for v_dia in
    select generate_series(p_fecha, v_fecha_fin, interval '1 day')::date
  loop
    perform pg_advisory_xact_lock(
      hashtext(p_rancho_id::text || ':' || v_dia::text)
    );
  end loop;

  -- Cupo de eventos del día (pendientes cuentan: ya están en fila).
  -- Con rango se cuentan las reservas que TOCAN el rango — un pelín
  -- conservador para alquileres largos, pero nunca sobrevende.
  v_cupo := coalesce(
    v_rancho.eventos_por_dia,
    case when v_rancho.categoria = 'lugares' then 1 else null end
  );
  if v_cupo is not null then
    select count(*) into v_usadas
    from reservas
    where rancho_id = p_rancho_id
      and fecha <= v_fecha_fin
      and coalesce(fecha_fin, fecha) >= p_fecha
      and estado in ('pendiente', 'confirmada');
    if v_usadas >= v_cupo then
      raise exception 'Ese día ya no tiene campo con este proveedor. Elegí otra fecha.';
    end if;
  end if;

  -- Choque de franja: si el proveedor limita su agenda (eventos_por_dia)
  -- y el cliente dijo a qué hora empieza, no puede montarse encima de
  -- otra reserva con hora. Un proveedor que sí atiende varios eventos
  -- en paralelo deja eventos_por_dia sin tope y esto no lo frena.
  -- Sin duración conocida se asume 1 hora (mínimo 30 min de bloque).
  if v_cupo is not null and p_hora_inicio is not null then
    v_ini_min := extract(hour from p_hora_inicio)::int * 60
               + extract(minute from p_hora_inicio)::int;
    v_fin_min := v_ini_min
               + greatest(round(coalesce(p_duracion_horas, 1) * 60)::int, 30);
    select count(*) into v_choques
    from reservas r
    where r.rancho_id = p_rancho_id
      and r.estado in ('pendiente', 'confirmada')
      and r.hora_inicio is not null
      and r.fecha <= v_fecha_fin
      and coalesce(r.fecha_fin, r.fecha) >= p_fecha
      and (extract(hour from r.hora_inicio)::int * 60
         + extract(minute from r.hora_inicio)::int) < v_fin_min
      and (extract(hour from r.hora_inicio)::int * 60
         + extract(minute from r.hora_inicio)::int
         + greatest(round(coalesce(r.duracion_horas, 1) * 60)::int, 30)) > v_ini_min;
    if v_choques > 0 then
      raise exception 'Ese horario ya está tomado para esa fecha — elegí otra hora u otra fecha.';
    end if;
  end if;

  v_deposito := coalesce(v_rancho.deposito_reserva, 0);

  insert into reservas (
    rancho_id, cliente_id, fecha, tipo_evento, invitados, nombre,
    correo, whatsapp, notas, estado, origen,
    terminos_aceptados,
    deposito_monto, metodo_pago, deposito_comprobante_url,
    hora_inicio, duracion_horas, fecha_fin
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
    nullif(trim(coalesce(p_deposito_comprobante_url, '')), ''),
    p_hora_inicio,
    p_duracion_horas,
    case when v_fecha_fin > p_fecha then v_fecha_fin else null end
  )
  returning id into v_reserva_id;

  -- Cada línea del pedido: se relee el ítem de la base (precio real,
  -- nombre real), se aplican los mínimos y máximos del proveedor, y se
  -- comprueba el inventario — ahora del PEOR día del rango — ANTES de
  -- escribir.
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

    -- Inventario por fecha: el máximo tomado en CUALQUIER día del
    -- rango pedido (con un solo día es el mismo conteo de siempre).
    if v_item.capacidad_dia is not null then
      select coalesce(max(t.suma), 0) into v_tomadas
      from (
        select d.dia, sum(ri.cantidad) as suma
        from reserva_items ri
        join reservas r on r.id = ri.reserva_id
        cross join lateral generate_series(
          greatest(r.fecha, p_fecha),
          least(coalesce(r.fecha_fin, r.fecha), v_fecha_fin),
          interval '1 day'
        ) as d(dia)
        where ri.item_id = v_item.id
          and r.id <> v_reserva_id
          and r.fecha <= v_fecha_fin
          and coalesce(r.fecha_fin, r.fecha) >= p_fecha
          and (r.estado in ('pendiente', 'confirmada')
            or (r.estado = 'temporal' and r.expira_en > now()))
        group by d.dia
      ) t;
      if v_tomadas + v_cantidad > v_item.capacidad_dia then
        raise exception 'Ya no queda disponibilidad de "%" para esas fechas.',
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
    v_unidades := v_unidades + v_cantidad;
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

  -- 5a. Monto mínimo del negocio (columna de 0018 que el flujo de
  -- servicios ignoraba). Solo aplica cuando el pedido tiene precios:
  -- un pedido 100 % "a cotizar" no se puede medir contra el mínimo.
  v_total := coalesce(p_total_servicio, 0) + v_total_pedido;
  v_minimo := v_rancho.monto_minimo;
  if v_minimo is not null and v_minimo > 0
     and (v_hay_precio or coalesce(p_total_servicio, 0) > 0)
     and v_total < v_minimo then
    raise exception 'Este negocio toma pedidos desde ₡%. Tu pedido va en ₡% — agregá algo más para poder reservar.',
      trim(to_char(v_minimo, 'FM999G999G999G999')),
      trim(to_char(v_total, 'FM999G999G999G999'));
  end if;

  -- 5b. Pedido mínimo en unidades (detalles.minimo_pedido) — para
  -- invitaciones, promocionales y alquileres. Solo si hay líneas.
  if v_hay_lineas then
    v_min_pedido := case
      when (v_rancho.detalles->>'minimo_pedido') ~ '^[0-9]+(\.[0-9]+)?$'
        then (v_rancho.detalles->>'minimo_pedido')::numeric
      else null
    end;
    if v_min_pedido is not null and v_min_pedido > 0 and v_unidades < v_min_pedido then
      raise exception 'Este negocio despacha pedidos desde % unidades y tu pedido lleva %.',
        trim(to_char(v_min_pedido, 'FM999999')), v_unidades;
    end if;
  end if;

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
  numeric, text, text, boolean, time, numeric, date
) to anon, authenticated;

notify pgrst, 'reload schema';
