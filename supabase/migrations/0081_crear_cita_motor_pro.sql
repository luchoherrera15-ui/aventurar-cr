-- ============================================================
-- BOOKEA — crear_cita aprende TODO lo de la 0061 (hallazgo C-1
-- de AUDITORIA.md)
--
-- La 0061 trajo horario propio por recurso, bloqueos de agenda,
-- buffer de limpieza por servicio y la asignación servicio↔recurso —
-- pero el RPC crear_cita (0055) nunca los aprendió: cualquier persona
-- con sesión podía llamarlo directo y reservar en las vacaciones del
-- profesional, fuera de su horario propio, montada sobre el buffer de
-- la cita anterior o con alguien que no da ese servicio. La UI no
-- ofrecía esas horas, pero el servidor las aceptaba: validación que
-- solo vivía en el navegador.
--
-- Este RPC replica la semántica EXACTA del motor puro del código
-- (src/lib/agenda/disponibilidad.ts) — si cambiás una regla acá,
-- cambiala también allá:
--
--   1. HORARIO CON HERENCIA — si el recurso tiene filas en
--      horarios_recurso para ese día de la semana, esos rangos MANDAN
--      (sustituyen al horario del negocio, no se suman); sin filas ese
--      día, rige ranchos.detalles.horario_citas. La ATENCIÓN
--      (duración, sin buffer) debe caber completa en un rango.
--   2. BUFFER — la cita ocupa duración + buffer de su servicio, y las
--      citas existentes ocupan lo suyo + SU buffer. El buffer puede
--      correr después del cierre (es limpieza, no atención), pero
--      nunca encima de otra cita.
--   3. BLOQUEOS — la franja de atención no puede tocar un bloqueo del
--      negocio entero (miembro_id null) ni del recurso elegido. Los
--      bloqueos son timestamptz; se comparan contra el instante de la
--      cita en la zona del negocio (ranchos.zona_horaria).
--   4. SERVICIO↔RECURSO — si el servicio tiene filas en
--      servicios_recurso, solo esos recursos lo dan; sin filas, lo
--      dan todos (compatibilidad 0061).
--   5. "CUALQUIERA" — se asigna la primera persona activa que dé el
--      servicio, trabaje ese día a esa hora, no esté bloqueada y no
--      tenga choque (con buffers). Antes bastaba con "no tener otra
--      cita encima".
--
-- El disparador reservas_respeta_cupo_dia (0055/0061) queda IGUAL a
-- propósito: es la red de seguridad contra el choque duro (dos citas
-- montadas), y los caminos del dueño — reserva manual, importador
-- 0077, sync 0072 — deben poder saltarse horarios, bloqueos y buffers
-- (el dueño manda en su agenda); lo que jamás pueden es duplicar una
-- franja. Las carreras entre dos clientes las serializa el mismo
-- pg_advisory_xact_lock de siempre.
--
-- También: la vista disponibilidad_citas gana la columna
-- buffer_minutos (al FINAL, para no romper a nadie) — el navegador la
-- necesita para pintar la ocupación real de cada cita, siempre sin
-- datos personales.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La vista pública, ahora con el buffer de cada cita.
--    (create or replace solo permite AGREGAR columnas al final —
--    exactamente lo que hacemos.)
--
--    OJO con el `estado in`: la 0072 sumó 'bloqueada' a propósito —
--    los compromisos que llegan del calendario externo del dueño se
--    guardan como reservas 'bloqueada' (origen 'sync') y TIENEN que
--    tapar su franja. Quitarlo deja que un cliente reserve encima de
--    la cita médica del dueño.
-- ------------------------------------------------------------
create or replace view disponibilidad_citas as
select
  r.rancho_id,
  r.fecha,
  r.hora_inicio,
  r.duracion_minutos,
  r.miembro_id,
  coalesce((
    select max(i.buffer_min)
    from reserva_items ri
    join rancho_items i on i.id = ri.item_id
    where ri.reserva_id = r.id
  ), 0) as buffer_minutos
from reservas r
where r.estado in ('confirmada', 'bloqueada') and r.hora_inicio is not null;

grant select on disponibilidad_citas to anon, authenticated;

