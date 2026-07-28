-- ============================================================
-- BOOKEA — Eliminar los proveedores de demostración
--
-- Borra ÚNICAMENTE las filas creadas por seed-demo.sql (las que
-- llevan detalles.demo = true). Los proveedores reales no se tocan.
-- Las tablas hijas (precios, reservas, favoritos, conversaciones...)
-- se limpian solas por los "on delete cascade" de sus claves.
-- ============================================================

delete from ranchos where detalles->>'demo' = 'true';

select count(*) as demos_restantes from ranchos where detalles->>'demo' = 'true';
