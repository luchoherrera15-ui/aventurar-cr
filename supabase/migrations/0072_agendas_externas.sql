-- ============================================================
-- BOOKEA — Sincronizar agendas viejas (Google/Apple → Bookea)
--
-- El proveedor pega la dirección .ics privada de su calendario de
-- siempre y Bookea importa sus compromisos como bloqueos: esas horas
-- y fechas dejan de ofrecerse en el sitio y en la app. Aplica a las
-- tres verticales (eventos, citas, hospedajes).
--
-- 1. `agendas_externas`: los calendarios conectados de cada negocio
--    (URL, última sincronización, conteo y último error). Solo el
--    dueño los ve y administra; la URL es un secreto (la "dirección
--    secreta en formato iCal" de Google) y por eso jamás va en
--    `ranchos`, que es pública.
--
-- 2. Los eventos importados viven en `reservas` con estado
--    'bloqueada' y origen 'sync' (+ su uid externo para poder
--    actualizar/borrar en cada refresco sin duplicar).
--
-- 3. Las vistas de disponibilidad pasan a contar 'bloqueada': hasta
--    hoy ese estado existía en el check pero NINGÚN flujo lo miraba —
--    un bloqueo no bloqueaba nada. Ahora un bloqueo (importado o
--    manual) tapa el día en eventos/hospedajes y su franja en citas.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- 1. Los calendarios externos conectados.
create table if not exists agendas_externas (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  nombre text not null default 'Mi calendario',
  url text not null,
  ultima_sync timestamptz,
  ultimo_error text,
  eventos_importados int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists agendas_externas_rancho_idx on agendas_externas (rancho_id);

alter table agendas_externas enable row level security;

drop policy if exists "El dueño administra sus agendas externas" on agendas_externas;
create policy "El dueño administra sus agendas externas" on agendas_externas
  for all to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  )
  with check (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

grant select, insert, update, delete on agendas_externas to authenticated;
grant all on agendas_externas to service_role;

-- 2. La huella de lo importado en `reservas`.
alter table reservas drop constraint if exists reservas_origen_check;
alter table reservas add constraint reservas_origen_check
  check (origen in ('web', 'movil', 'manual', 'sync'));

alter table reservas add column if not exists sync_uid text;
alter table reservas add column if not exists agenda_externa_id uuid
  references agendas_externas(id) on delete cascade;

-- El mismo evento externo nunca se importa dos veces.
create unique index if not exists reservas_sync_uid_unica
  on reservas (agenda_externa_id, sync_uid)
  where sync_uid is not null;

-- 3. Que 'bloqueada' bloquee de verdad.

-- Eventos/hospedajes: el día (o rango de días) queda tomado.
create or replace view disponibilidad_rancho as
  select d.dia::date as fecha, r.estado, r.rancho_id
  from reservas r
  cross join lateral generate_series(
    r.fecha, coalesce(r.fecha_fin, r.fecha), interval '1 day'
  ) as d(dia)
  where r.estado in ('pendiente', 'confirmada', 'bloqueada')
     or (r.estado = 'temporal' and r.expira_en > now());

grant select on disponibilidad_rancho to anon, authenticated;

-- Citas: la franja horaria choca contra los espacios libres. Los
-- bloqueos de día completo se importan como 00:00 + 1440 minutos, así
-- que tapan todos los espacios de ese día.
create or replace view disponibilidad_citas as
select rancho_id, fecha, hora_inicio, duracion_minutos, miembro_id
from reservas
where estado in ('confirmada', 'bloqueada') and hora_inicio is not null;

grant select on disponibilidad_citas to anon, authenticated;

notify pgrst, 'reload schema';
