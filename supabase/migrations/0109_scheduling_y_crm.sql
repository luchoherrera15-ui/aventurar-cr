-- ============================================================
-- BOOKEA BUSINESS — Fase 2: tipo de reserva, concurrencia del
-- recurso y ficha de cliente por negocio (0109)
--
-- Tres piezas, TODAS aditivas. Ninguna fila existente cambia de
-- comportamiento: lo nuevo se activa solo cuando el dueño configura
-- algo nuevo a propósito.
--
--   1. `reservas.tipo_reserva` — qué clase de reserva es. ANULABLE y
--      sin backfill: se deriva de (vertical, estado, origen) cuando
--      está en null. Es un DATO, no un discriminador de control: el
--      disparador NO lo lee (ver punto 2).
--
--   2. `equipo_rancho.cupo_simultaneo` — CONCURRENCIA DEL RECURSO:
--      cuántas reservas caben A LA VEZ en él. null = 1 = exclusivo,
--      que es todo lo que existe hoy.
--
--   3. `clientes_negocio` — las notas y etiquetas privadas que un
--      negocio le pone a su cliente. El CRM sigue siendo DERIVADO de
--      las reservas (decisión D-3): esto es solo lo que no se puede
--      derivar de ningún lado.
--
-- ------------------------------------------------------------
-- QUÉ SIGNIFICA `cupo_simultaneo` (y qué NO significa)
-- ------------------------------------------------------------
-- En `equipo_rancho` conviven ahora DOS números que se parecen y no
-- son lo mismo. Es a propósito y no se pueden mezclar:
--
--   `capacidad`         (0076) — PERSONAS QUE CABEN en el recurso.
--                       Una mesa para 6. No la lee ningún motor; la
--                       usa el panel para no sentar 8 en una de 2.
--                       ESTA MIGRACIÓN NO LA TOCA NI LA REINTERPRETA.
--
--   `cupo_simultaneo`   (acá) — RESERVAS QUE CABEN A LA VEZ. Dos
--                       sillas en la misma estación = 2. Es lo que
--                       cuenta el motor de agenda.
--
-- LÍMITE DECLARADO, para que nadie se confunda después:
-- `cupo_simultaneo` es CONCURRENCIA GENÉRICA DEL RECURSO, **no** la
-- capacidad semántica de una clase. NO va a ser la capacidad
-- definitiva de una clase de pilates.
--
-- En la Fase 4, una OCURRENCIA de clase va a tener su propia
-- capacidad y sus propios participantes, y varias reservas van a
-- pertenecer a la MISMA ocurrencia. Hoy eso no se puede expresar:
-- con solo un número en el recurso, una sala con cupo 15 acepta 15
-- reservas solapadas de cualquier cosa — dos clases distintas a la
-- misma hora entran, y una clase encadenada se monta sobre la
-- anterior. Eso es una limitación CONOCIDA y aceptada de esta fase,
-- no un descuido: lo resuelve la ocurrencia de clase en la Fase 4.
--
-- Otra limitación conocida: `cupo_simultaneo` cuelga del recurso, así
-- que un negocio SIN equipo (miembro_id null: el salón que trabaja
-- solo, y también las reservas de servicios de eventos de la 0067,
-- que nunca llevan miembro) queda clavado en cupo 1. Para declarar
-- concurrencia hay que crear al menos un recurso en `equipo_rancho`.
--
-- ------------------------------------------------------------
-- POR QUÉ EL DISPARADOR SIGUE BIFURCANDO POR `hora_inicio`
-- ------------------------------------------------------------
-- `reservas_respeta_cupo_dia` elige rama con `hora_inicio is null`,
-- NO con `tipo_reserva`, y eso se mantiene deliberadamente. La 0067
-- le dio `hora_inicio` a los servicios de EVENTOS (el DJ de las
-- 18:00): si la bifurcación pasara a mirar `tipo_reserva`, esas
-- reservas se irían de la rama de solape a la de cupo diario y
-- cambiaría su comportamiento en producción. `tipo_reserva` no
-- gobierna nada acá.
--
-- ------------------------------------------------------------
-- EQUIVALENCIA CON CUPO = 1 (la parte que hay que poder auditar)
-- ------------------------------------------------------------
-- En la rama de franja, el ÚNICO cambio es la constante de la
-- comparación:   antes  `if v_choques > 0`
--                ahora  `if v_choques >= v_cupo`
-- Con v_cupo = 1 (todas las filas de hoy, porque la columna nace en
-- null y `greatest(1, coalesce(...,1))` la resuelve a 1), `>= 1` y
-- `> 0` son la misma condición sobre un entero no negativo.
--
-- Se conserva LITERALMENTE todo lo demás de la rama:
--   · el mismo `OVERLAPS` con aritmética de tipo `time`;
--   · los mismos estados contados (solo 'confirmada');
--   · el mismo emparejamiento de miembro (igualdad estricta, o ambos
--     null);
--   · sin buffers.
-- Esas tres asimetrías contra `franja_chocada` (0081) son
-- INTENCIONALES y están documentadas en 0081:39-45: el disparador es
-- la red del choque duro, no el portero — el dueño tiene que poder
-- cargar a mano fuera de horario, importar (0077) y sincronizar
-- (0072). Copiar acá el cuerpo de `franja_chocada` endurecería el
-- disparador y empezaría a rechazar lo que hoy pasa.
--
-- OJO — BUG PREEXISTENTE QUE ESTA MIGRACIÓN **NO** ARREGLA:
-- el `OVERLAPS` de abajo usa `time + make_interval`, que da la vuelta
-- en medianoche; y `OVERLAPS` además intercambia los extremos cuando
-- el fin queda antes que el inicio. Una cita de 23:30 con 60 minutos
-- se evalúa como (00:30, 23:30) y bloquea casi todo el día. Se
-- mantiene TAL CUAL para que la equivalencia con cupo = 1 sea total.
-- Arreglarlo (pasar a minutos desde medianoche, como ya hacen
-- `franja_chocada` y el motor JS) cambia veredictos en las reservas
-- que cruzan medianoche y se decide aparte. Para inventariarlas:
--
--   select id, rancho_id, fecha, hora_inicio, duracion_minutos, estado
--   from reservas
--   where hora_inicio is not null
--     and estado in ('confirmada', 'bloqueada')
--     and extract(epoch from hora_inicio) / 60
--         + coalesce(duracion_minutos, 30) > 1440;
--
-- ------------------------------------------------------------
-- ORDEN DE DESPLIEGUE (importa)
-- ------------------------------------------------------------
-- 1º este SQL en el editor de Supabase · 2º deploy de la web ·
-- 3º build de la app. El código nuevo nombra `cupo_simultaneo` y
-- `exclusiva` en selects explícitos: si sale antes que el esquema, esas
-- consultas fallan. El código las pide con reintento sin la columna,
-- pero el orden correcto evita el rodeo.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================


