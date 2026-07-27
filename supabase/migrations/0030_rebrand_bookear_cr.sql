-- ============================================================
-- AVENTUREA CR → BOOKEAR CR — Renombra el rancho insignia
--
-- El código ya no busca "Aventurea CR — Rancho de Eventos" (así se
-- llamaba la marca antes): ahora busca "Bookear CR — Rancho de
-- Eventos" (constante NOMBRE_RANCHO_BOOKEAR). Sin este UPDATE, esa
-- fila de la tabla `ranchos` deja de encontrarse por nombre y se
-- rompe todo lo que depende de ubicarla: la redirección a
-- /eventos-salon, la administración de sus precios y promociones
-- desde el panel admin, etc.
--
-- Es un simple renombre de una fila existente — no toca ninguna
-- relación (reservas, precios, etc. siguen atadas por rancho_id).
-- Es seguro correr esta migración varias veces.
-- ============================================================

update ranchos
set nombre = 'Bookear CR — Rancho de Eventos'
where nombre = 'Aventurea CR — Rancho de Eventos';

notify pgrst, 'reload schema';
