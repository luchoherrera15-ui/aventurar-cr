-- ------------------------------------------------------------
-- Recordatorio de cobro (la mañana del evento): el cron de
-- /api/recordatorios avisa al proveedor por correo y push que hoy
-- toca cobrar el saldo, y marca la reserva para no avisar dos veces.
-- No reemplaza el auto-cobro de la noche (/api/auto-cobro) — es un
-- aviso previo, ese cron se queda como red de seguridad.
-- ------------------------------------------------------------

alter table reservas add column if not exists recordatorio_cobro_enviado boolean not null default false;
