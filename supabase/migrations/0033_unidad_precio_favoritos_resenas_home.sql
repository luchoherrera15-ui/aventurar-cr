-- ============================================================
-- BOOKEAR CR — Fase 1 del rediseño: unidad de precio, favoritos,
-- reseñas y filas configurables del home.
--
-- La disponibilidad y el flujo de reserva NO cambian en esta
-- migración — se decidió a propósito mantener "un evento = un día
-- completo" (el índice unique_confirmed_date ya scopeado por
-- rancho_id no se toca) en vez de reservar por bloque de horas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Unidad de precio (hoy todo se mostraba como "por evento" sin
-- que existiera ningún dato detrás — catering es por persona,
-- photobooth por bloque de horas). Default 'evento' para no romper
-- ninguna publicación existente.
-- ------------------------------------------------------------

alter table ranchos add column if not exists unidad_precio text not null default 'evento';
alter table ranchos drop constraint if exists ranchos_unidad_precio_check;
alter table ranchos add constraint ranchos_unidad_precio_check
  check (unidad_precio in ('evento', 'persona', 'hora', 'bloque_horas'));

-- ------------------------------------------------------------
-- 2. Favoritos — solo para cuentas con sesión (rol cliente, dueño o
-- admin da igual; lo que importa es que sea SU lista).
-- ------------------------------------------------------------

create table if not exists favoritos (
  cliente_id uuid not null references auth.users(id) on delete cascade,
  rancho_id uuid not null references ranchos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, rancho_id)
);

alter table favoritos enable row level security;

drop policy if exists "Cada quien ve sus favoritos" on favoritos;
create policy "Cada quien ve sus favoritos" on favoritos
  for select to authenticated
  using (cliente_id = auth.uid());

drop policy if exists "Cada quien agrega sus favoritos" on favoritos;
create policy "Cada quien agrega sus favoritos" on favoritos
  for insert to authenticated
  with check (cliente_id = auth.uid());

drop policy if exists "Cada quien quita sus favoritos" on favoritos;
create policy "Cada quien quita sus favoritos" on favoritos
  for delete to authenticated
  using (cliente_id = auth.uid());

grant select, insert, delete on favoritos to authenticated;

-- ------------------------------------------------------------
-- 3. Reseñas — solo de quien tuvo una reserva confirmada con ese
-- proveedor, una reseña por reserva. Lectura pública (la calificación
-- se muestra en el directorio a cualquiera, con o sin sesión).
-- ------------------------------------------------------------

create table if not exists resenas (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  cliente_id uuid not null references auth.users(id) on delete cascade,
  reserva_id uuid not null references reservas(id) on delete cascade,
  calificacion integer not null check (calificacion between 1 and 5),
  comentario text,
  created_at timestamptz not null default now(),
  unique (reserva_id)
);

alter table resenas enable row level security;

drop policy if exists "Cualquiera lee las reseñas" on resenas;
create policy "Cualquiera lee las reseñas" on resenas
  for select to anon, authenticated
  using (true);

drop policy if exists "El cliente reseña su propia reserva confirmada" on resenas;
create policy "El cliente reseña su propia reserva confirmada" on resenas
  for insert to authenticated
  with check (
    cliente_id = auth.uid()
    and exists (
      select 1 from reservas r
      where r.id = reserva_id
        and r.cliente_id = auth.uid()
        and r.rancho_id = resenas.rancho_id
        and r.estado = 'confirmada'
    )
  );

drop policy if exists "El cliente edita o borra su propia reseña" on resenas;
create policy "El cliente edita su propia reseña" on resenas
  for update to authenticated
  using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid());

drop policy if exists "El cliente borra su propia reseña" on resenas;
create policy "El cliente borra su propia reseña" on resenas
  for delete to authenticated
  using (cliente_id = auth.uid());

grant select on resenas to anon;
grant select, insert, update, delete on resenas to authenticated;

-- Promedio + cantidad por rancho en una sola consulta — así el
-- directorio no hace una consulta de reseñas por cada tarjeta.
create or replace view calificaciones_rancho as
  select rancho_id, round(avg(calificacion)::numeric, 2) as promedio, count(*) as total
  from resenas
  group by rancho_id;

grant select on calificaciones_rancho to anon, authenticated;

-- ------------------------------------------------------------
-- 4. Filas configurables del home ("Ranchos populares en Alajuela",
-- "Catering para tu evento"...). Administrables desde /admin, sin
-- depender de un deploy para cambiar qué se muestra.
--
-- Por ahora todas ordenan por más reciente (`created_at desc`): el
-- ranking por "populares" queda pensado para cuando exista la
-- suscripción paga que decide quién se destaca — no está wireado
-- todavía a propósito, para no fingir un orden que no es real.
-- ------------------------------------------------------------

create table if not exists home_secciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('categoria', 'ubicacion', 'manual')),
  titulo text not null,
  subtitulo text,
  categoria text,
  subcategoria text,
  provincia text,
  canton text,
  rancho_ids uuid[],
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table home_secciones enable row level security;

drop policy if exists "Cualquiera ve las secciones activas del home" on home_secciones;
create policy "Cualquiera ve las secciones activas del home" on home_secciones
  for select to anon, authenticated
  using (activo = true or is_admin());

drop policy if exists "El admin administra las secciones del home" on home_secciones;
create policy "El admin administra las secciones del home" on home_secciones
  for all to authenticated
  using (is_admin())
  with check (is_admin());

grant select on home_secciones to anon;
grant select, insert, update, delete on home_secciones to authenticated;

notify pgrst, 'reload schema';