-- ------------------------------------------------------------
-- 2. ¿El recurso trabaja esta franja ese día? (herencia incluida)
--    La ATENCIÓN [p_hora, p_hora + duración) debe caber completa en
--    un rango laboral; el buffer puede quedar por fuera.
-- ------------------------------------------------------------
create or replace function public.recurso_trabaja_franja(
  p_miembro_id uuid,          -- null = el negocio como recurso único
  p_horario_negocio jsonb,    -- ranchos.detalles->'horario_citas' (puede ser null)
  p_fecha date,
  p_hora time,
  p_dur_min integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dow int := extract(dow from p_fecha)::int;
  -- Minutos desde medianoche, como el motor JS: `time + interval` da
  -- la vuelta en medianoche (23:30 + 60 min = 00:30) y mentiría en
  -- las comparaciones.
  v_ini numeric := extract(epoch from p_hora) / 60;
  v_fin numeric := extract(epoch from p_hora) / 60 + p_dur_min;
  v_dia jsonb;
begin
  -- Horario propio del recurso: si tiene filas para ese día de la
  -- semana, MANDAN (aunque el negocio esté cerrado ese día).
  -- Sin hora no hay franja que validar: false, nunca NULL. Los `if
  -- not …` de crear_cita fallarían ABIERTOS con NULL (`not NULL` es
  -- NULL y el IF no dispara) — por eso todo camino devuelve booleano.
  if p_hora is null or p_dur_min is null then
    return false;
  end if;

  if p_miembro_id is not null and exists (
    select 1 from horarios_recurso h
    where h.miembro_id = p_miembro_id and h.dow = v_dow
  ) then
    return exists (
      select 1 from horarios_recurso h
      where h.miembro_id = p_miembro_id
        and h.dow = v_dow
        and v_ini >= extract(epoch from h.abre) / 60
        and v_fin <= extract(epoch from h.cierra) / 60
    );
  end if;

  -- Herencia: rige el horario semanal del negocio. Sin horario
  -- configurado no se restringe (compatibilidad 0055: la UI ofrece
  -- 8:00–18:00 por defecto, pero el negocio nunca lo fijó).
  if p_horario_negocio is null or jsonb_typeof(p_horario_negocio) <> 'object' then
    return true;
  end if;

  v_dia := p_horario_negocio -> v_dow::text;
  if v_dia is null or jsonb_typeof(v_dia) <> 'object' then
    return false;  -- día ausente o null = cerrado
  end if;

  -- Un día a medio guardar (sin 'abre' o sin 'cierra') es cerrado, no
  -- "pasa igual": coalesce evita que el NULL se propague al IF.
  return coalesce(
    v_ini >= extract(epoch from (v_dia ->> 'abre')::time) / 60
      and v_fin <= extract(epoch from (v_dia ->> 'cierra')::time) / 60,
    false
  );
end;
$$;

-- Solo la usan crear_cita y el servidor; no hace falta exponerla.
revoke execute on function public.recurso_trabaja_franja(uuid, jsonb, date, time, integer) from public, anon;
grant execute on function public.recurso_trabaja_franja(uuid, jsonb, date, time, integer) to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. ¿Un bloqueo tapa esta franja de atención?
-- ------------------------------------------------------------
create or replace function public.franja_bloqueada(
  p_rancho_id uuid,
  p_miembro_id uuid,          -- null = solo bloqueos del negocio entero
  p_zona text,
  p_fecha date,
  p_hora time,
  p_dur_min integer
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bloqueos_agenda b
    where b.rancho_id = p_rancho_id
      and (b.miembro_id is null
           or (p_miembro_id is not null and b.miembro_id = p_miembro_id))
      -- El instante local de la cita (date + time = timestamp),
      -- traducido a la zona del negocio.
      and b.inicio < (((p_fecha + p_hora) + make_interval(mins => p_dur_min))
                      at time zone p_zona)
      and ((p_fecha + p_hora) at time zone p_zona) < b.fin
  );
$$;

revoke execute on function public.franja_bloqueada(uuid, uuid, text, date, time, integer) from public, anon;
grant execute on function public.franja_bloqueada(uuid, uuid, text, date, time, integer) to authenticated, service_role;

-- ------------------------------------------------------------
-- 4. ¿Choca con otra cita ocupada? — con los buffers de AMBOS
--    lados: la nueva ocupa duración + su buffer; cada existente ocupa
--    lo suyo + el buffer de su servicio.
--
--    Cuentan las 'confirmada' Y las 'bloqueada' (los compromisos que
--    el sync .ics de la 0072 trae del calendario del dueño): la misma
--    regla de la vista disponibilidad_citas, que es lo que el motor
--    del navegador consume.
--
--    Quién choca con quién, en dos reglas:
--
--    · p_miembro_id null = "el negocio como recurso único" (no tiene
--      equipo activo): choca contra TODAS sus citas, incluidas las
--      que quedaron con el miembro_id de alguien que se desactivó.
--    · Una cita SIN miembro_id es del negocio entero y choca con
--      CUALQUIER recurso. Acá viven los compromisos del calendario
--      externo (el sync de la 0072 nunca escribe miembro_id): sin
--      esta mitad, en un negocio con equipo no taparían nada y un
--      cliente reservaría encima de la cita médica del dueño.
--
--    El motor JS (disponibilidad.ts) filtra igual.
-- ------------------------------------------------------------
create or replace function public.franja_chocada(
  p_rancho_id uuid,
  p_miembro_id uuid,          -- null = el negocio entero (sin equipo)
  p_fecha date,
  p_hora time,
  p_ocupa_min integer         -- duración + buffer de la cita nueva
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from reservas x
    where x.rancho_id = p_rancho_id
      and x.fecha = p_fecha
      and x.estado in ('confirmada', 'bloqueada')
      and x.hora_inicio is not null
      and (p_miembro_id is null
           or x.miembro_id is null
           or x.miembro_id = p_miembro_id)
      -- Minutos desde medianoche (como el motor JS): `time + interval`
      -- da la vuelta en medianoche y mentiría en la comparación.
      and extract(epoch from x.hora_inicio) / 60
            < extract(epoch from p_hora) / 60 + p_ocupa_min
      and extract(epoch from p_hora) / 60
            < extract(epoch from x.hora_inicio) / 60
              + coalesce(x.duracion_minutos, 30)
              + coalesce((
                  select max(i.buffer_min)
                  from reserva_items ri
                  join rancho_items i on i.id = ri.item_id
                  where ri.reserva_id = x.id
                ), 0)
  );
$$;

revoke execute on function public.franja_chocada(uuid, uuid, date, time, integer) from public, anon;
grant execute on function public.franja_chocada(uuid, uuid, date, time, integer) to authenticated, service_role;

-- ------------------------------------------------------------
-- 5. El RPC, misma firma que en 0055 — web y app siguen llamando
--    igual; solo que ahora el servidor valida TODO lo que la UI pinta.
-- ------------------------------------------------------------
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
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para reservar tu cita.';
  end if;

  -- Una cita SIN hora no es una cita: sin este freno, un null se
  -- colaría por todas las validaciones (comparar contra null nunca es
  -- verdadero) y quedaría una reserva confirmada invisible en la
  -- agenda pero contada en las finanzas del dueño.
  if p_fecha is null or p_hora is null then
    raise exception 'Elegí la fecha y la hora de tu cita.';
  end if;

  select id, nombre, owner_id, detalles, vertical, estado, zona_horaria
    into v_rancho
  from ranchos
  where id = p_rancho_id and estado = 'aprobado' and vertical = 'citas';

  if v_rancho.id is null then
    raise exception 'Este negocio no está disponible para citas.';
  end if;

  v_zona := coalesce(v_rancho.zona_horaria, 'America/Costa_Rica');

  if p_fecha < (now() at time zone v_zona)::date then
    raise exception 'Esa fecha ya pasó — elegí una fecha futura.';
  end if;

  -- Y hoy, una hora que ya pasó tampoco: el motor del navegador no
  -- las ofrece (disponibilidad.ts, `desdeMinutos`), el servidor
  -- tampoco las acepta.
  if p_fecha = (now() at time zone v_zona)::date
     and p_hora < (now() at time zone v_zona)::time then
    raise exception 'Esa hora ya pasó — elegí una más tarde.';
  end if;

  select id, nombre, precio, duracion_minutos, buffer_min, activo
    into v_item
  from rancho_items
  where id = p_item_id and rancho_id = p_rancho_id;

  if v_item.id is null or not v_item.activo then
    raise exception 'Ese servicio ya no está disponible.';
  end if;

  v_dur := coalesce(v_item.duracion_minutos, 30);
  v_buffer := coalesce(v_item.buffer_min, 0);
  v_horario := v_rancho.detalles -> 'horario_citas';

  -- ¿El servicio está restringido a ciertos recursos? (0061)
  v_restringido := exists (
    select 1 from servicios_recurso sr where sr.item_id = p_item_id
  );

  -- Serializa el negocio+fecha (el mismo candado del disparador; es
  -- reentrante dentro de la transacción). A partir de acá, ningún otro
  -- cliente puede colarse en la misma fecha hasta que terminemos.
  perform pg_advisory_xact_lock(
    hashtext(p_rancho_id::text || ':' || p_fecha::text)
  );

  select exists (
    select 1 from equipo_rancho e
    where e.rancho_id = p_rancho_id and e.activo
  ) into v_hay_equipo;

  if p_miembro_id is not null then
    -- Persona elegida: del negocio, activa y que dé este servicio.
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

    if franja_chocada(p_rancho_id, v_miembro, p_fecha, p_hora, v_dur + v_buffer) then
      raise exception using errcode = '23505',
        message = 'Esa hora ya está tomada con esa persona — elegí otra.';
    end if;
  elsif v_hay_equipo then
    -- "Cualquiera": la primera persona activa que da el servicio,
    -- trabaja esa franja, no está bloqueada y no tiene choque.
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
      and not franja_chocada(p_rancho_id, e.id, p_fecha, p_hora, v_dur + v_buffer)
    order by e.orden, e.created_at
    limit 1;

    if v_miembro is null then
      raise exception using errcode = '23505',
        message = 'Esa hora ya se llenó — elegí otro espacio.';
    end if;
  else
    -- Sin equipo activo: el negocio entero es el recurso, y
    -- servicios_recurso NO aplica — una restricción "solo estas
    -- personas" no significa nada cuando no queda ninguna. Es el caso
    -- del salón que tuvo empleada, le asignó los servicios y volvió a
    -- trabajar solo: sus filas viejas de servicios_recurso no pueden
    -- dejarlo sin reservas en línea. (La UI decide igual: mira
    -- equipo.length antes de dar por muerto un servicio.)
    if not recurso_trabaja_franja(null, v_horario, p_fecha, p_hora, v_dur) then
      raise exception 'Esa hora está fuera del horario de atención.';
    end if;

    if franja_bloqueada(p_rancho_id, null, v_zona, p_fecha, p_hora, v_dur) then
      raise exception using errcode = '23505',
        message = 'Esa hora no está disponible — elegí otro espacio.';
    end if;

    if franja_chocada(p_rancho_id, null, p_fecha, p_hora, v_dur + v_buffer) then
      raise exception using errcode = '23505',
        message = 'Esa hora ya está reservada — elegí otro espacio.';
    end if;
  end if;

  select email into v_correo from auth.users where id = auth.uid();

  insert into reservas (
    rancho_id, cliente_id, fecha, hora_inicio, duracion_minutos, miembro_id,
    nombre, contacto, correo, whatsapp, tipo_evento, estado,
    monto_total, deposito_monto, notas, origen, detalle_pedido
  ) values (
    p_rancho_id, auth.uid(), p_fecha, p_hora, v_dur, v_miembro,
    coalesce(nullif(trim(p_nombre), ''), v_correo),
    coalesce(nullif(trim(p_telefono), ''), v_correo),
    v_correo, nullif(trim(p_telefono), ''),
    v_item.nombre, 'confirmada',
    v_item.precio, 0, nullif(trim(p_notas), ''), 'web',
    jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id,
      'nombre', v_item.nombre,
      'precio', v_item.precio,
      'duracion_minutos', v_dur,
      'miembro', v_miembro_nombre
    ))
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

notify pgrst, 'reload schema';
