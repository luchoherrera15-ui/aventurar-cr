-- ============================================================
-- BOOKEA — Catálogo de Invitaciones 2026 (0100)
--
-- El catálogo pasa a venderse en dos formas:
--
--   1. PRODUCTOS INDIVIDUALES — álbumes por cantidad de fotos,
--      invitación Esencial/Premium y el Save the Date. Precios
--      fijados $10 por debajo del equivalente de la competencia.
--   2. PACKS (Perla, Zafiro, Diamante) — invitación Premium + álbum,
--      $12 por debajo del pack equivalente de la competencia. En la
--      landing viven detrás de un botón "Ver packs".
--
-- Recordatorio de la 0087: esta tabla manda en lo que se COBRA;
-- src/lib/paquetes-invitaciones.ts manda en lo que se MUESTRA. Los dos
-- tienen que decir lo mismo — el servidor compara y avisa en el log si
-- no coinciden.
--
-- EL CATÁLOGO ANTERIOR NO SE BORRA. Los paquetes 2025 (basico,
-- intermedio, plus, destello, celebracion, legado) quedan en la tabla
-- para que los pedidos YA HECHOS sigan resolviendo su nombre y su
-- precio en el panel y en los correos ya enviados. Solo se marcan
-- `activo = false`: dejan de ofrecerse, sin romper el historial.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Los productos individuales
-- ------------------------------------------------------------

insert into paquetes_invitacion (id, nombre, precio_usd, precio_crc, tiene_panel, orden, es_complemento, activo)
values
  ('album_50',      'Álbum digital de 50 fotos',   39,  null, false, 30, false, true),
  ('album_150',     'Álbum digital de 150 fotos',  69,  null, false, 31, false, true),
  ('album_250',     'Álbum digital de 250 fotos',  99,  null, false, 32, false, true),
  ('album_400',     'Álbum digital de 400 fotos',  139, null, false, 33, false, true),
  ('album_600',     'Álbum digital de 600 fotos',  189, null, false, 34, false, true),
  ('inv_esencial',  'Invitación Esencial',         59,  null, false, 40, false, true),
  ('inv_premium',   'Invitación Premium',          115, null, true,  41, false, true),
  ('save_the_date', 'Diseño Save the Date',        29,  null, false, 50, false, true)
on conflict (id) do update set
  nombre         = excluded.nombre,
  precio_usd     = excluded.precio_usd,
  precio_crc     = excluded.precio_crc,
  tiene_panel    = excluded.tiene_panel,
  orden          = excluded.orden,
  es_complemento = excluded.es_complemento,
  activo         = excluded.activo;

-- ------------------------------------------------------------
-- 2. Los packs
-- ------------------------------------------------------------

insert into paquetes_invitacion (id, nombre, precio_usd, precio_crc, tiene_panel, orden, es_complemento, activo)
values
  ('perla',    'Pack Perla',    113, null, true, 10, false, true),
  ('zafiro',   'Pack Zafiro',   138, null, true, 11, false, true),
  ('diamante', 'Pack Diamante', 163, null, true, 12, false, true)
on conflict (id) do update set
  nombre         = excluded.nombre,
  precio_usd     = excluded.precio_usd,
  precio_crc     = excluded.precio_crc,
  tiene_panel    = excluded.tiene_panel,
  orden          = excluded.orden,
  es_complemento = excluded.es_complemento,
  activo         = excluded.activo;

-- ------------------------------------------------------------
-- 3. El álbum que se ofrece como EXTRA al pedir una invitación
--
-- Venía de la 0091 como "180 fotos por $45" — con el catálogo nuevo
-- eso quedaba más barato que el álbum de 150 que se vende suelto a
-- $69, o sea que convenía comprarlo como extra. Se alinea al catálogo.
--
-- El id sigue siendo `album_180` a propósito: es la PK que referencian
-- los pedidos YA HECHOS y la que busca por nombre el RPC
-- `crear_pedido_invitacion`. Cambiarlo dejaría esos pedidos sin precio
-- y rompería el cobro del extra.
-- ------------------------------------------------------------

update paquetes_invitacion
set nombre = 'Álbum digital de 150 fotos',
    precio_usd = 69
where id = 'album_180';

-- ------------------------------------------------------------
-- 4. El catálogo anterior deja de ofrecerse (pero sigue resolviendo
--    los pedidos viejos: NO se borra)
-- ------------------------------------------------------------

update paquetes_invitacion
set activo = false
where id in ('basico', 'intermedio', 'plus', 'destello', 'celebracion', 'legado');

notify pgrst, 'reload schema';