-- ============================================================
-- 1. reservas.tipo_reserva
-- ============================================================

alter table reservas add column if not exists tipo_reserva text;

-- 'clase' se admite desde ya para no volver a migrar el constraint
-- cuando llegue la Fase 4, aunque hoy nada lo escriba.
alter table reservas drop constraint if exists reservas_tipo_reserva_check;
alter table reservas add constraint reservas_tipo_reserva_check
  check (
    tipo_reserva is null
    or tipo_reserva in ('cita', 'clase', 'evento', 'estadia', 'mesa')
  );

comment on column reservas.tipo_reserva is
  'Qué clase de reserva es. null = se deriva de (vertical, estado, '
  'origen) en el código — ver src/lib/reservas/tipo-reserva.ts. Es un '
  'DATO informativo: el disparador de cupo NO lo lee y sigue '
  'bifurcando por hora_inicio.';

-- Nota deliberada: NO se agrega `tipo_reserva` a la cláusula
-- `update of ...` del disparador (más abajo). Sería inocuo, pero
-- haría que un update masivo de la columna dispare la validación fila
-- por fila sin ninguna ganancia.


-- ------------------------------------------------------------
-- 1b. El navegador no fija el tipo de una reserva ajena
--
-- La política de INSERT de la 0025 no restringe columnas, y la anon
-- key está publicada en el bundle: sin esto, cualquiera podría fijar
-- `tipo_reserva` en la reserva que crea y en el hold temporal de otra
-- persona. Mismo criterio que la 0086 (el rol no sale de la metadata
-- del cliente) y la 0087 (el precio lo pone la base).
--
-- El dueño SÍ puede: sus acciones de panel escriben con su sesión.
-- ------------------------------------------------------------

drop policy if exists "Cualquiera crea una reserva o un hold temporal" on reservas;
create policy "Cualquiera crea una reserva o un hold temporal"
  on reservas for insert
  to anon, authenticated
  with check (
    estado in ('pendiente', 'temporal')
    and (
      tipo_reserva is null
      or rancho_id in (select id from ranchos where owner_id = auth.uid())
    )
  );

