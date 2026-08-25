
-- ─────────────────────────────────────────────────────────────────────
-- 0208: el logo que llevan las NOTIFICACIONES del pase, aparte del logo
-- de la tarjeta.
--
-- `pase_logo_url` (0122) es el logo que se DIBUJA en la tarjeta: arriba
-- a la izquierda y dentro de cada círculo del sello. Esta columna es
-- otra cosa — el logo que Apple/Google Wallet muestran en el AVISO
-- (lock screen / centro de notificaciones) cuando el pase se actualiza,
-- que en los dos sistemas es una imagen aparte de la tarjeta misma.
--
-- Nace SOLO como columna: el campo del panel para subirla ya existe
-- (0208, TarjetaFormulario), pero el envío real de notificaciones de
-- Wallet ("Pases Apple: actualización automática") todavía NO la lee —
-- eso es una pasada aparte, a propósito, para no tocar el sistema de
-- push en producción sin revisarlo con calma. Hasta que se cablee, esta
-- columna se guarda y no hace nada más.
-- ─────────────────────────────────────────────────────────────────────

alter table programa_lealtad add column if not exists pase_notificacion_logo_url text;

alter table programa_lealtad drop constraint if exists programa_lealtad_pase_notificacion_logo_check;
alter table programa_lealtad add constraint programa_lealtad_pase_notificacion_logo_check
  check (pase_notificacion_logo_url is null or pase_notificacion_logo_url ~ '^https://');

comment on column programa_lealtad.pase_notificacion_logo_url is
  'Logo para el AVISO de Wallet cuando el pase se actualiza (0208) — '
  'NO se dibuja en la tarjeta, eso es pase_logo_url (0122). Guardado '
  'desde el panel; el envío real de notificaciones todavía no lo usa.';
