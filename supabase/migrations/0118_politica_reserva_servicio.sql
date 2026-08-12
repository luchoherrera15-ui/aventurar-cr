-- ============================================================
-- BOOKEA — Política de reserva por servicio (0118)
--
-- Segunda pieza del módulo CITAS / SERVICIOS (Tanda 1.2 de
-- docs/citas-roadmap.md). La 0117 dijo QUÉ es un servicio (modalidad,
-- cupo). Esta dice CUÁNDO y CON QUÉ PLATA se puede reservar.
--
-- Tres columnas sobre `rancho_items`, todas anulables y sin backfill,
-- y una redefinición de `crear_cita` que las hace cumplir.
--
--   `anticipacion_min_horas`  con cuántas horas de anticipación, como
--                             mínimo. "No me reserven para dentro de
--                             10 minutos." null = sin mínimo.
--
--   `anticipacion_max_dias`   hasta cuántos días hacia adelante se
--                             puede reservar. null = sin tope.
--
--   `deposito_servicio`       el adelanto de ESTE servicio, que pisa
--                             el del negocio (`ranchos.deposito_citas`,
--                             0095). null = se usa el del negocio,
--                             que es exactamente lo de hoy.
--
-- ------------------------------------------------------------
-- POR QUÉ ESTO SÍ TOCA EL RPC (Y POR QUÉ ES SEGURO)
-- ------------------------------------------------------------
-- La 0117 solo declaraba: ningún motor la leía. Esta hace cumplir, y
-- eso obliga a meterse en `crear_cita`. No hay alternativa: la app
-- móvil NO tiene servidor propio y llama al RPC directo
-- (mobile/src/app/citas/[id]/reservar.tsx). Validar solo en la acción
-- de servidor de la web dejaría la política abierta desde la app.
--
-- Lo que NO cambia, que es la parte importante:
--
--   · La FIRMA es idéntica, byte por byte: mismos 8 parámetros, mismos
--     tipos, mismo orden, mismo `returns uuid`. Es contrato con la app
--     ya instalada en los teléfonos y no se toca (arquitectura §6).
--     Esta es la quinta vez que el cuerpo se reemplaza sin mover la
--     firma: 0055 → 0081 → 0095 → 0109 → acá.
--
--   · No se agrega ninguna sobrecarga. `create or replace` reemplaza
--     LA MISMA función; si la firma cambiara, Postgres crearía una
--     segunda y las llamadas quedarían ambiguas.
--
--   · El resto del cuerpo se reproduce sin cambios: el bloqueo
--     consultivo, la resolución del profesional, los buffers, los
--     bloqueos, el insert. Lo único agregado son los dos chequeos de
--     anticipación y el coalesce del depósito.
--
-- ------------------------------------------------------------
-- NULL = COMO HOY, OTRA VEZ
-- ------------------------------------------------------------
-- Las tres columnas nacen en null y NADA cambia de comportamiento
-- mientras sigan así:
--
--   · anticipacion_min_horas null → no se evalúa el chequeo. La única
--     restricción sigue siendo la que ya existía: no reservar en el
--     pasado.
--   · anticipacion_max_dias null → no se evalúa. El horizonte sigue
--     siendo el `DIAS_VISIBLES = 28` del cliente, que es cosmético.
--   · deposito_servicio null → `coalesce` cae en `deposito_citas` del
--     negocio, que es literalmente la línea que había antes.
--
-- Y los negocios de Eventos ni se enteran: `crear_cita` ya filtraba
-- `vertical = 'citas'` desde la 0055, así que ni siquiera entra.
--
-- ------------------------------------------------------------
-- LO QUE ESTA MIGRACIÓN NO TRAE, A PROPÓSITO
-- ------------------------------------------------------------
-- La Tanda 1.2 del roadmap también listaba "plazo de cancelación",
-- "permite cancelar" y "permite reprogramar". NO están acá, y no es
-- un olvido:
--
-- HOY NO EXISTE NINGÚN FLUJO DONDE EL CLIENTE CANCELE SU CITA. Los
-- únicos caminos de cancelación son el panel del dueño
-- (`cancelarCita` en mi-negocio/[id]/citas/actions.ts), el de admin y
-- el de Eventos — y una política de cancelación no debe limitar al
-- dueño, que siempre tiene que poder cancelar.
--
-- Guardar `cancelacion_horas` ahora sería una columna que no gobierna
-- nada y que dentro de tres meses nadie sabría si está conectada. Se
-- reprograma a la Tanda 4.3, donde se construye el flujo de
-- cancelación del cliente junto con sus reglas de plata (reembolso,
-- crédito, penalización), que es donde el conjunto tiene sentido.
--
-- El precio y el depósito los sigue poniendo LA BASE, nunca el
-- cliente: el RPC los lee de `rancho_items`/`ranchos` y jamás los
-- recibe por parámetro.
-- ============================================================