drop policy if exists "Cualquiera completa su propio hold temporal" on reservas;
create policy "Cualquiera completa su propio hold temporal"
  on reservas for update
  to anon, authenticated
  using (estado = 'temporal')
  with check (
    estado in ('temporal', 'pendiente')
    and (
      tipo_reserva is null
      or rancho_id in (select id from ranchos where owner_id = auth.uid())
    )
  );


-- ============================================================
-- 2. equipo_rancho.cupo_simultaneo — concurrencia del recurso
-- ============================================================

alter table equipo_rancho add column if not exists cupo_simultaneo int;

-- Mismo patrón y mismo rango que `capacidad` (0076) y que
-- `eventos_por_dia` (0049). El `greatest(1, ...)` de las funciones es
-- la red, no la regla: sin este check, un 0 guardado por error haría
-- que TODA confirmación de ese recurso reventara con un mensaje que
-- miente.
alter table equipo_rancho drop constraint if exists equipo_rancho_cupo_simultaneo_check;
alter table equipo_rancho add constraint equipo_rancho_cupo_simultaneo_check
  check (
    cupo_simultaneo is null
    or (cupo_simultaneo >= 1 and cupo_simultaneo <= 100)
  );

comment on column equipo_rancho.cupo_simultaneo is
  'Cuántas RESERVAS caben a la vez en este recurso. NULL = 1 = '
  'exclusivo. NO es capacidad de personas (eso es equipo_rancho.'
  'capacidad, 0076). No es la capacidad de una clase: eso llega en la '
  'Fase 4 con la ocurrencia de clase.';


-- ------------------------------------------------------------
-- 2b. cupo_recurso — UNA sola definición del cupo
--
-- La usan el disparador Y `franja_llena`. Si cada uno lo resolviera
-- por su cuenta, bastaría un typo para que `crear_cita` aceptara una
-- franja que el disparador rechaza con 23505 dentro del mismo RPC.
--
-- El `and e.rancho_id = p_rancho_id` NO es decorativo: `reservas.
-- miembro_id` tiene FK a equipo_rancho pero ninguna restricción de
-- tenant, y los ids del equipo de un negocio aprobado son públicos
-- (0055). Sin ese filtro, alguien podría apuntar una reserva de SU
-- negocio al recurso de otro y heredarle el cupo.
-- ------------------------------------------------------------

