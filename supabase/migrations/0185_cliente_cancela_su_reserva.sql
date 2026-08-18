-- ============================================================
-- El CLIENTE puede cancelar su propia reserva, con motivo
--
-- Hasta ahora "cancelar" solo existía del lado del negocio
-- (mi-negocio/[id]/agenda-actions.ts, cancelarReserva) — el cliente no
-- tenía ningún botón para cancelar la suya, ni en la web ni en la app.
--
-- La política de UPDATE de `reservas` (0011) solo deja tocar una fila
-- al dueño del rancho o al admin (`rancho_id in (select id from
-- ranchos where owner_id = auth.uid())`) — el cliente nunca entraba
-- ahí. Esta migración agrega una política HERMANA, con el mismo estilo
-- que ya usa `resenas` (0033) para "el cliente edita lo suyo": scoped
-- por `cliente_id = auth.uid()`, no un bypass con la llave de
-- servicio.
--
-- Acotada a propósito: solo puede pasar de pendiente/confirmada a
-- cancelada — no puede reescribir ningún otro estado ni ninguna otra
-- columna con valor distinto de lo que ya tenía (salvo las tres que
-- esta acción sí toca). El motivo es NULL-able en la columna (una
-- reserva cancelada por el NEGOCIO sigue sin motivo, como siempre) pero
-- la action del cliente lo exige como texto obligatorio antes de
-- llamar a esto.
--
-- Sin restricción de horario: el dueño confirmó que se puede cancelar
-- el mismo día. La plata NO se toca acá -mismo criterio que
-- cancelarReserva: un adelanto ya validado queda retenido por
-- política, y el negocio lo devuelve a mano si corresponde.
-- ============================================================

alter table reservas add column if not exists motivo_cancelacion text;

drop policy if exists "El cliente cancela su propia reserva" on reservas;
create policy "El cliente cancela su propia reserva"
  on reservas for update
  to authenticated
  using (cliente_id = auth.uid() and estado in ('pendiente', 'confirmada'))
  with check (estado = 'cancelada');

notify pgrst, 'reload schema';
