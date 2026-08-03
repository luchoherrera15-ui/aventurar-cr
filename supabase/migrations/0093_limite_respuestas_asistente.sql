-- ------------------------------------------------------------
-- Límite de respuestas automáticas del asistente de IA, editable POR
-- NEGOCIO desde /admin/ia (pestaña "Conocimiento"). null = usa el
-- límite por defecto de la plataforma (MAX_RESPUESTAS_ASISTENTE en
-- src/lib/asistente-ia.ts, hoy 15) — mismo criterio de tres estados
-- que ya usa asistente_activo, para no inventar una convención nueva.
-- ------------------------------------------------------------

alter table ranchos add column if not exists asistente_max_respuestas integer;

alter table ranchos drop constraint if exists ranchos_asistente_max_respuestas_check;
alter table ranchos add constraint ranchos_asistente_max_respuestas_check
  check (asistente_max_respuestas is null or asistente_max_respuestas between 1 and 200);

notify pgrst, 'reload schema';
