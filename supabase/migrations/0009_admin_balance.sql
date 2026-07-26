-- ============================================================
-- AVENTUREA CR — Panel de administración completo + balances.
--   1. Las reservas ahora saben a qué rancho pertenecen.
--   2. Configuración de la comisión por persona (hoy ₡0 = gratis).
--   3. Tabla de gastos fijos (hosting, dominio, etc.).
--   4. Permisos para que el admin cree y administre ranchos ajenos.
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cada reserva pertenece a un rancho
-- ------------------------------------------------------------

alter table reservas
  add column if not exists rancho_id uuid references ranchos(id) on delete set null;

create index if not exists reservas_rancho_id_idx on reservas (rancho_id);

-- Las reservas que ya existían son todas del rancho de Aventurea CR.
update reservas
set rancho_id = (
  select id from ranchos where nombre = 'Aventurea CR — Rancho de Eventos' limit 1
)
where rancho_id is null;

-- El público puede escribir rancho_id al crear su reserva.
grant select, insert, update, delete on reservas to anon, authenticated;

-- ------------------------------------------------------------
-- 2. Configuración de la plataforma (comisión por persona)
-- ------------------------------------------------------------

create table if not exists configuracion_plataforma (
  id boolean primary key default true,
  comision_por_persona numeric not null default 0,
  constraint configuracion_plataforma_fila_unica check (id)
);

insert into configuracion_plataforma (id) values (true)
on conflict (id) do nothing;

alter table configuracion_plataforma enable row level security;

drop policy if exists "El admin ve la configuración de plataforma" on configuracion_plataforma;
create policy "El admin ve la configuración de plataforma"
  on configuracion_plataforma for select to authenticated using (is_admin());

drop policy if exists "El admin edita la configuración de plataforma" on configuracion_plataforma;
create policy "El admin edita la configuración de plataforma"
  on configuracion_plataforma for update to authenticated
  using (is_admin()) with check (is_admin());

grant select, update on configuracion_plataforma to authenticated;

-- ------------------------------------------------------------
-- 3. Gastos de la plataforma (hosting, dominio, etc.)
-- ------------------------------------------------------------

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  categoria text not null default 'otro'
    check (categoria in ('hosting', 'dominio', 'software', 'publicidad', 'otro')),
  monto numeric not null default 0,
  recurrencia text not null default 'unico'
    check (recurrencia in ('mensual', 'anual', 'unico')),
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists gastos_fecha_idx on gastos (fecha);

alter table gastos enable row level security;

drop policy if exists "El admin administra los gastos" on gastos;
create policy "El admin administra los gastos"
  on gastos for all to authenticated
  using (is_admin()) with check (is_admin());

grant select, insert, update, delete on gastos to authenticated;

-- ------------------------------------------------------------
-- 4. El admin puede crear/administrar ranchos de otras personas
-- ------------------------------------------------------------

drop policy if exists "Un dueño crea su propio rancho" on ranchos;
create policy "Un dueño crea su propio rancho" on ranchos
  for insert to authenticated
  with check ((owner_id = auth.uid() and estado = 'pendiente') or is_admin());

drop policy if exists "El admin borra ranchos" on ranchos;
create policy "El admin borra ranchos" on ranchos
  for delete to authenticated using (is_admin());

grant delete on ranchos to authenticated;

-- El admin puede cambiar el rol de una cuenta (por ejemplo, sumar
-- a otra persona como administradora).
drop policy if exists "El admin edita los perfiles" on perfiles;
create policy "El admin edita los perfiles" on perfiles
  for update to authenticated
  using (is_admin()) with check (is_admin());

grant update on perfiles to authenticated;
