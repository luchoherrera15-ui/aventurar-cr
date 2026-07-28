-- ============================================================
-- BOOKEA — Proveedores DE DEMOSTRACIÓN (inventados)
--
-- 2 negocios por categoría (12 en total) para que el directorio se
-- vea vivo. Cada uno tiene fotografías reales acordes a su rubro,
-- tomadas de Unsplash (licencia libre para uso comercial, sin
-- atribución) vía su redirect estable /photos/<id>/download.
--
-- TODOS llevan la marca detalles.demo = true — para borrarlos todos
-- de un solo golpe está el script gemelo: seed-demo-eliminar.sql.
--
-- Se corre en el SQL Editor de Supabase. Es idempotente: si ya se
-- corrió antes (esta versión o la anterior), primero limpia los
-- demo existentes y los vuelve a crear (no duplica).
-- ============================================================

-- Limpia demos anteriores para poder correr esto varias veces.
delete from ranchos where detalles->>'demo' = 'true';

insert into ranchos (
  owner_id, nombre, descripcion, descripcion_larga, categoria, subcategoria,
  provincia, canton, capacidad_min, capacidad_max, precio_desde, unidad_precio,
  foto_url, fotos, amenidades, estado, slug, detalles
)
select
  -- Dueño: la cuenta admin (o la primera cuenta que exista). Son filas
  -- de utilería — nadie las administra desde un panel.
  (select p.id from perfiles p where p.rol = 'admin' limit 1),
  v.nombre, v.descripcion, v.descripcion_larga, v.categoria, v.subcategoria,
  v.provincia, v.canton, v.cap_min, v.cap_max, v.precio_desde, v.unidad_precio,
  v.foto_url, v.fotos::jsonb, v.amenidades::text[], 'aprobado', v.slug,
  '{"demo": true}'::jsonb
