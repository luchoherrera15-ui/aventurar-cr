-- ============================================================
-- AVENTUREA CR — Número de cédula del cliente en cada reserva
-- (solo el número, sin foto de documento), para poder identificar
-- a quien reserva en caso de daños o problemas en el evento.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table reservas add column if not exists cedula text;

alter table reservas drop constraint if exists reservas_cedula_check;
alter table reservas add constraint reservas_cedula_check
  check (cedula is null or cedula ~ '^[0-9-]{7,14}$');
