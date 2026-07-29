-- ------------------------------------------------------------
-- Aviso de reserva nueva: el correo de confirmación al cliente y el
-- aviso al dueño del lugar salen UNA sola vez por reserva.
--
-- Esta bandera es la que lo garantiza. No se marca "después de
-- enviar" sino dentro del mismo UPDATE con el que se reclama la
-- reserva, para que dos llamadas al mismo tiempo (la app reintentando)
-- no manden correos repetidos: la primera reclama, la segunda ya no
-- encuentra nada que hacer. Importa más que en el recordatorio porque
-- acá el que dispara el envío es un endpoint público — el que usa la
-- app móvil, que no tiene servidor propio.
--
-- Mismo patrón que `recordatorio_enviado` (0038).
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

alter table reservas add column if not exists confirmacion_enviada boolean not null default false;

-- Las reservas que YA existían no deben poder disparar correos viejos
-- apenas salga la columna: se marcan como avisadas de una vez. Los
-- holds 'temporal' se dejan en false a propósito — todavía no se
-- completaron, y cuando lo hagan sí les toca su correo. El margen de
-- 1 hora permite volver a correr esta migración sin apagarle el correo
-- a una reserva recién hecha que todavía no se avisó.
update reservas
set confirmacion_enviada = true
where estado <> 'temporal'
  and confirmacion_enviada = false
  and created_at < now() - interval '1 hour';

notify pgrst, 'reload schema';