create or replace function public.cupo_recurso(
  p_rancho_id uuid,
  p_miembro_id uuid          -- null = el negocio como recurso único
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(1, coalesce((
    select e.cupo_simultaneo
    from equipo_rancho e
    where e.id = p_miembro_id
      and e.rancho_id = p_rancho_id
  ), 1));
$$;

revoke execute on function public.cupo_recurso(uuid, uuid) from public, anon;
grant execute on function public.cupo_recurso(uuid, uuid) to authenticated, service_role;


-- ------------------------------------------------------------
-- 2c. franja_llena — la hermana CONTADORA de franja_chocada
--
-- `franja_chocada` (0081) se deja VIVA e intacta: devuelve "hay al
-- menos un solape". `franja_llena` responde otra pregunta: "ya no
-- caben más". Con cupo = 1 las dos dan exactamente lo mismo.
--
-- Misma población de filas que franja_chocada (mismos estados, misma
-- regla ancha de miembro, mismos buffers, misma aritmética en minutos)
-- — acá SÍ corresponde, porque este es el portero del cliente, no la
-- red del dueño.
--
-- CONTRATO: jamás devuelve NULL. En `crear_cita` se usa como
-- `if franja_llena(...) then raise`, y un NULL no dispara el IF: la
-- reserva pasaría. Por eso el `coalesce` sobre `bool_or` (que sobre
-- conjunto vacío devuelve NULL) es obligatorio.
-- ------------------------------------------------------------

create or replace function public.franja_llena(
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
  with solapes as (
    select x.estado
    from reservas x
    where x.rancho_id = p_rancho_id
      and x.fecha = p_fecha
      and x.estado in ('confirmada', 'bloqueada')
      and x.hora_inicio is not null
      and (p_miembro_id is null
           or x.miembro_id is null
           or x.miembro_id = p_miembro_id)
      -- Minutos desde medianoche (como el motor JS y franja_chocada).
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
  )
  -- Un compromiso del calendario del dueño ('bloqueada', origen
  -- 'sync') llena la franja SIN IMPORTAR el cupo: un bloqueo es
  -- exclusivo por definición. Con cupo = 1 esta rama es redundante
  -- (cualquier solape ya llenaba), así que no cambia nada de hoy.
  select coalesce(bool_or(estado = 'bloqueada'), false)
         or count(*) >= public.cupo_recurso(p_rancho_id, p_miembro_id)
  from solapes;
$$;

revoke execute on function public.franja_llena(uuid, uuid, date, time, integer)
  from public, anon;
grant execute on function public.franja_llena(uuid, uuid, date, time, integer)
  to authenticated, service_role;


-- ============================================================
-- 3. El disparador, ahora con cupo
--
-- Copia literal de la versión viva (0055) con DOS cambios y ni uno
-- más:
--   (a) `if v_choques > 0` pasa a `if v_choques >= v_cupo`.
--   (b) un candado para las filas 'bloqueada' (abajo se explica).
-- ============================================================

create or replace function public.reservas_respeta_cupo_dia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cupo integer;
  v_usadas integer;
  v_choques integer;
  v_cupo_recurso integer;
begin
  -- Un bloqueo del calendario externo (0072) no se valida — nunca se
  -- validó — pero SÍ toma el candado del negocio+fecha antes de
  -- pasar. Sin esto, `franja_llena` promete "un bloqueo llena la
  -- franja" y esa promesa no es atómica: el sync podría insertar el
  -- bloqueo justo después de que otra transacción ya contó y antes de
  -- que confirme. No cambia ninguna decisión de aceptar o rechazar:
  -- solo ordena las dos en el tiempo.
  if new.estado = 'bloqueada'
     and new.rancho_id is not null
     and new.hora_inicio is not null then
    perform pg_advisory_xact_lock(
      hashtext(new.rancho_id::text || ':' || new.fecha::text)
    );
    return new;
  end if;

  -- Solo interesa el momento en que una reserva pasa a ocupar espacio.
  if new.estado <> 'confirmada' or new.rancho_id is null then
    return new;
  end if;

  -- Si ya estaba confirmada igual (misma fecha, hora y persona), no se
  -- recuenta contra sí misma: marcar un pago no puede echar su propia
  -- reserva.
  if tg_op = 'UPDATE'
     and old.estado = 'confirmada'
     and old.rancho_id is not distinct from new.rancho_id
     and old.fecha = new.fecha
     and old.hora_inicio is not distinct from new.hora_inicio
     and old.duracion_minutos is not distinct from new.duracion_minutos
     and old.miembro_id is not distinct from new.miembro_id then
    return new;
  end if;

  -- Serializa este negocio para esta fecha; se libera al terminar la
  -- transacción. (Reentrante: crear_cita toma el mismo lock antes.)
  perform pg_advisory_xact_lock(
    hashtext(new.rancho_id::text || ':' || new.fecha::text)
  );

  if new.hora_inicio is not null then
    -- CITAS: choque de horarios. Con miembro asignado, contra las
    -- citas de ESA persona; sin miembro (negocio sin equipo), contra
    -- todas las citas sin miembro del negocio.
    --
    -- Cuántas caben a la vez en el recurso. null = 1 = exclusivo, que
    -- es todo lo que existía antes de la 0109.
    v_cupo_recurso := public.cupo_recurso(new.rancho_id, new.miembro_id);

    select coalesce(count(*), 0)
      into v_choques
    from reservas x
    where x.rancho_id = new.rancho_id
      and x.fecha = new.fecha
      and x.estado = 'confirmada'
      and x.hora_inicio is not null
      and x.id <> new.id
      and (
        (new.miembro_id is not null and x.miembro_id = new.miembro_id)
        or (new.miembro_id is null and x.miembro_id is null)
      )
      and (x.hora_inicio,
           x.hora_inicio + make_interval(mins => coalesce(x.duracion_minutos, 30)))
          overlaps
          (new.hora_inicio,
           new.hora_inicio + make_interval(mins => coalesce(new.duracion_minutos, 30)));

    if v_choques >= v_cupo_recurso then
      raise exception using
        errcode = '23505',
        message = case
          when v_cupo_recurso = 1
            then 'Esa hora ya está reservada — elegí otro espacio.'
          else 'Esa franja ya se llenó — elegí otro espacio.'
        end;
    end if;

    -- Un recurso con concurrencia declarada NO puede aceptar gente
    -- encima de un bloqueo del calendario del dueño. Esta comprobación
    -- se activa SOLO con cupo > 1, o sea únicamente en recursos que el
    -- dueño configuró a propósito después de la 0109: ninguna fila
    -- histórica cambia de comportamiento.
    if v_cupo_recurso > 1 and exists (
      select 1
      from reservas x
      where x.rancho_id = new.rancho_id
        and x.fecha = new.fecha
        and x.estado = 'bloqueada'
        and x.hora_inicio is not null
        and x.id <> new.id
        and (x.miembro_id is null or x.miembro_id = new.miembro_id)
        and (x.hora_inicio,
             x.hora_inicio + make_interval(mins => coalesce(x.duracion_minutos, 30)))
            overlaps
            (new.hora_inicio,
             new.hora_inicio + make_interval(mins => coalesce(new.duracion_minutos, 30)))
    ) then
      raise exception using
        errcode = '23505',
        message = 'Esa franja está bloqueada — elegí otro espacio.';
    end if;

    return new;
  end if;

  -- EVENTOS: el cupo por día de 0049, sin un solo cambio.
  select coalesce(
           r.eventos_por_dia,
           case when r.categoria = 'lugares' then 1 else null end
         )
    into v_cupo
  from ranchos r
  where r.id = new.rancho_id;

  if v_cupo is null then
    return new;
  end if;

  select coalesce(count(*), 0)
    into v_usadas
  from reservas x
  where x.rancho_id = new.rancho_id
    and x.fecha = new.fecha
    and x.estado = 'confirmada'
    and x.hora_inicio is null
    and x.id <> new.id;

  if v_usadas >= v_cupo then
    raise exception using
      errcode = '23505',
      message = case
        when v_cupo = 1
          then 'Esa fecha ya tiene una reserva confirmada.'
        else 'Ya tenés ' || v_cupo ||
             ' reservas confirmadas para esa fecha — es tu cupo del día.'
      end;
  end if;

  return new;
end;
$$;

-- La lista de columnas queda EXACTAMENTE igual que en la 0055.
drop trigger if exists reservas_cupo_dia on reservas;
create trigger reservas_cupo_dia
  before insert or update of estado, fecha, rancho_id, hora_inicio, duracion_minutos, miembro_id
  on reservas
  for each row execute function public.reservas_respeta_cupo_dia();


-- ============================================================
-- 4. La vista pública gana `exclusiva`
--
-- La 0072 metió en `disponibilidad_citas` las reservas 'bloqueada'
-- (los compromisos del calendario del dueño) mezcladas con las
-- confirmadas, y la vista nunca expuso `estado`. Mientras el cupo fue
-- 1 daba igual: cualquier solape tapaba la franja. Con cupo > 1, el
-- motor del navegador necesita saber cuáles son exclusivas o
-- terminaría ofreciendo la hora de la cita médica del dueño.
--
-- `create or replace view` solo permite AGREGAR columnas al final —
-- que es exactamente lo que se hace (mismo truco que la 0081 con
-- buffer_minutos).
-- ============================================================

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
  ), 0) as buffer_minutos,
  (r.estado = 'bloqueada') as exclusiva
