-- ============================================================
-- AVENTUREA CR — Reserva temporal (hold de 10 min), horario por
-- bloques, términos y condiciones, y depósito fijo de reserva.
-- Correr en una pestaña nueva y vacía del SQL Editor de Supabase.
-- ============================================================

-- Los holds temporales se crean sin nombre/contacto/tipo de evento
-- todavía (eso se completa recién si la persona termina el formulario).
alter table reservas alter column nombre drop not null;
alter table reservas alter column contacto drop not null;
alter table reservas alter column tipo_evento drop not null;

-- Nuevo estado "temporal" para el hold de 10 minutos.
alter table reservas drop constraint reservas_estado_check;
alter table reservas add constraint reservas_estado_check
  check (estado in ('temporal', 'pendiente', 'confirmada', 'rechazada', 'bloqueada'));

alter table reservas add column if not exists expira_en timestamptz;
alter table reservas add column if not exists horario_bloque text
  check (horario_bloque in ('manana_tarde', 'tarde_noche'));
alter table reservas add column if not exists terminos_aceptados boolean not null default false;

-- Depósito fijo para reservar (configurable desde el panel admin).
alter table configuracion_rancho add column if not exists deposito_reserva numeric not null default 25000;

-- La vista pública ahora también muestra los holds temporales vigentes
-- (los vencidos no cuentan, quedan fuera automáticamente).
create or replace view disponibilidad_rancho as
  select fecha, estado
  from reservas
  where estado in ('pendiente', 'confirmada')
     or (estado = 'temporal' and expira_en > now());

-- ------------------------------------------------------------
-- SEGURIDAD (RLS) — ajustes para el nuevo flujo de dos pasos
-- ------------------------------------------------------------

drop policy if exists "Cualquiera crea una reserva pendiente" on reservas;

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
