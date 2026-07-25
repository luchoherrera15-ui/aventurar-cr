-- ============================================================
-- AVENTUREA CR — Esquema inicial de base de datos
-- Correr una sola vez en el SQL Editor de Supabase (proyecto bjhprmtobmualefvcmau)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- RANCHO DE EVENTOS
-- ------------------------------------------------------------

create table reservas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  nombre text not null,
  contacto text not null,
  tipo_evento text not null,
  invitados integer,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmada', 'rechazada', 'bloqueada')),
  monto_total numeric,
  metodo_pago text check (metodo_pago in ('sinpe', 'transferencia')),
  deposito_monto numeric,
  deposito_comprobante_url text,
  deposito_validado boolean not null default false,
  evento_pagado boolean not null default false,
  notas text,
  origen text not null default 'web' check (origen in ('web', 'manual')),
  created_at timestamptz not null default now()
);

-- Regla crítica de negocio: varias reservas pueden estar "pendiente" para la
-- misma fecha, pero solo UNA puede llegar a "confirmada". La base de datos lo
-- impide sola, incluso si el equipo confirma dos por error el mismo momento.
create unique index unique_confirmed_date on reservas (fecha) where estado = 'confirmada';

create table precio_tiers (
  id uuid primary key default gen_random_uuid(),
  min_invitados integer not null,
  max_invitados integer not null,
  precio numeric not null
);

create table servicios_adicionales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric not null default 0,
  requisito_max_invitados integer,
  activo boolean not null default true
);

-- Fila única de configuración general del rancho (hoy solo la tarifa de diciembre).
create table configuracion_rancho (
  id boolean primary key default true,
  tarifa_diciembre_por_persona numeric not null default 3750,
  constraint configuracion_rancho_fila_unica check (id)
);
insert into configuracion_rancho (id) values (true);

-- Precios y servicio de referencia (los mismos valores que ya tenían en admin.html).
insert into precio_tiers (min_invitados, max_invitados, precio) values
  (1, 25, 80000),
  (26, 30, 100000),
  (31, 50, 150000),
  (51, 100, 300000);

insert into servicios_adicionales (nombre, precio, requisito_max_invitados, activo) values
  ('Hospedaje en Chalet Alajuela (2 habitaciones, máx. 4 personas c/u)', 0, 8, false);

-- ------------------------------------------------------------
-- CASA PUNTALEONA / CHALET ALAJUELA
-- ------------------------------------------------------------

create table propiedades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
);
insert into propiedades (nombre) values ('Casa Puntaleona'), ('Chalet Alajuela');

create table bloqueos (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references propiedades(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  origen text not null check (origen in ('reserva_directa', 'airbnb', 'manual')),
  -- Referencia opcional a una futura reserva de propiedad; todavía no existe esa
  -- tabla (se construye en el paso 4 del brief), por eso no tiene FK todavía.
  reserva_id uuid,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- VISTA PÚBLICA: solo fecha + estado, para pintar el calendario del rancho
-- sin exponer nombres, contactos ni comprobantes de otros clientes.
-- ------------------------------------------------------------

create view disponibilidad_rancho as
  select fecha, estado
  from reservas
  where estado in ('pendiente', 'confirmada');

-- ============================================================
-- SEGURIDAD (Row Level Security)
-- ============================================================

alter table reservas enable row level security;
alter table precio_tiers enable row level security;
alter table servicios_adicionales enable row level security;
alter table configuracion_rancho enable row level security;
alter table propiedades enable row level security;
alter table bloqueos enable row level security;

-- reservas: cualquier visitante puede enviar una solicitud, siempre "pendiente".
create policy "Cualquiera crea una reserva pendiente"
  on reservas for insert
  to anon, authenticated
  with check (estado = 'pendiente');

-- reservas: solo el equipo autenticado ve/edita/borra los datos completos
-- (nombre, contacto, comprobante, etc.) directamente en la tabla.
create policy "El equipo ve todas las reservas"
  on reservas for select
  to authenticated
  using (true);

create policy "El equipo edita las reservas"
  on reservas for update
  to authenticated
  using (true);

create policy "El equipo borra reservas"
  on reservas for delete
  to authenticated
  using (true);

-- precios, servicios y configuración: visibles para todos (se usan en el
-- cotizador público del sitio); solo el equipo autenticado los edita.
create policy "Todos ven los precios" on precio_tiers for select to anon using (true);
create policy "El equipo administra los precios" on precio_tiers for all to authenticated using (true) with check (true);

create policy "Todos ven los servicios" on servicios_adicionales for select to anon using (true);
create policy "El equipo administra los servicios" on servicios_adicionales for all to authenticated using (true) with check (true);

create policy "Todos ven la configuración" on configuracion_rancho for select to anon using (true);
create policy "El equipo administra la configuración" on configuracion_rancho for update to authenticated using (true) with check (true);

-- propiedades y bloqueos: visibles para todos (calendario de disponibilidad
-- de Puntaleona/Chalet); solo el equipo autenticado los edita.
create policy "Todos ven las propiedades" on propiedades for select to anon using (true);
create policy "El equipo administra las propiedades" on propiedades for all to authenticated using (true) with check (true);

create policy "Todos ven los bloqueos" on bloqueos for select to anon using (true);
create policy "El equipo administra los bloqueos" on bloqueos for all to authenticated using (true) with check (true);

grant select on disponibilidad_rancho to anon, authenticated;
