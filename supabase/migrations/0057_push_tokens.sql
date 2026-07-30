-- ============================================================
-- BOOKEA — Notificaciones push (0057)
--
-- 1. push_tokens: el token de Expo Push de cada dispositivo con
--    sesión. Un token pertenece a UN usuario (el último que inició
--    sesión en ese teléfono) — por eso el token es la llave primaria
--    y el upsert lo reasigna al cambiar de cuenta.
-- 2. mensajes.push_enviado: bandera de una-sola-vez para el aviso
--    push de cada mensaje, el mismo patrón de confirmacion_enviada /
--    aprobacion_enviada en reservas.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

create table if not exists push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plataforma text,
  device_id text,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

-- Cada quien registra y borra solo sus tokens; los envíos del
-- servidor usan la service key, que no pasa por estas políticas.
drop policy if exists "Cada quien maneja sus tokens" on push_tokens;
create policy "Cada quien maneja sus tokens" on push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on push_tokens to authenticated;

alter table mensajes add column if not exists push_enviado boolean not null default false;
