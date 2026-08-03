-- ============================================================
-- BOOKEA — Citas Fase 2 (0095): depósitos, lista de espera y
-- recordatorio del mismo día
--
--  1. `ranchos.deposito_citas`: el depósito OPCIONAL que un negocio de
--     citas pide para asegurar la cita (null = sin depósito, el v1 de
--     siempre). OPT-IN a propósito: NO se reutiliza deposito_reserva
--     (su default de 25000 es de eventos — un negocio de citas que
--     nunca configuró nada cobraría depósito sin saberlo). La cita
--     sigue naciendo CONFIRMADA al instante (regla de producto): el
--     depósito se paga por SINPE y el dueño lo valida en Finanzas con
--     la maquinaria que ya usan los eventos (deposito_monto /
--     deposito_validado / marcarDepositoRecibido).
--
--  2. `crear_cita` v3: misma firma EXACTA (contrato con la app móvil
--     instalada — jamás una sobrecarga), pero deposito_monto ahora
--     sale de ranchos.deposito_citas en vez del 0 fijo. El precio y el
--     depósito los pone la base, nunca el navegador (patrón 0087).
--
--  3. `lista_espera`: cuando un día no tiene espacios, el cliente deja
--     su nombre; cuando el negocio cancela o mueve una cita de ese
--     día, se avisa A TODOS los apuntados (v1: "reserva quien confirme
--     primero" — el RPC sigue siendo el árbitro de la franja, así que
--     no puede haber doble reserva). `avisado_en` es el reclamo del
--     aviso: null = todavía no se le avisó.
--
--  4. `reservas.recordatorio_hora_enviado`: la bandera del recordatorio
--     "tu cita es en unas horas" (cron horario /api/recordatorios-hora,
--     patrón claim-inside-update de 0047).
--
-- Todo es ADITIVO: columnas nuevas con default, tabla nueva con RLS, y
-- el RPC cambia solo por dentro. Es seguro correr esto varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Depósito para citas (opt-in por negocio)
-- ------------------------------------------------------------

alter table ranchos add column if not exists deposito_citas numeric;

alter table ranchos drop constraint if exists ranchos_deposito_citas_check;
alter table ranchos add constraint ranchos_deposito_citas_check
  check (
    deposito_citas is null
    or (deposito_citas >= 0 and deposito_citas <= 10000000)
  );

-- ------------------------------------------------------------
-- 2. Bandera del recordatorio del mismo día
-- ------------------------------------------------------------

alter table reservas add column if not exists recordatorio_hora_enviado boolean not null default false;

-- ------------------------------------------------------------
-- 3. Lista de espera
-- ------------------------------------------------------------

create table if not exists lista_espera (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- Quién espera: exige sesión (como crear_cita) — así el aviso tiene
  -- push y correo verificado, y no hay spam de anónimos.
  cliente_id uuid not null references auth.users(id) on delete cascade,
  -- Qué quería (opcional: "lo que sea con quien sea" también vale).
  item_id uuid references rancho_items(id) on delete set null,
  miembro_id uuid references equipo_rancho(id) on delete set null,
  fecha date not null,
  nombre text check (nombre is null or char_length(nombre) <= 120),
  correo text check (
    correo is null
    or (correo = btrim(lower(correo), E' \t\n\r\f\v') and position('@' in correo) > 1 and correo !~ '\s')
  ),
  telefono text check (telefono is null or char_length(telefono) <= 40),
  notas text check (notas is null or char_length(notas) <= 300),
  -- El reclamo del aviso "se liberó un espacio": null = sin avisar.
  avisado_en timestamptz,
  created_at timestamptz not null default now(),
  -- Una sola vez por (negocio, día, persona): apuntarse dos veces no
  -- da más campo, solo ruido.
  unique (rancho_id, fecha, cliente_id)
);

create index if not exists lista_espera_rancho_fecha_idx
  on lista_espera (rancho_id, fecha, created_at);

alter table lista_espera enable row level security;

-- El cliente maneja SU lugar en la fila; el dueño ve y depura la de su
-- negocio; el servidor (service key) escribe el reclamo del aviso.
drop policy if exists "El cliente se apunta" on lista_espera;
create policy "El cliente se apunta" on lista_espera
  for insert to authenticated
  -- La fecha se compara en hora de COSTA RICA, no en el current_date
  -- del servidor (UTC): con current_date, apuntarse para HOY fallaría
  -- todas las noches desde las 6 pm CR — justo la franja de las
  -- cancelaciones de último minuto. (Decisión D-1: el sistema vive en
  -- hora CR.)
  with check (
    cliente_id = auth.uid()
    and fecha >= (now() at time zone 'America/Costa_Rica')::date
  );

drop policy if exists "Cada quien ve su fila de espera" on lista_espera;
create policy "Cada quien ve su fila de espera" on lista_espera
  for select to authenticated
  using (
    cliente_id = auth.uid()
    or is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

drop policy if exists "Cada quien borra su lugar" on lista_espera;
create policy "Cada quien borra su lugar" on lista_espera
  for delete to authenticated
  using (
    cliente_id = auth.uid()
    or is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

grant select, insert, delete on lista_espera to authenticated;
grant all on lista_espera to service_role;

-- ------------------------------------------------------------
-- 4. crear_cita v3: el depósito sale de la base
-- ------------------------------------------------------------
-- Misma firma (create or replace, JAMÁS otra aridad: PostgREST se
-- confunde con sobrecargas y la app móvil llama esta firma). El único
-- cambio de comportamiento: deposito_monto = coalesce(deposito_citas, 0).

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

  -- Una cita SIN hora no es una cita: sin este freno, un null se
  -- colaría por todas las validaciones (comparar contra null nunca es
  -- verdadero) y quedaría una reserva confirmada invisible en la
  -- agenda pero contada en las finanzas del dueño.
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
  -- El depósito lo pone la base (patrón 0087) — el navegador jamás.
  v_deposito := coalesce(v_rancho.deposito_citas, 0);

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
    v_item.precio, v_deposito, nullif(trim(p_notas), ''), 'web',
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
