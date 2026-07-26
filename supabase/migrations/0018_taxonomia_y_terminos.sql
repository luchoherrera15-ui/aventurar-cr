-- ============================================================
-- AVENTUREA CR — Taxonomía de dos niveles + términos por proveedor
--
-- 1. `categoria` pasa a ser la categoría general que se ve en la
--    barra de navegación (lugares, alimentación, animación,
--    organización, decoración, otros) y la nueva `subcategoria`
--    guarda el rubro concreto (queques, mariachis, floristerías...).
--    Los valores viejos se remapean sin perder nada.
--
-- 2. Cada proveedor puede tener sus propios términos y condiciones
--    y su monto mínimo de contratación.
--
-- La columna `tipo_lugar` queda como está (sin usar) en vez de
-- borrarse, para poder volver atrás si hiciera falta.
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Subcategoría
-- ------------------------------------------------------------

alter table ranchos add column if not exists subcategoria text;

-- Backfill ANTES de tocar `categoria`, que es de donde sale el dato.
update ranchos set subcategoria = tipo_lugar
  where categoria = 'salon' and tipo_lugar is not null and subcategoria is null;
update ranchos set subcategoria = 'sala_eventos'
  where categoria = 'salon' and subcategoria is null;
update ranchos set subcategoria = 'dj_discomovil'
  where categoria = 'dj' and subcategoria is null;
update ranchos set subcategoria = 'animadores'
  where categoria = 'animador' and subcategoria is null;
update ranchos set subcategoria = 'sillas_mesas'
  where categoria = 'mobiliario' and subcategoria is null;
update ranchos set subcategoria = 'revelacion_sexo'
  where categoria = 'revelacion_sexo' and subcategoria is null;
update ranchos set subcategoria = 'otro'
  where categoria = 'otro' and subcategoria is null;

-- ------------------------------------------------------------
-- 2. Remapeo de la categoría general
-- ------------------------------------------------------------

alter table ranchos drop constraint if exists ranchos_categoria_check;

update ranchos set categoria = 'lugares'    where categoria = 'salon';
update ranchos set categoria = 'animacion'  where categoria in ('dj', 'animador');
update ranchos set categoria = 'decoracion' where categoria = 'mobiliario';
update ranchos set categoria = 'otros'      where categoria in ('revelacion_sexo', 'otro');

alter table ranchos alter column categoria set default 'lugares';

alter table ranchos add constraint ranchos_categoria_check
  check (categoria in (
    'lugares', 'alimentacion', 'animacion',
    'organizacion', 'decoracion', 'otros'
  ));

alter table ranchos drop constraint if exists ranchos_subcategoria_check;
alter table ranchos add constraint ranchos_subcategoria_check
  check (subcategoria is null or subcategoria in (
    -- Lugares
    'sala_eventos', 'rancho_fiestas', 'lugar_fiestas_infantiles',
    'finca_fiestas', 'hotel_eventos', 'restaurante',
    'parque_piscina', 'centro_negocios',
    -- Alimentación
    'catering', 'queques', 'catering_infantil', 'bebidas_domicilio',
    'mesas_dulces', 'food_trucks', 'comidas_domicilio', 'parrillada',
    -- Animación
    'dj_discomovil', 'luces_sonido', 'grupos_musicales', 'fiestas_neon',
    'animadores', 'maestros_ceremonias', 'mariachis',
    'payasos_pintacaritas', 'magos', 'inflables',
    'animacion_infantil', 'polvora',
    -- Organización
    'articulos_fiesta', 'invitaciones', 'fotografos', 'photo_booth',
    'edecanes', 'wedding_planner', 'produccion_audiovisual',
    'agencias_btl', 'organizacion_eventos', 'articulos_promocionales',
    -- Decoración
    'decoracion_eventos', 'decoracion_infantil', 'floristerias',
    'toldos', 'tarimas', 'exhibidores_stands', 'graderias',
    'sillas_mesas', 'manteles', 'equipo_eventos',
    -- Otros
    'revelacion_sexo', 'transporte', 'seguridad',
    'banos_portatiles', 'planta_electrica', 'otro'
  ));

create index if not exists ranchos_subcategoria_idx on ranchos (subcategoria);

-- ------------------------------------------------------------
-- 3. Términos y condiciones propios + monto mínimo
--
-- `terminos` vacío significa "usar los que trae la plataforma":
-- así un negocio que nunca los tocó siempre muestra los vigentes.
-- ------------------------------------------------------------

alter table ranchos add column if not exists terminos jsonb not null default '[]'::jsonb;
alter table ranchos add column if not exists monto_minimo numeric;

notify pgrst, 'reload schema';