from reservas r
where r.estado in ('confirmada', 'bloqueada') and r.hora_inicio is not null;

grant select on disponibilidad_citas to anon, authenticated;


-- ============================================================
-- 5. crear_cita v4 — misma firma EXACTA de 8 argumentos
--
-- JAMÁS otra aridad: PostgREST no resuelve sobrecargas y la app móvil
-- instalada llama esta firma. Dos cambios por dentro:
--   · `franja_chocada` pasa a `franja_llena` en los tres caminos;
--   · la cita nace con `tipo_reserva = 'cita'`.
-- ============================================================

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
  v_deposito := coalesce(v_rancho.deposito_citas, 0);

  if p_fecha < (now() at time zone v_zona)::date then
    raise exception 'Esa fecha ya pasó — elegí una fecha futura.';
  end if;

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


-- ============================================================
-- 6. clientes_negocio — lo que el CRM derivado no puede derivar
--
-- El CRM de Bookea se calcula al vuelo desde `reservas` y así se
-- queda (decisión D-3: derivado, nunca desincronizado). Lo único que
-- no se puede derivar de una reserva son las notas y las etiquetas
-- que el negocio le pone a SU cliente — y eso es lo que guarda esta
-- tabla.
--
-- IDENTIDAD: no se guarda la llave derivada como clave única, porque
-- esa llave es INESTABLE — el "puente" de agruparClientes se arma con
-- las reservas que entraron en la consulta, y las pantallas usan
-- ventanas distintas: la misma persona puede resolverse como
-- `id:<uuid>` en el panel y como `correo:...` en el cron. Se guardan
-- los identificadores por separado, cada uno con su índice único
-- PARCIAL, y el emparejamiento va por cuenta → correo → teléfono.
--
-- Nunca por NOMBRE: agrupar dos homónimas para contar visitas es
-- ruido tolerable; hacerlo para una nota privada es filtrar los datos
-- de una persona a otra. La acción del servidor exige al menos un
-- contacto real antes de guardar.
--
-- AISLAMIENTO: la fila pertenece al NEGOCIO. La barbería A jamás ve
-- las notas que el spa B le puso al mismo cliente.
-- ============================================================

