-- ============================================================
-- AVENTUREA CR — Portal público por proveedor
--
-- Cada negocio (salón, DJ, catering, mobiliario, animador...)
-- pasa a tener su propia página dentro del sitio: galería de
-- fotos, redes sociales, presentación larga y, en el caso de
-- los lugares, la lista de amenidades que ofrece.
--
-- La columna `fotos` (jsonb) ya existía desde 0008 pero nunca
-- se usó — a partir de acá guarda la galería del portal.
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Redes sociales y presentación del portal
-- ------------------------------------------------------------

alter table ranchos add column if not exists instagram text;
alter table ranchos add column if not exists facebook text;
alter table ranchos add column if not exists tiktok text;
alter table ranchos add column if not exists sitio_web text;
alter table ranchos add column if not exists descripcion_larga text;

-- ------------------------------------------------------------
-- 2. Amenidades del lugar (piscina, parrilla, cancha, etc.)
--
-- Por ahora solo se llenan para categoria = 'salon'. Los
-- servicios móviles (DJ, catering...) tendrán su propio set
-- de características en una fase posterior.
-- ------------------------------------------------------------

alter table ranchos add column if not exists amenidades text[] not null default '{}';

-- Índice GIN para poder filtrar el directorio por amenidad
-- ("mostrame solo los que tienen piscina") sin escanear todo.
create index if not exists ranchos_amenidades_idx
  on ranchos using gin (amenidades);
