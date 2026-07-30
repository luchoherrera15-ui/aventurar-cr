-- ============================================================
-- BOOKEA — Agenda de citas PRO (0061) — FASE 1 del sistema de citas
--
-- El sistema multi-negocio de citas REUTILIZA lo que ya existe:
--   negocio  = ranchos (vertical 'citas')     · tenant con RLS propia
--   servicio = rancho_items (duracion_minutos)
--   recurso  = equipo_rancho (la persona; ahora también espacios)
--   cliente  = auth.users / perfiles
--   cita     = reservas (fecha + hora_inicio + duracion + miembro_id,
--              con el trigger anti-solapamiento de la 0055)
--
-- Esta migración agrega lo que faltaba para el motor PRO:
--   1. buffer de limpieza/preparación por servicio
--   2. tipo de recurso (profesional | espacio | equipo)
--   3. servicios_recurso: qué recursos dan qué servicio (N:N)
--   4. horarios_recurso: horario propio por recurso (si no tiene,
--      hereda el del negocio en detalles.horario_citas)
--   5. bloqueos_agenda: vacaciones/horas bloqueadas, por recurso o
--      negocio entero, con vista pública SIN el motivo
--   6. estados de asistencia: cumplida / no_asistio / cancelada
--
-- Nota de diseño (pendiente de confirmación): los tiempos siguen como
-- fecha (date) + hora_inicio (time) en hora de Costa Rica — CR no
-- tiene horario de verano y TODO el sistema actual (web, app,
-- triggers) habla ese idioma. Migrar a timestamptz UTC es posible
-- pero es un cambio de fondo que se decide aparte.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Buffer por servicio (limpieza/preparación después de la cita)
-- ------------------------------------------------------------
alter table rancho_items
  add column if not exists buffer_min integer not null default 0
  check (buffer_min >= 0 and buffer_min <= 240);

-- ------------------------------------------------------------
-- 2. Tipo de recurso: persona, espacio (camilla, sillón) o equipo
-- ------------------------------------------------------------
alter table equipo_rancho
  add column if not exists tipo text not null default 'profesional'
  check (tipo in ('profesional', 'espacio', 'equipo'));

-- ------------------------------------------------------------
-- 3. servicios_recurso — qué recursos pueden dar qué servicio
--    Sin filas para un servicio = lo dan TODOS los recursos del
--    negocio (compatibilidad con lo que ya funciona hoy).
-- ------------------------------------------------------------
create table if not exists servicios_recurso (
  item_id uuid not null references rancho_items(id) on delete cascade,
  miembro_id uuid not null references equipo_rancho(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, miembro_id)
);

-- El servicio y el recurso tienen que ser del MISMO negocio.
create or replace function validar_servicio_recurso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select rancho_id from rancho_items where id = new.item_id)
     is distinct from
     (select rancho_id from equipo_rancho where id = new.miembro_id) then
    raise exception 'El servicio y el recurso pertenecen a negocios distintos';
  end if;
  return new;
end;
$$;

drop trigger if exists servicios_recurso_mismo_negocio on servicios_recurso;
create trigger servicios_recurso_mismo_negocio
  before insert or update on servicios_recurso
  for each row execute function validar_servicio_recurso();

alter table servicios_recurso enable row level security;

-- Lee cualquiera (la agenda pública filtra horas por profesional);
-- administra el dueño del negocio o un admin.
drop policy if exists "Asignaciones visibles para todos" on servicios_recurso;
create policy "Asignaciones visibles para todos" on servicios_recurso
  for select to anon, authenticated
  using (true);

