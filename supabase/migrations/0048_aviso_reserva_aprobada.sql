-- ------------------------------------------------------------
-- Aviso al cliente cuando el proveedor le aprueba la reserva.
--
-- Misma idea que `confirmacion_enviada` (0047): la bandera se reclama
-- dentro del mismo UPDATE que lee los datos, así el correo sale una
-- sola vez por reserva por más veces que se apruebe. Importa porque el
-- panel del móvil permite "quitar confirmación" y volver a confirmar:
-- sin la bandera, cada ida y vuelta le mandaría otro correo al cliente.
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

alter table reservas add column if not exists aprobacion_enviada boolean not null default false;

-- Las reservas que ya estaban confirmadas antes de esto no deben
-- disparar un "¡tu reserva quedó confirmada!" atrasado: se marcan como
-- avisadas de una vez. El margen de 1 hora permite volver a correr esta
-- migración sin apagarle el correo a una que se acaba de aprobar.
update reservas
set aprobacion_enviada = true
where estado = 'confirmada'
  and aprobacion_enviada = false
  and created_at < now() - interval '1 hour';

notify pgrst, 'reload schema';
