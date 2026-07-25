-- ============================================================
-- AVENTUREA CR — Reintento seguro de la migración de reserva
-- temporal. Se puede correr las veces que haga falta sin error,
-- aunque ya hayas corrido parte de la 0004 antes.
-- Correr en una pestaña nueva y vacía del SQL Editor de Supabase.
-- ============================================================

alter table reservas alter column nombre drop not null;
alter table reservas alter column contacto drop not null;
alter table reservas alter column tipo_evento drop not null;

alter table reservas drop constraint if exists reservas_estado_check;
alter table reservas add constraint reservas_estado_check
  check (estado in ('temporal', 'pendiente', 'confirmada', 'rechazada', 'bloqueada'));

alter table reservas add column if not exists expira_en timestamptz;
alter table reservas add column if not exists horario_bloque text;
alter table reservas drop constraint if exists reservas_horario_bloque_check;
alter table reservas add constraint reservas_horario_bloque_check
  check (horario_bloque in ('manana_tarde', 'tarde_noche'));
alter table reservas add column if not exists terminos_aceptados boolean not null default false;

alter table configuracion_rancho add column if not exists deposito_reserva numeric not null default 25000;

create or replace view disponibilidad_rancho as
  select fecha, estado
  from reservas
  where estado in ('pendiente', 'confirmada')
     or (estado = 'temporal' and expira_en > now());

grant select on disponibilidad_rancho to anon, authenticated;

-- ------------------------------------------------------------
-- SEGURIDAD (RLS) — se vuelven a crear limpias, sin duplicados
-- ------------------------------------------------------------

drop policy if exists "Cualquiera crea una reserva pendiente" on reservas;
drop policy if exists "Cualquiera crea una reserva o un hold temporal" on reservas;
drop policy if exists "Cualquiera completa su propio hold temporal" on reservas;
drop policy if exists "Cualquiera borra un hold temporal ya vencido" on reservas;

create policy "Cualquiera crea una reserva o un hold temporal"
  on reservas for insert
  to anon, authenticated
  with check (estado in ('pendiente', 'temporal'));

create policy "Cualquiera completa su propio hold temporal"
  on reservas for update
  to anon, authenticated
  using (estado = 'temporal')
  with check (estado in ('temporal', 'pendiente'));

create policy "Cualquiera borra un hold temporal ya vencido"
  on reservas for delete
  to anon, authenticated
  using (estado = 'temporal' and expira_en < now());
