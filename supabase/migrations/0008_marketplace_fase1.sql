-- ============================================================
-- AVENTUREA CR — Fase 1 del marketplace de ranchos: perfiles con
-- roles (admin / dueño de rancho), función de apoyo para RLS, y
-- la tabla de ranchos. También migra el rancho actual de
-- Aventurea CR para que sea el primer registro (ya aprobado).
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- PERFILES (el rol de cada cuenta: admin o dueño de rancho)
-- ------------------------------------------------------------

create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre text,
  rol text not null default 'dueno_rancho' check (rol in ('admin', 'dueno_rancho')),
  created_at timestamptz not null default now()
);

alter table perfiles enable row level security;

-- Función de apoyo para las políticas de seguridad. Es "security definer"
-- a propósito: evita que revisar el rol de alguien dispare una y otra vez
-- la política de la propia tabla perfiles (recursión infinita).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Cada quien ve su propio perfil" on perfiles;
create policy "Cada quien ve su propio perfil"
  on perfiles for select
  to authenticated
  using (id = auth.uid() or is_admin());

grant select on perfiles to authenticated;

-- Crea automáticamente el perfil (rol "dueno_rancho" por defecto) apenas
-- alguien se registra desde /mi-rancho/registro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, email, nombre, rol)
  values (new.id, new.email, new.raw_user_meta_data->>'nombre', 'dueno_rancho')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Las cuentas que ya existían antes de este cambio (en la práctica, tu
-- cuenta de admin) quedan marcadas como "admin".
insert into perfiles (id, email, rol)
select id, email, 'admin' from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Ojo: antes de esto, CUALQUIER cuenta con sesión iniciada tenía
-- acceso total a reservas/precios/servicios (política "to authenticated
-- using (true)"). Eso era seguro mientras la única cuenta era la tuya,
-- pero ahora que va a haber cuentas de dueños de rancho hay que
-- restringirlo de verdad a cuentas con rol "admin".
-- ------------------------------------------------------------

drop policy if exists "El equipo ve todas las reservas" on reservas;
create policy "El equipo ve todas las reservas" on reservas
  for select to authenticated using (is_admin());

drop policy if exists "El equipo edita las reservas" on reservas;
create policy "El equipo edita las reservas" on reservas
  for update to authenticated using (is_admin());

drop policy if exists "El equipo borra reservas" on reservas;
create policy "El equipo borra reservas" on reservas
  for delete to authenticated using (is_admin());

drop policy if exists "El equipo administra los precios" on precio_tiers;
create policy "El equipo administra los precios" on precio_tiers
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "El equipo administra los servicios" on servicios_adicionales;
create policy "El equipo administra los servicios" on servicios_adicionales
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "El equipo administra la configuración" on configuracion_rancho;
create policy "El equipo administra la configuración" on configuracion_rancho
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "El equipo administra las propiedades" on propiedades;
create policy "El equipo administra las propiedades" on propiedades
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "El equipo administra los bloqueos" on bloqueos;
create policy "El equipo administra los bloqueos" on bloqueos
  for all to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- RANCHOS (el directorio del marketplace)
-- ------------------------------------------------------------

create table if not exists ranchos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  descripcion text,
  provincia text check (
    provincia in ('San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón')
  ),
  canton text,
  capacidad_min integer,
  capacidad_max integer,
  precio_desde numeric,
  contacto_whatsapp text,
  fotos jsonb not null default '[]'::jsonb,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  created_at timestamptz not null default now()
);

alter table ranchos enable row level security;

drop policy if exists "Todos ven los ranchos aprobados" on ranchos;
create policy "Todos ven los ranchos aprobados" on ranchos
  for select to anon, authenticated
  using (estado = 'aprobado' or owner_id = auth.uid() or is_admin());

drop policy if exists "Un dueño crea su propio rancho" on ranchos;
create policy "Un dueño crea su propio rancho" on ranchos
  for insert to authenticated
  with check (owner_id = auth.uid() and estado = 'pendiente');

drop policy if exists "Un dueño edita su propio rancho" on ranchos;
create policy "Un dueño edita su propio rancho" on ranchos
  for update to authenticated
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

grant select on ranchos to anon, authenticated;
grant insert, update on ranchos to authenticated;

-- Un dueño (no-admin) no se puede auto-aprobar: si intenta cambiar el
-- estado del rancho, se lo dejamos como estaba antes de guardar.
create or replace function public.rancho_bloquear_estado_no_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    new.estado := old.estado;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rancho_bloquear_estado on ranchos;
create trigger trg_rancho_bloquear_estado
  before update on ranchos
  for each row execute function public.rancho_bloquear_estado_no_admin();

-- Migra el rancho actual de Aventurea CR como el primer registro del
-- directorio (ya aprobado, a nombre de tu cuenta admin).
insert into ranchos (
  owner_id, nombre, descripcion, provincia,
  capacidad_min, capacidad_max, precio_desde, estado
)
select
  p.id,
  'Aventurea CR — Rancho de Eventos',
  'Rancho para bodas, cumpleaños y eventos corporativos, con piscina, parrilla, área techada y parqueo privado.',
  'Puntarenas',
  (select min(min_invitados) from precio_tiers),
  (select max(max_invitados) from precio_tiers),
  (select min(precio) from precio_tiers),
  'aprobado'
from perfiles p
where p.rol = 'admin'
  and not exists (select 1 from ranchos r where r.nombre = 'Aventurea CR — Rancho de Eventos')
limit 1;
