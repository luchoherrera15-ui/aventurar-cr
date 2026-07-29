-- ------------------------------------------------------------
-- Permisos del service_role — nunca los tuvo y nadie lo notó.
--
-- En este proyecto los permisos base de las tablas se otorgan a mano
-- (ver 0002_grants.sql), y en toda la historia se otorgaron solo a
-- anon y authenticated. El rol service_role — el que usa el servidor
-- con la Secret key para mandar los correos de reserva, el
-- recordatorio del día antes y el auto-cobro — quedó sin ninguno:
-- la llave autenticaba bien y la base le negaba cada tabla con
-- "permission denied". Por eso ningún correo de reserva salía aunque
-- Resend estuviera perfecto.
--
-- Se otorga sobre todo lo existente y se deja configurado para que
-- las tablas futuras nazcan con el permiso (service_role es la llave
-- del servidor: RLS ni la mira, el permiso de tabla es lo único que
-- le faltaba).
--
-- De paso: authenticated puede leer reserva_items (0050 creó la tabla
-- con su política RLS pero sin el grant base, mismo olvido).
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

-- Las tablas que se creen de acá en adelante nacen con el permiso.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- El grant que 0050 omitió: la política RLS ya limita cada línea a su
-- reserva (equipo, cliente o dueño del negocio); esto solo habilita el
-- permiso de fondo para que esa política pueda aplicarse.
grant select on reserva_items to authenticated;

notify pgrst, 'reload schema';
