-- ------------------------------------------------------------
-- La segunda vertical de Bookea: CITAS (estilo Fresha).
--
-- Decisiones confirmadas por el dueño:
--   · Se reutiliza la infraestructura de eventos (ranchos, reservas,
--     chat, reseñas) con una columna `vertical` — no un sistema aparte.
--   · La cita se confirma INSTANTÁNEO si el espacio está libre.
--   · Se paga en el local (sin depósito en la v1).
--   · El cliente elige profesional, con "cualquiera" como opción.
--
-- Piezas:
--   1. ranchos.vertical: eventos | citas | hospedajes.
--   2. equipo_rancho: las personas que atienden (estilistas, barberos).
--   3. rancho_items.duracion_minutos: los servicios de cita se miden
--      en minutos, no en horas.
--   4. reservas.hora_inicio/duracion_minutos/miembro_id: una cita es
--      una reserva con hora.
--   5. El disparador de cupo aprende el caso "con hora": dos citas no
--      pueden pisarse con la misma persona (ni entre sí si el negocio
--      no tiene equipo).
--   6. RPC crear_cita: valida horario, resuelve el profesional y crea
--      la cita confirmada en una sola transacción.
--   7. Vista disponibilidad_citas (sin datos personales) para pintar
--      las horas libres en la página pública.
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

-- 1. La vertical del negocio. Todo lo existente es de eventos.
alter table ranchos add column if not exists vertical text not null default 'eventos';
alter table ranchos drop constraint if exists ranchos_vertical_check;
alter table ranchos add constraint ranchos_vertical_check
  check (vertical in ('eventos', 'citas', 'hospedajes'));
create index if not exists ranchos_vertical_idx on ranchos (vertical);

-- 2. El equipo del negocio.
create table if not exists equipo_rancho (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 60),
  rol text check (rol is null or char_length(rol) <= 60),
  foto_url text,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists equipo_rancho_rancho_idx on equipo_rancho (rancho_id);

alter table equipo_rancho enable row level security;

