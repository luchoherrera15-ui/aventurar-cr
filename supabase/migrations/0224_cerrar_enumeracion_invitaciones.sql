-- ============================================================
--  SEGURIDAD · cerrar (de verdad) la enumeración de invitaciones
-- ============================================================
--
-- La 0221 había cortado la lectura anónima directa de `invitaciones`
-- (para que nadie enumere nombres, fechas y direcciones de casa con un
-- `GET /rest/v1/invitaciones`), pero se aplicó ANTES de desplegar el
-- código que lee por la función `invitacion_por_slug` — y el sitio en
-- vivo, con el código viejo, empezó a dar 404. Por eso la 0223 restauró
-- la lectura anónima como parche temporal.
--
-- Ahora el código nuevo YA está desplegado en producción (lee por
-- `invitacion_por_slug` / `invitacion_paleta_por_id`, funciones
-- security-definer verificadas), así que se vuelve a cerrar la lectura
-- directa. Esta es la contraparte de la 0223: reaplica lo que la 0221
-- había hecho con `invitaciones`.
--
-- Qué NO se rompe: /i/{slug} y /a/{slug} leen por las funciones (probado
-- en vivo); el cliente ve las suyas por la policy `cliente_id=auth.uid`;
-- el admin por la policy de admin; el RSVP anónimo por
-- `invitacion_esta_activa`. Ninguno depende de esta lectura de tabla.

drop policy if exists "Cualquiera ve las invitaciones activas" on public.invitaciones;

revoke select on public.invitaciones from anon;

notify pgrst, 'reload schema';
