-- ------------------------------------------------------------
-- Se elimina home_secciones (las secciones manuales de la portada,
-- de la 0033). El inicio ahora es el directorio con rieles armados
-- automáticamente por categoría, así que la tabla y su panel de
-- admin (/admin/portada) quedaron sin uso.
-- ------------------------------------------------------------

drop table if exists home_secciones cascade;