drop policy if exists "El dueño asigna sus servicios" on servicios_recurso;
create policy "El dueño asigna sus servicios" on servicios_recurso
  for all to authenticated
  using (
    exists (
      select 1 from rancho_items i
      join ranchos r on r.id = i.rancho_id
      where i.id = item_id and (r.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from rancho_items i
      join ranchos r on r.id = i.rancho_id
      where i.id = item_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

grant select on servicios_recurso to anon;
grant select, insert, update, delete on servicios_recurso to authenticated;

-- ------------------------------------------------------------
-- 4. horarios_recurso — horario laboral propio por recurso
--    Sin filas para un recurso = hereda el horario del negocio
--    (ranchos.detalles.horario_citas), que es lo que ya existe.
-- ------------------------------------------------------------
create table if not exists horarios_recurso (
  id uuid primary key default gen_random_uuid(),
  miembro_id uuid not null references equipo_rancho(id) on delete cascade,
  -- 0 = domingo … 6 = sábado, como extract(dow) y el resto del repo.
  dow smallint not null check (dow between 0 and 6),
  abre time not null,
  cierra time not null check (cierra > abre),
  created_at timestamptz not null default now(),
  unique (miembro_id, dow, abre)
);

create index if not exists horarios_recurso_miembro_idx
  on horarios_recurso (miembro_id, dow);

alter table horarios_recurso enable row level security;

-- Lee cualquiera (el motor de disponibilidad corre también en el
-- navegador); administra el dueño del negocio o un admin.
drop policy if exists "Horarios visibles para todos" on horarios_recurso;
create policy "Horarios visibles para todos" on horarios_recurso
  for select to anon, authenticated
  using (true);

drop policy if exists "El dueño administra los horarios" on horarios_recurso;
create policy "El dueño administra los horarios" on horarios_recurso
  for all to authenticated
  using (
    exists (
      select 1 from equipo_rancho e
      join ranchos r on r.id = e.rancho_id
      where e.id = miembro_id and (r.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from equipo_rancho e
      join ranchos r on r.id = e.rancho_id
      where e.id = miembro_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

grant select on horarios_recurso to anon;
grant select, insert, update, delete on horarios_recurso to authenticated;

-- ------------------------------------------------------------
-- 5. bloqueos_agenda — vacaciones, días libres, horas bloqueadas
--    miembro_id null = bloquea el negocio completo.
-- ------------------------------------------------------------
create table if not exists bloqueos_agenda (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  miembro_id uuid references equipo_rancho(id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz not null check (fin > inicio),
  -- El motivo es privado del negocio: la vista pública no lo expone.
  motivo text check (motivo is null or char_length(motivo) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists bloqueos_agenda_rango_idx
  on bloqueos_agenda (rancho_id, miembro_id, inicio, fin);

alter table bloqueos_agenda enable row level security;

-- La tabla base es solo del dueño (el motivo puede ser personal);
-- el público consume la VISTA de abajo, sin motivo.
drop policy if exists "El dueño administra sus bloqueos" on bloqueos_agenda;
create policy "El dueño administra sus bloqueos" on bloqueos_agenda
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

grant select, insert, update, delete on bloqueos_agenda to authenticated;

-- Lo único que el cliente necesita para pintar disponibilidad:
-- cuándo NO se puede — jamás el porqué. (La vista corre con los
-- permisos de su dueño, por eso el grant alcanza.)
create or replace view bloqueos_agenda_publicos as
select rancho_id, miembro_id, inicio, fin
from bloqueos_agenda;

grant select on bloqueos_agenda_publicos to anon, authenticated;

-- ------------------------------------------------------------
-- 6. Estados de asistencia en reservas + marcas de tiempo
--    (temporal/pendiente/confirmada/rechazada/bloqueada ya existían)
-- ------------------------------------------------------------
alter table reservas drop constraint if exists reservas_estado_check;
alter table reservas add constraint reservas_estado_check
  check (estado in (
    'temporal', 'pendiente', 'confirmada', 'rechazada', 'bloqueada',
    'cumplida', 'no_asistio', 'cancelada'
  ));

alter table reservas add column if not exists cumplida_en timestamptz;
alter table reservas add column if not exists no_asistio_en timestamptz;
alter table reservas add column if not exists cancelada_en timestamptz;

-- La agenda del recurso se consulta por persona y rango de tiempo.
create index if not exists reservas_miembro_fecha_idx
  on reservas (miembro_id, fecha, hora_inicio)
  where miembro_id is not null;

notify pgrst, 'reload schema';