-- 1) Las columnas ---------------------------------------------------
alter table rancho_items add column if not exists anticipacion_min_horas integer;
alter table rancho_items add column if not exists anticipacion_max_dias integer;
alter table rancho_items add column if not exists deposito_servicio numeric;

alter table rancho_items drop constraint if exists rancho_items_anticipacion_check;
alter table rancho_items add constraint rancho_items_anticipacion_check
  check (
    (anticipacion_min_horas is null or anticipacion_min_horas between 0 and 720)
    and (anticipacion_max_dias is null or anticipacion_max_dias between 1 and 365)
  );

-- Mismo rango que ranchos_deposito_citas_check (0095), para que el
-- adelanto del servicio no pueda ser algo que el del negocio no podría.
alter table rancho_items drop constraint if exists rancho_items_deposito_servicio_check;
alter table rancho_items add constraint rancho_items_deposito_servicio_check
  check (
    deposito_servicio is null
    or (deposito_servicio >= 0 and deposito_servicio <= 10000000)
  );

comment on column rancho_items.anticipacion_min_horas is
  'Horas mínimas de anticipación para reservar este servicio (0118). '
  'null = sin mínimo. Lo hace cumplir crear_cita. Se mide en horas: '
  'para media hora de margen no hay granularidad, se usa 0 o 1.';

comment on column rancho_items.anticipacion_max_dias is
  'Días máximos hacia adelante que se puede reservar (0118). null = '
  'sin tope. Lo hace cumplir crear_cita. El DIAS_VISIBLES=28 del '
  'cliente es cosmético y no sustituye a esto.';

comment on column rancho_items.deposito_servicio is
  'Adelanto de ESTE servicio, en colones (0118). Pisa a '
  'ranchos.deposito_citas (0095). null = se usa el del negocio. Lo '
  'resuelve crear_cita: el monto nunca llega por parámetro.';

