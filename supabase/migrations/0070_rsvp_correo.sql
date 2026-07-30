-- ============================================================
-- BOOKEA — Correo del invitado en cada confirmación (RSVP)
--
-- El tablero del anfitrión (/cuenta/evento/{id}) pasa a mostrar
-- quiénes vienen y quiénes no CON su contacto: el formulario de
-- la invitación pide un correo opcional y acá se guarda.
--
-- Columna nullable a propósito: las confirmaciones viejas y quien
-- prefiera no dejar correo siguen valiendo igual. Las políticas de
-- 0066 ya cubren la columna (el grant es por tabla): los invitados
-- solo insertan, y leerla puede únicamente el dueño o un admin.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table invitacion_rsvp add column if not exists correo text;

notify pgrst, 'reload schema';
