-- ============================================================
-- 0044 — Destacados manuales de la portada
--
-- El admin puede marcar negocios como "destacados": esos salen de
-- primeros en el directorio, en el orden que él les dé
-- (destacado_orden 1, 2, 3...). El resto sigue saliendo del más
-- nuevo al más viejo, como siempre. Cuando exista el sistema de
-- destacados por pago/suscripción, escribirá esta misma columna.
-- ============================================================

alter table ranchos add column if not exists destacado_orden integer;

create index if not exists ranchos_destacado_orden_idx
  on ranchos (destacado_orden)
  where destacado_orden is not null;
