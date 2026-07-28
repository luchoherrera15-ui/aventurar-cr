-- ------------------------------------------------------------
-- Recordatorio de evento (1 día antes): el cron de Vercel manda el
-- correo al cliente y al proveedor, y marca la reserva para no
-- avisar dos veces.
-- ------------------------------------------------------------

alter table reservas add column if not exists recordatorio_enviado boolean not null default false;
