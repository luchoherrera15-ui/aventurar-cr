-- ============================================================
-- BOOKEA — La invitación impresa es una pieza propia (0084)
--
-- El primer intento imprimía el MISMO HTML de la invitación digital
-- con reglas de @media print. Sale mal y no tiene arreglo por CSS: un
-- diseño pensado para desplazarse por secciones a pantalla completa
-- ocupa cinco hojas mal cortadas, con la mitad en blanco.
--
-- Lo que el papel necesita es otra composición: UNA hoja, con la misma
-- identidad — fondo, paleta, tipografía, los motivos del diseño — pero
-- armada para leerse de un vistazo. Eso es un documento nuevo, no una
-- versión reformateada, así que se guarda aparte.
--
--   `invitaciones.html_impresion`  — el HTML de una hoja. Null = todavía
--   no se generó; la pantalla de imprimir lo ofrece.
--   `invitaciones.impresion_generada_en` — cuándo se armó, para saber si
--   quedó vieja respecto del diseño digital.
--
-- Se suma también el modelo del agente nuevo a la configuración de IA
-- (0078), para que el panel /admin/ia lo gobierne como a los demás.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table invitaciones
  add column if not exists html_impresion text,
  add column if not exists impresion_generada_en timestamptz;

comment on column invitaciones.html_impresion is
  'La invitación compuesta para UNA hoja. Es una pieza aparte del diseño digital, no el mismo HTML reformateado.';
comment on column invitaciones.impresion_generada_en is
  'Cuándo se generó la versión impresa. Si es anterior al último cambio del diseño digital, conviene regenerarla.';

alter table configuracion_plataforma
  add column if not exists ia_modelo_imprimir text not null default 'claude-opus-5';

notify pgrst, 'reload schema';
