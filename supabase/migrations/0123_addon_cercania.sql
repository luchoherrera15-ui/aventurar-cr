
-- ============================================================
-- BOOKEA — El aviso por cercanía es de pago (0123)
--
-- Un pase de Wallet puede llevar coordenadas. Con ellas el iPhone
-- muestra la tarjeta en la PANTALLA BLOQUEADA cuando el cliente pasa
-- cerca del local — sin abrir nada, sin push, sin servidor: lo hace
-- iOS solo.
--
-- Técnicamente sale gratis, y esa es justamente la razón para NO
-- regalarlo: es de las cosas que más devuelven gente al local y no
-- tiene equivalente a mano. Va como complemento aparte, que es lo que
-- después va a encender el plan más alto.
--
-- ------------------------------------------------------------
-- POR QUÉ UN COMPLEMENTO Y NO UNA COLUMNA
-- ------------------------------------------------------------
-- Podría ser un booleano en `programa_lealtad`, pero entonces el dueño
-- podría encendérselo solo: esa tabla la escribe él. `addons_negocio`
-- es solo-servidor desde la 0077 — el dueño no se puede auto-regalar
-- un complemento, que es exactamente la propiedad que se necesita
-- para algo que se cobra.
--
-- Cuando existan los planes, el plan alto activa este complemento. La
-- pantalla no cambia: sigue preguntando `tiene_addon()`.
--
-- ------------------------------------------------------------
-- LA LISTA COMPLETA, OTRA VEZ
-- ------------------------------------------------------------
-- `drop` + `add` reemplaza el check ENTERO. Hay que repetir TODOS los
-- valores vigentes, no solo el nuevo:
--
--   0077  'agenda_ia', 'lealtad'
--   0090  + 'asistente_ia'
--   0122  + 'pases'
--   0123  + 'pases_cercania'   (acá)
--
-- Omitir uno aborta con 23514 contra las filas existentes. Comprobar
-- antes con:  select distinct addon from addons_negocio;
-- ============================================================

alter table addons_negocio drop constraint if exists addons_negocio_addon_check;
alter table addons_negocio add constraint addons_negocio_addon_check
  check (addon in ('agenda_ia', 'lealtad', 'asistente_ia', 'pases', 'pases_cercania'));