create table if not exists clientes_negocio (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,

  -- Los identificadores, ya normalizados por el servidor:
  -- correo en minúsculas, teléfono en sus últimos 8 dígitos.
  cliente_id uuid references auth.users(id) on delete set null,
  correo text check (
    correo is null
    or (correo = btrim(lower(correo)) and position('@' in correo) > 1 and correo !~ '\s')
  ),
  telefono text check (telefono is null or telefono ~ '^[0-9]{8}$'),

  -- Pista para depurar; NO es identidad (ver arriba).
  clave text,
  -- El nombre que el dueño quiera fijar para su ficha.
  nombre text check (nombre is null or char_length(nombre) <= 120),

  notas text check (notas is null or char_length(notas) <= 2000),
  etiquetas text[] not null default '{}' check (
    coalesce(array_length(etiquetas, 1), 0) <= 12
    and char_length(array_to_string(etiquetas, ',')) <= 400
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Una ficha por identificador y por negocio. Parciales para que las
  -- fichas sin ese dato no choquen entre sí.
  constraint clientes_negocio_algun_id check (
    cliente_id is not null or correo is not null or telefono is not null
  )
);

create unique index if not exists clientes_negocio_cuenta_idx
  on clientes_negocio (rancho_id, cliente_id) where cliente_id is not null;
create unique index if not exists clientes_negocio_correo_idx
  on clientes_negocio (rancho_id, correo) where correo is not null;
create unique index if not exists clientes_negocio_telefono_idx
  on clientes_negocio (rancho_id, telefono) where telefono is not null;
create index if not exists clientes_negocio_rancho_idx
  on clientes_negocio (rancho_id);

alter table clientes_negocio enable row level security;

-- LECTURA: el dueño y el admin (soporte necesita poder mirar).
drop policy if exists "El dueño ve las fichas de su negocio" on clientes_negocio;
create policy "El dueño ve las fichas de su negocio" on clientes_negocio
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

-- ESCRITURA: SOLO el dueño. Un admin que pudiera escribir notas en el
-- CRM de cualquier negocio es suplantación pura — y con tipos de
-- negocio como 'consultorio' o 'spa' (0108), estas notas pueden traer
-- datos de salud. Nadie podría distinguir después una nota del dueño
-- de una nota escrita por la plataforma.
drop policy if exists "El dueño escribe las fichas de su negocio" on clientes_negocio;
create policy "El dueño escribe las fichas de su negocio" on clientes_negocio
  for insert to authenticated
  with check (rancho_id in (select id from ranchos where owner_id = auth.uid()));

drop policy if exists "El dueño edita las fichas de su negocio" on clientes_negocio;
create policy "El dueño edita las fichas de su negocio" on clientes_negocio
  for update to authenticated
  using (rancho_id in (select id from ranchos where owner_id = auth.uid()))
  with check (rancho_id in (select id from ranchos where owner_id = auth.uid()));

drop policy if exists "El dueño borra las fichas de su negocio" on clientes_negocio;
create policy "El dueño borra las fichas de su negocio" on clientes_negocio
  for delete to authenticated
  using (rancho_id in (select id from ranchos where owner_id = auth.uid()));

grant select, insert, update, delete on clientes_negocio to authenticated;
grant all on clientes_negocio to service_role;

comment on table clientes_negocio is
  'Notas y etiquetas PRIVADAS de un negocio sobre su cliente. El resto '
  'de la ficha (visitas, gasto, no-shows) se deriva de reservas y no '
  'se guarda acá. Aislada por negocio: nadie ve las notas de otro.';

notify pgrst, 'reload schema';