-- 2) El motor, con la política adentro ------------------------------
-- Cuerpo reproducido de la 0109 con TRES cambios, marcados abajo con
-- "-- 0118". Todo lo demás es idéntico.
create or replace function public.crear_cita(
  p_rancho_id uuid,
  p_item_id uuid,
  p_fecha date,
  p_hora time,
  p_miembro_id uuid,   -- null = cualquier profesional
  p_nombre text,
  p_telefono text,
  p_notas text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho record;
  v_item record;
  v_correo text;
  v_zona text;
  v_dur integer;
  v_buffer integer;
  v_horario jsonb;
  v_restringido boolean;
  v_miembro uuid;
  v_miembro_nombre text;
  v_reserva_id uuid;
  v_hay_equipo boolean;
  v_deposito numeric;
  v_ahora timestamp;   -- 0118: reloj local del negocio
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para reservar tu cita.';
  end if;

  if p_fecha is null or p_hora is null then
    raise exception 'Elegí la fecha y la hora de tu cita.';
  end if;

  select id, nombre, owner_id, detalles, vertical, estado, zona_horaria, deposito_citas
    into v_rancho
  from ranchos
  where id = p_rancho_id and estado = 'aprobado' and vertical = 'citas';

  if v_rancho.id is null then
    raise exception 'Este negocio no está disponible para citas.';
  end if;

  v_zona := coalesce(v_rancho.zona_horaria, 'America/Costa_Rica');
  v_ahora := now() at time zone v_zona;

  if p_fecha < v_ahora::date then
    raise exception 'Esa fecha ya pasó — elegí una fecha futura.';
  end if;

  if p_fecha = v_ahora::date and p_hora < v_ahora::time then
    raise exception 'Esa hora ya pasó — elegí una más tarde.';
  end if;

  -- 0118: se leen también las tres columnas de política.
  select id, nombre, precio, duracion_minutos, buffer_min, activo,
         anticipacion_min_horas, anticipacion_max_dias, deposito_servicio
    into v_item
  from rancho_items
  where id = p_item_id and rancho_id = p_rancho_id;

  if v_item.id is null or not v_item.activo then
    raise exception 'Ese servicio ya no está disponible.';
  end if;

  -- 0118: la política de anticipación. Las dos son anulables y solo
  -- se evalúan si el dueño las configuró: en null, nada cambia.
  if v_item.anticipacion_min_horas is not null
     and (p_fecha + p_hora)
         < v_ahora + make_interval(hours => v_item.anticipacion_min_horas) then
    raise exception
      'Este servicio se reserva con al menos % hora(s) de anticipación.',
      v_item.anticipacion_min_horas;
  end if;

  if v_item.anticipacion_max_dias is not null
     and p_fecha > v_ahora::date + v_item.anticipacion_max_dias then
    raise exception
      'Este servicio se puede reservar hasta % día(s) hacia adelante.',
      v_item.anticipacion_max_dias;
  end if;

  -- 0118: el adelanto del servicio pisa el del negocio. Con ambos en
  -- null da 0, que es lo que daba la línea original.
  v_deposito := coalesce(v_item.deposito_servicio, v_rancho.deposito_citas, 0);

  v_dur := coalesce(v_item.duracion_minutos, 30);
  v_buffer := coalesce(v_item.buffer_min, 0);
  v_horario := v_rancho.detalles -> 'horario_citas';

  v_restringido := exists (
    select 1 from servicios_recurso sr where sr.item_id = p_item_id
  );

  perform pg_advisory_xact_lock(
    hashtext(p_rancho_id::text || ':' || p_fecha::text)
  );

  select exists (
    select 1 from equipo_rancho e
    where e.rancho_id = p_rancho_id and e.activo
  ) into v_hay_equipo;

  if p_miembro_id is not null then
    select e.id, e.nombre into v_miembro, v_miembro_nombre
    from equipo_rancho e
    where e.id = p_miembro_id and e.rancho_id = p_rancho_id and e.activo;

    if v_miembro is null then
      raise exception 'Esa persona ya no atiende en este negocio.';
    end if;

    if v_restringido and not exists (
      select 1 from servicios_recurso sr
      where sr.item_id = p_item_id and sr.miembro_id = v_miembro
    ) then
      raise exception 'Esa persona no da este servicio — elegí otra.';
    end if;

    if not recurso_trabaja_franja(v_miembro, v_horario, p_fecha, p_hora, v_dur) then
      raise exception 'Esa hora está fuera del horario de atención.';
    end if;

    if franja_bloqueada(p_rancho_id, v_miembro, v_zona, p_fecha, p_hora, v_dur) then
      raise exception using errcode = '23505',
        message = 'Esa hora no está disponible — elegí otro espacio.';
    end if;

    if franja_llena(p_rancho_id, v_miembro, p_fecha, p_hora, v_dur + v_buffer) then
      raise exception using errcode = '23505',
        message = 'Esa hora ya está tomada con esa persona — elegí otra.';
    end if;
  elsif v_hay_equipo then
    select e.id, e.nombre into v_miembro, v_miembro_nombre
    from equipo_rancho e
    where e.rancho_id = p_rancho_id
      and e.activo
      and (not v_restringido or exists (
        select 1 from servicios_recurso sr
        where sr.item_id = p_item_id and sr.miembro_id = e.id
      ))
      and recurso_trabaja_franja(e.id, v_horario, p_fecha, p_hora, v_dur)
      and not franja_bloqueada(p_rancho_id, e.id, v_zona, p_fecha, p_hora, v_dur)
      and not franja_llena(p_rancho_id, e.id, p_fecha, p_hora, v_dur + v_buffer)
    order by e.orden, e.created_at
    limit 1;

    if v_miembro is null then
      raise exception using errcode = '23505',
        message = 'Esa hora ya se llenó — elegí otro espacio.';
    end if;
  else
    if not recurso_trabaja_franja(null, v_horario, p_fecha, p_hora, v_dur) then
      raise exception 'Esa hora está fuera del horario de atención.';
    end if;

    if franja_bloqueada(p_rancho_id, null, v_zona, p_fecha, p_hora, v_dur) then
      raise exception using errcode = '23505',
        message = 'Esa hora no está disponible — elegí otro espacio.';
    end if;

    if franja_llena(p_rancho_id, null, p_fecha, p_hora, v_dur + v_buffer) then
      raise exception using errcode = '23505',
        message = 'Esa hora ya está reservada — elegí otro espacio.';
    end if;
  end if;

  select email into v_correo from auth.users where id = auth.uid();

  insert into reservas (
    rancho_id, cliente_id, fecha, hora_inicio, duracion_minutos, miembro_id,
    nombre, contacto, correo, whatsapp, tipo_evento, estado,
    monto_total, deposito_monto, notas, origen, detalle_pedido, tipo_reserva
  ) values (
    p_rancho_id, auth.uid(), p_fecha, p_hora, v_dur, v_miembro,
    coalesce(nullif(trim(p_nombre), ''), v_correo),
    coalesce(nullif(trim(p_telefono), ''), v_correo),
    v_correo, nullif(trim(p_telefono), ''),
    v_item.nombre, 'confirmada',
    v_item.precio, v_deposito, nullif(trim(p_notas), ''), 'web',
    jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id,
      'nombre', v_item.nombre,
      'precio', v_item.precio,
      'duracion_minutos', v_dur,
      'miembro', v_miembro_nombre
    )),
    'cita'
  )
  returning id into v_reserva_id;

  insert into reserva_items (
    reserva_id, item_id, nombre, precio_unitario, unidad, duracion_horas, cantidad
  ) values (
    v_reserva_id, v_item.id, v_item.nombre, v_item.precio, 'cita',
    round(v_dur / 60.0, 2), 1
  );

  return v_reserva_id;
end;
$$;

grant execute on function public.crear_cita(
  uuid, uuid, date, time, uuid, text, text, text
) to authenticated;