-- El equipo es parte de la página pública del negocio aprobado; el
-- dueño (y el admin) lo ven y lo administran siempre.
drop policy if exists "El equipo de un negocio aprobado es público" on equipo_rancho;
create policy "El equipo de un negocio aprobado es público" on equipo_rancho
  for select to anon, authenticated
  using (
    exists (
      select 1 from ranchos r
      where r.id = rancho_id
        and (r.estado = 'aprobado' or r.owner_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "El dueño administra su equipo" on equipo_rancho;
create policy "El dueño administra su equipo" on equipo_rancho
  for all to authenticated
  using (
    exists (
      select 1 from ranchos r
      where r.id = rancho_id and (r.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from ranchos r
      where r.id = rancho_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

grant select on equipo_rancho to anon, authenticated;
grant insert, update, delete on equipo_rancho to authenticated;

-- 3. Los servicios de cita se miden en minutos.
alter table rancho_items add column if not exists duracion_minutos integer;
alter table rancho_items drop constraint if exists rancho_items_duracion_minutos_check;
alter table rancho_items add constraint rancho_items_duracion_minutos_check
  check (duracion_minutos is null or duracion_minutos between 5 and 480);

-- 4. Una cita es una reserva con hora.
alter table reservas add column if not exists hora_inicio time;
alter table reservas add column if not exists duracion_minutos integer;
alter table reservas add column if not exists miembro_id uuid references equipo_rancho(id) on delete set null;

create index if not exists reservas_citas_idx
  on reservas (rancho_id, fecha, hora_inicio)
  where hora_inicio is not null;

-- 5. El disparador de cupo, ahora con dos caminos:
--    · Sin hora (eventos): el cupo por día de siempre (0049).
--    · Con hora (citas): nada de cupo diario — lo que no puede pasar
--      es que dos citas se solapen con la misma persona, o entre sí
--      cuando el negocio atiende como un solo recurso (sin equipo).
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
begin
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
    select count(*)
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

    if v_choques > 0 then
      raise exception using
        errcode = '23505',
        message = 'Esa hora ya está reservada — elegí otro espacio.';
    end if;

    return new;
  end if;

  -- EVENTOS: el cupo por día de 0049, sin cambios de fondo.
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

  select count(*)
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

-- El disparador ahora también reacciona si cambian la hora, la
-- duración o la persona de una cita.
drop trigger if exists reservas_cupo_dia on reservas;
create trigger reservas_cupo_dia
  before insert or update of estado, fecha, rancho_id, hora_inicio, duracion_minutos, miembro_id
  on reservas
  for each row execute function public.reservas_respeta_cupo_dia();

-- 6. Crear una cita en una sola transacción. El precio y la duración
-- se releen del catálogo (el navegador nunca los fija), el horario
-- semanal se respeta y el profesional se resuelve acá adentro — con
-- "cualquiera" se asigna la primera persona libre.
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
  v_dur integer;
  v_hora_fin time;
  v_horario jsonb;
  v_dia jsonb;
  v_miembro uuid;
  v_miembro_nombre text;
  v_reserva_id uuid;
  v_hay_equipo boolean;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para reservar tu cita.';
  end if;

  if p_fecha < (now() at time zone 'America/Costa_Rica')::date then
    raise exception 'Esa fecha ya pasó — elegí una fecha futura.';
  end if;

  select id, nombre, owner_id, detalles, vertical, estado
    into v_rancho
  from ranchos
  where id = p_rancho_id and estado = 'aprobado' and vertical = 'citas';

  if v_rancho.id is null then
    raise exception 'Este negocio no está disponible para citas.';
  end if;

  select id, nombre, precio, duracion_minutos, activo
    into v_item
  from rancho_items
  where id = p_item_id and rancho_id = p_rancho_id;

  if v_item.id is null or not v_item.activo then
    raise exception 'Ese servicio ya no está disponible.';
  end if;

  v_dur := coalesce(v_item.duracion_minutos, 30);
  v_hora_fin := p_hora + make_interval(mins => v_dur);

  -- El horario semanal del negocio (si lo configuró). Guardado en
  -- detalles->'horario_citas' como {"1": {"abre":"09:00","cierra":"18:00"}}
  -- con el día 0=domingo … 6=sábado; día ausente o null = cerrado.
  v_horario := v_rancho.detalles -> 'horario_citas';
  if v_horario is not null and jsonb_typeof(v_horario) = 'object' then
    v_dia := v_horario -> extract(dow from p_fecha)::int::text;
    if v_dia is null or jsonb_typeof(v_dia) <> 'object' then
      raise exception 'Ese día el negocio está cerrado — elegí otro.';
    end if;
    if p_hora < (v_dia ->> 'abre')::time
       or v_hora_fin > (v_dia ->> 'cierra')::time then
      raise exception 'Esa hora está fuera del horario de atención.';
    end if;
  end if;

  -- Serializa el negocio+fecha (el mismo lock del disparador: es
  -- reentrante dentro de la transacción).
  perform pg_advisory_xact_lock(
    hashtext(p_rancho_id::text || ':' || p_fecha::text)
  );

  select exists (
    select 1 from equipo_rancho e
    where e.rancho_id = p_rancho_id and e.activo
  ) into v_hay_equipo;

  if p_miembro_id is not null then
    -- Persona elegida: tiene que ser del negocio y estar libre.
    select e.id, e.nombre into v_miembro, v_miembro_nombre
    from equipo_rancho e
    where e.id = p_miembro_id and e.rancho_id = p_rancho_id and e.activo;

    if v_miembro is null then
      raise exception 'Esa persona ya no atiende en este negocio.';
    end if;

    if exists (
      select 1 from reservas x
      where x.rancho_id = p_rancho_id and x.fecha = p_fecha
        and x.estado = 'confirmada' and x.hora_inicio is not null
        and x.miembro_id = v_miembro
        and (x.hora_inicio,
             x.hora_inicio + make_interval(mins => coalesce(x.duracion_minutos, 30)))
            overlaps (p_hora, v_hora_fin)
    ) then
      raise exception using errcode = '23505',
        message = 'Esa hora ya está tomada con esa persona — elegí otra.';
    end if;
  elsif v_hay_equipo then
    -- "Cualquiera": la primera persona activa libre en ese espacio.
    select e.id, e.nombre into v_miembro, v_miembro_nombre
    from equipo_rancho e
    where e.rancho_id = p_rancho_id and e.activo
      and not exists (
        select 1 from reservas x
        where x.rancho_id = p_rancho_id and x.fecha = p_fecha
          and x.estado = 'confirmada' and x.hora_inicio is not null
          and x.miembro_id = e.id
          and (x.hora_inicio,
               x.hora_inicio + make_interval(mins => coalesce(x.duracion_minutos, 30)))
              overlaps (p_hora, v_hora_fin)
      )
    order by e.orden, e.created_at
    limit 1;

    if v_miembro is null then
      raise exception using errcode = '23505',
        message = 'Esa hora ya se llenó — elegí otro espacio.';
    end if;
  end if;
  -- Sin equipo: v_miembro queda null y el disparador cuida el choque
  -- del negocio como recurso único.

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

-- 7. Las horas ocupadas, sin datos de nadie — para pintar los
-- espacios libres en la página pública (mismo patrón que
-- disponibilidad_rancho).
create or replace view disponibilidad_citas as
select rancho_id, fecha, hora_inicio, duracion_minutos, miembro_id
from reservas
where estado = 'confirmada' and hora_inicio is not null;

grant select on disponibilidad_citas to anon, authenticated;

notify pgrst, 'reload schema';
