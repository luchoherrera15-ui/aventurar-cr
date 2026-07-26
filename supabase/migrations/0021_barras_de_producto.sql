-- ============================================================
-- AVENTUREA CR — Barras de producto dentro de Alimentación
--
-- Coffee bar, matcha bar, barra de cócteles y compañía: son un
-- rubro por sí solo (se contratan aparte del catering) y hoy no
-- tenían dónde entrar. Se suman a la lista permitida de
-- `subcategoria`, junto con bartenders.
-- Es seguro correr esta migración varias veces.
-- ============================================================

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
    'bartender', 'barra_cocteles', 'barra_cafe', 'barra_matcha',
    'barra_cerveza', 'barra_jugos', 'barra_helados', 'barra_snacks',
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

notify pgrst, 'reload schema';