from (values

-- ---------- LUGARES ----------
('Rancho Los Almendros', 'Finca para bodas y celebraciones al aire libre, rodeada de jardines.', 'Ceremonias bajo los árboles, zona techada por si llueve y jardines para las fotos. Parqueo amplio y vestidores para los novios.', 'lugares', 'finca_fiestas', 'Alajuela', 'Atenas', 30, 200, 300000, 'evento', 'https://unsplash.com/photos/BiTXVIhPKsE/download?w=1200', '["https://unsplash.com/photos/BiTXVIhPKsE/download?w=1200","https://unsplash.com/photos/y4bE8ST_CTg/download?w=1200"]', '{zona_verde,rancho_techado,parqueo,banos_completos,duchas_vestidores}', 'demo-rancho-los-almendros'),
('Salón Casa Grande', 'Salón de eventos elegante con montaje incluido, en el centro de San José.', 'Un salón clásico con capacidad para 250 personas: mesas montadas, mantelería, aire acondicionado y personal de apoyo durante todo el evento.', 'lugares', 'sala_eventos', 'San José', 'San José', 50, 250, 400000, 'evento', 'https://unsplash.com/photos/m_CaYs0abOE/download?w=1200', '["https://unsplash.com/photos/m_CaYs0abOE/download?w=1200","https://unsplash.com/photos/NK7WRaCzdBs/download?w=1200"]', '{salon_cerrado,aire_acondicionado,parqueo,banos_completos,sonido_incluido}', 'demo-salon-casa-grande'),

-- ---------- ALIMENTACIÓN ----------
('Catering Doña Flor', 'Buffets completos para bodas y eventos corporativos.', 'Cocina tradicional y de autor: estaciones de buffet, personal de servicio uniformado y vajilla incluida. Degustación previa para que elijás tu menú.', 'alimentacion', 'catering', 'Heredia', 'Heredia', null, null, 8500, 'persona', 'https://unsplash.com/photos/WRgdNys1lKM/download?w=1200', '["https://unsplash.com/photos/WRgdNys1lKM/download?w=1200","https://unsplash.com/photos/1WE7CMeZqpo/download?w=1200"]', '{}', 'demo-catering-dona-flor'),
('Barra Libre 506', 'Barra de cócteles con bartenders profesionales para tu evento.', 'Cócteles clásicos y de autor, cristalería completa y barra iluminada. Paquetes por hora o por evento, con opciones sin alcohol.', 'alimentacion', 'barra_cocteles', 'San José', 'Escazú', null, null, 150000, 'evento', 'https://unsplash.com/photos/HCWY7qNCkAM/download?w=1200', '["https://unsplash.com/photos/HCWY7qNCkAM/download?w=1200","https://unsplash.com/photos/CjavUHQ2eJQ/download?w=1200"]', '{}', 'demo-barra-libre-506'),

-- ---------- ANIMACIÓN ----------
('DJ Pura Vida', 'DJ y discomóvil con luces y sonido profesional.', 'Música para todos los gustos y todas las edades, cabina iluminada y pista asegurada. Nos reunimos antes del evento para armar el repertorio a tu medida.', 'animacion', 'dj_discomovil', 'San José', 'Curridabat', null, null, 60000, 'hora', 'https://unsplash.com/photos/bo0d1nz-Lsw/download?w=1200', '["https://unsplash.com/photos/bo0d1nz-Lsw/download?w=1200","https://unsplash.com/photos/yVCwKMvEHG0/download?w=1200"]', '{}', 'demo-dj-pura-vida'),
('Los del Valle · Música en Vivo', 'Grupo musical versátil para bodas, cumpleaños y fiestas.', 'Trompeta, guitarra, bajo y voces: boleros para la cena y cumbia para la fiesta. Repertorio a la carta y equipo de sonido propio.', 'animacion', 'grupos_musicales', 'Cartago', 'Cartago', null, null, 180000, 'evento', 'https://unsplash.com/photos/qYHyn4ztNkc/download?w=1200', '["https://unsplash.com/photos/qYHyn4ztNkc/download?w=1200","https://unsplash.com/photos/Qga8Hcxu-bA/download?w=1200"]', '{}', 'demo-los-del-valle-musica'),

-- ---------- ORGANIZACIÓN ----------
('Lente Viva Fotografía', 'Fotografía profesional de bodas y eventos sociales.', 'Cobertura completa del evento, sesión previa de pareja y galería digital entregada en una semana. Estilo natural, sin poses forzadas.', 'organizacion', 'fotografos', 'San José', 'Moravia', null, null, 250000, 'evento', 'https://unsplash.com/photos/bKP1kyJv_u8/download?w=1200', '["https://unsplash.com/photos/bKP1kyJv_u8/download?w=1200","https://unsplash.com/photos/cfqru1f_9L8/download?w=1200"]', '{}', 'demo-lente-viva-fotografia'),
('Sí Quiero Planners', 'Wedding planners: de la idea al gran día sin estrés.', 'Coordinamos proveedores, cronograma, montaje y protocolo para que el día del evento solo te toque disfrutarlo. Paquetes de coordinación parcial o total.', 'organizacion', 'wedding_planner', 'Heredia', 'Santo Domingo', null, null, 350000, 'evento', 'https://unsplash.com/photos/aEnH4hJ_Mrs/download?w=1200', '["https://unsplash.com/photos/aEnH4hJ_Mrs/download?w=1200","https://unsplash.com/photos/3J-n9VVDCYw/download?w=1200"]', '{}', 'demo-si-quiero-planners'),

-- ---------- DECORACIÓN ----------
('Globos y Sueños', 'Decoración con globos: arcos, fondos y montajes temáticos.', 'Arcos orgánicos, fondos para mesa de queque y decoración temática completa para fiestas infantiles y baby showers. Montaje y desmontaje incluidos.', 'decoracion', 'decoracion_infantil', 'San José', 'Tibás', null, null, 85000, 'evento', 'https://unsplash.com/photos/iG98pmgWJMU/download?w=1200', '["https://unsplash.com/photos/iG98pmgWJMU/download?w=1200","https://unsplash.com/photos/H9Un6az4rno/download?w=1200"]', '{}', 'demo-globos-y-suenos'),
('Toldos del Pacífico', 'Alquiler de toldos, sillas y mesas para eventos al aire libre.', 'Toldos blancos de todos los tamaños, sillas plegables y mesas con mantelería. Entregamos, montamos y desmontamos en todo el Pacífico Central.', 'decoracion', 'toldos', 'Puntarenas', 'Garabito', null, null, 90000, 'evento', 'https://unsplash.com/photos/gOCpvLq2OzY/download?w=1200', '["https://unsplash.com/photos/gOCpvLq2OzY/download?w=1200","https://unsplash.com/photos/ZZQjhSJbV9o/download?w=1200"]', '{}', 'demo-toldos-del-pacifico'),

-- ---------- OTROS ----------
('Traslados Fiesta CR', 'Busetas con conductor para trasladar a tus invitados.', 'Busetas de 15 y 30 pasajeros con conductor, ideales para bodas en fincas alejadas. Nadie maneja después de la fiesta.', 'otros', 'transporte', 'San José', 'San José', null, null, 80000, 'evento', 'https://unsplash.com/photos/2GkRMcHPrRI/download?w=1200', '["https://unsplash.com/photos/2GkRMcHPrRI/download?w=1200","https://unsplash.com/photos/JjXHm8ZUpDQ/download?w=1200"]', '{}', 'demo-traslados-fiesta-cr'),
('Sorpresa Azul o Rosa', 'Revelaciones de sexo con humo, globos y confeti.', 'El momento más esperado con cañones de humo rosa o celeste, globos gigantes y coordinación completa de la sorpresa para que nadie se entere antes.', 'otros', 'revelacion_sexo', 'Heredia', 'San Pablo', null, null, 60000, 'evento', 'https://unsplash.com/photos/XLUuAayDyHs/download?w=1200', '["https://unsplash.com/photos/XLUuAayDyHs/download?w=1200","https://unsplash.com/photos/CZJxwO8fujo/download?w=1200"]', '{}', 'demo-sorpresa-azul-o-rosa')

) as v(nombre, descripcion, descripcion_larga, categoria, subcategoria, provincia, canton, cap_min, cap_max, precio_desde, unidad_precio, foto_url, fotos, amenidades, slug);

-- Cuántos quedaron creados (debería decir 12):
select count(*) as demos_creados from ranchos where detalles->>'demo' = 'true';
