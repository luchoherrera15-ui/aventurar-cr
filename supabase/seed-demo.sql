-- ============================================================
-- BOOKEA — Proveedores DE DEMOSTRACIÓN (inventados)
--
-- Llena el directorio para ver cómo se ve la página con contenido:
-- al menos 5 negocios por categoría (10 lugares, 10 de alimentación
-- y 5 de cada una de las demás). Las fotos son placeholders con el
-- logo de Bookea servidos desde bookea.lat/demo/.
--
-- TODOS llevan la marca detalles.demo = true — para borrarlos todos
-- de un solo golpe está el script gemelo: seed-demo-eliminar.sql.
--
-- Se corre en el SQL Editor de Supabase. Es idempotente: si ya se
-- corrió antes, primero limpia los demo anteriores y los vuelve a
-- crear (no duplica).
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

-- ---------- 10 LUGARES ----------
('Hacienda El Roble', 'Finca de eventos entre robles centenarios, con vista al valle.', 'Un espacio amplio y natural para bodas y celebraciones grandes, con rancho techado, zonas verdes y parqueo para todos tus invitados.', 'lugares', 'finca_fiestas', 'San José', 'Santa Ana', 30, 250, 350000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{piscina,rancho_techado,zona_verde,parqueo,banos_completos,parrilla}', 'demo-hacienda-el-roble'),
('Rancho Vista Verde', 'Rancho techado con piscina y cancha, ideal para fiestas familiares.', 'Piscina para grandes y chicos, cancha multiuso y una parrilla lista para el catering. A 15 minutos del centro de Alajuela.', 'lugares', 'rancho_fiestas', 'Alajuela', 'Atenas', 20, 120, 180000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{piscina,piscina_ninos,cancha_multiuso,parrilla,parqueo,juegos_infantiles}', 'demo-rancho-vista-verde'),
('Salón Los Cipreses', 'Salón cerrado con aire acondicionado en el corazón de Cartago.', 'Perfecto para graduaciones, aniversarios y eventos corporativos. Incluye sonido básico, proyector y personal de limpieza.', 'lugares', 'sala_eventos', 'Cartago', 'Cartago', 40, 200, 275000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{salon_cerrado,aire_acondicionado,sonido_incluido,proyector,parqueo,banos_completos}', 'demo-salon-los-cipreses'),
('Finca La Esperanza', 'Vistas al volcán y atardeceres para bodas de ensueño.', 'Ceremonias al aire libre con el volcán de fondo, zona techada por si llueve y espacio de vestidores para los novios.', 'lugares', 'finca_fiestas', 'Heredia', 'Barva', 50, 300, 500000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{zona_verde,terraza_mirador,rancho_techado,duchas_vestidores,parqueo,parqueo_buses}', 'demo-finca-la-esperanza'),
('Rancho Guanacaste Real', 'Rancho de madera con piscina cerca de las playas.', 'A 20 minutos de Tamarindo: piscina grande, rancho de madera y hospedaje en cabinas para que la fiesta siga al día siguiente.', 'lugares', 'rancho_fiestas', 'Guanacaste', 'Santa Cruz', 20, 150, 220000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{piscina,rancho_techado,chalets,parrilla,zona_verde,parqueo}', 'demo-rancho-guanacaste-real'),
('Centro de Eventos Miravalles', 'Salón moderno para congresos y actividades corporativas.', 'Dos salas conectables, internet de fibra, proyectores y coffee break opcional. En pleno centro de San José.', 'lugares', 'centro_negocios', 'San José', 'San José', 20, 400, 400000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{salon_cerrado,aire_acondicionado,wifi,proyector,sonido_incluido,seguridad}', 'demo-centro-eventos-miravalles'),
('Villa Pacífico', 'Parque acuático privado para fiestas inolvidables.', 'Toboganes, piscina de niños y rancho techado con capacidad para 100 personas. Salvavidas incluido en todos los paquetes.', 'lugares', 'parque_piscina', 'Puntarenas', 'Esparza', 15, 100, 160000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{piscina,piscina_ninos,juegos_infantiles,rancho_techado,parqueo,limpieza}', 'demo-villa-pacifico'),
('Castillo Kids Party', 'Local de fiestas infantiles con juegos y animación.', 'Inflables, piscina de pelotas, zona de comidas y un salón climatizado. Los papás descansan, los chicos no paran.', 'lugares', 'lugar_fiestas_infantiles', 'San José', 'Curridabat', 10, 80, 120000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{juegos_infantiles,salon_cerrado,aire_acondicionado,apto_ninos,parqueo}', 'demo-castillo-kids-party'),
('Hotel Colinas del Este', 'Hotel de montaña con salón de eventos y hospedaje.', 'Casate en la montaña y hospedá a tus invitados en el mismo lugar: salón para 180 personas, restaurante y 24 habitaciones.', 'lugares', 'hotel_eventos', 'Limón', 'Pococí', 30, 180, 450000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{salon_cerrado,habitaciones,zona_verde,parqueo,banos_completos,wifi}', 'demo-hotel-colinas-del-este'),
('Rancho Río Celeste', 'Rancho rústico junto al río, rodeado de naturaleza.', 'Un rincón escondido en la zona norte con río propio, rancho de madera y zona de camping para eventos de fin de semana.', 'lugares', 'rancho_fiestas', 'Alajuela', 'Guatuso', 15, 90, 140000, 'evento', 'https://bookea.lat/demo/lugares.png', '["https://bookea.lat/demo/lugares.png"]', '{rio_quebrada,rancho_techado,camping,parrilla,zona_verde,mascotas}', 'demo-rancho-rio-celeste'),

-- ---------- 5 BARRAS DE CÓCTELES ----------
('Mixology CR', 'Barra de cócteles de autor con bartenders certificados.', 'Cócteles clásicos y de autor con hielo artesanal, cristalería completa y barra iluminada. Paquetes por hora o por evento.', 'alimentacion', 'barra_cocteles', 'San José', 'Escazú', null, null, 150000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-mixology-cr'),
('La Coctelería Móvil', 'Barra móvil vintage para bodas y eventos al aire libre.', 'Una barra montada en una carreta clásica restaurada: gin tonics, mojitos y sangría. Llegamos a cualquier punto del Valle Central.', 'alimentacion', 'barra_cocteles', 'Heredia', 'Heredia', null, null, 130000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-la-cocteleria-movil'),
('Tropical Bar Co.', 'Cócteles tropicales con fruta fresca de temporada.', 'Piña colada en piña natural, daiquiris de frutas locales y opciones sin alcohol para todas las edades.', 'alimentacion', 'barra_cocteles', 'Guanacaste', 'Liberia', null, null, 120000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-tropical-bar-co'),
('Barra Premium 506', 'Servicio de barra libre premium para eventos corporativos.', 'Licores premium, personal uniformado y control de consumo por invitado. Facturamos con factura electrónica.', 'alimentacion', 'barra_cocteles', 'San José', 'Santa Ana', null, null, 200000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-barra-premium-506'),
('Cocteles del Valle', 'Mixología artesanal con ingredientes de la zona.', 'Hierbas de nuestra huerta, siropes caseros y una carta que se adapta a tu evento. Degustación previa incluida.', 'alimentacion', 'barra_cocteles', 'Cartago', 'La Unión', null, null, 110000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-cocteles-del-valle'),

-- ---------- 5 COFFEE BARS ----------
('Café de Altura Events', 'Coffee bar con granos de Tarrazú para tus invitados.', 'Espresso, capuchinos y cold brew servidos por baristas. El aroma del café de Tarrazú en tu boda o evento corporativo.', 'alimentacion', 'barra_cafe', 'San José', 'Tarrazú', null, null, 90000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-cafe-de-altura-events'),
('Barista Bar CR', 'Estación de café espresso con baristas profesionales.', 'Máquina profesional, arte latte y menú personalizado con el nombre de los novios o el logo de tu empresa.', 'alimentacion', 'barra_cafe', 'Heredia', 'Belén', null, null, 85000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-barista-bar-cr'),
('El Grano Dorado', 'Café de especialidad y repostería artesanal para eventos.', 'Café chorreado a la vista, tortas caseras y galletas decoradas a juego con tu celebración.', 'alimentacion', 'barra_cafe', 'Alajuela', 'Grecia', null, null, 75000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-el-grano-dorado'),
('Momentos Café', 'Carrito de café vintage para fotos y buenos momentos.', 'Nuestro carrito de café es la estación más fotografiada de cada evento. Café, té e infusiones para todos los gustos.', 'alimentacion', 'barra_cafe', 'Cartago', 'Paraíso', null, null, 70000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-momentos-cafe'),
('Cold Brew Bros', 'Barra de café frío, nitro y matcha para eventos modernos.', 'Cold brew en barril, nitro coffee con espuma cremosa y matcha lattes. La barra que tus invitados no esperaban.', 'alimentacion', 'barra_cafe', 'San José', 'Montes de Oca', null, null, 95000, 'evento', 'https://bookea.lat/demo/alimentacion.png', '["https://bookea.lat/demo/alimentacion.png"]', '{}', 'demo-cold-brew-bros'),

-- ---------- 3 ANIMACIÓN ----------
('DJ Nébula', 'DJ y discomóvil con luces y sonido profesional.', 'Música para todos los gustos, cabina iluminada, humo y luces robóticas. Nos adaptamos al estilo de tu fiesta.', 'animacion', 'dj_discomovil', 'San José', 'Desamparados', null, null, 175000, 'evento', 'https://bookea.lat/demo/animacion.png', '["https://bookea.lat/demo/animacion.png"]', '{}', 'demo-dj-nebula'),
('Marimba Los Hermanos', 'Marimba en vivo para bodas y fiestas tradicionales.', 'El sonido de Costa Rica en tu evento: marimba, guitarra y voces. Repertorio típico y popular a elección.', 'animacion', 'grupos_musicales', 'Guanacaste', 'Nicoya', null, null, 160000, 'evento', 'https://bookea.lat/demo/animacion.png', '["https://bookea.lat/demo/animacion.png"]', '{}', 'demo-marimba-los-hermanos'),
('Fiesta Animada CR', 'Animadores profesionales para fiestas infantiles.', 'Shows temáticos, pinta caritas, globoflexia y juegos dirigidos. Dos horas de pura energía para los más pequeños.', 'animacion', 'animadores', 'Heredia', 'San Rafael', null, null, 80000, 'evento', 'https://bookea.lat/demo/animacion.png', '["https://bookea.lat/demo/animacion.png"]', '{}', 'demo-fiesta-animada-cr'),

-- ---------- 3 ORGANIZACIÓN ----------
('Lente y Luz Fotografía', 'Fotografía profesional de bodas y eventos.', 'Cobertura completa del evento, sesión previa de pareja y galería digital entregada en una semana.', 'organizacion', 'fotografos', 'San José', 'Moravia', null, null, 250000, 'evento', 'https://bookea.lat/demo/organizacion.png', '["https://bookea.lat/demo/organizacion.png"]', '{}', 'demo-lente-y-luz-fotografia'),
('Click Photo Booth', 'Cabina de fotos con props y impresión al instante.', 'Fotos ilimitadas, props divertidos, fondo personalizado y álbum de recuerdos para los anfitriones.', 'organizacion', 'photo_booth', 'Alajuela', 'Alajuela', null, null, 120000, 'evento', 'https://bookea.lat/demo/organizacion.png', '["https://bookea.lat/demo/organizacion.png"]', '{}', 'demo-click-photo-booth'),
('Eventos Perfectos WP', 'Wedding planner con 10 años de experiencia.', 'De la idea al gran día: coordinamos proveedores, cronograma y montaje para que solo te preocupés por disfrutar.', 'organizacion', 'wedding_planner', 'San José', 'Escazú', null, null, 300000, 'evento', 'https://bookea.lat/demo/organizacion.png', '["https://bookea.lat/demo/organizacion.png"]', '{}', 'demo-eventos-perfectos-wp'),

-- ---------- 3 DECORACIÓN ----------
('Flores del Monte', 'Floristería especializada en bodas y eventos.', 'Arreglos con flores de altura, arcos florales y centros de mesa. Trabajamos con flores de productores locales.', 'decoracion', 'floristerias', 'Cartago', 'Oreamuno', null, null, 90000, 'evento', 'https://bookea.lat/demo/decoracion.png', '["https://bookea.lat/demo/decoracion.png"]', '{}', 'demo-flores-del-monte'),
('Deco Fiesta Mágica', 'Decoración temática para fiestas infantiles.', 'Arcos de globos, fondos temáticos y mesas de dulces decoradas. Hacemos realidad el tema que tu hijo sueñe.', 'decoracion', 'decoracion_infantil', 'San José', 'Tibás', null, null, 85000, 'evento', 'https://bookea.lat/demo/decoracion.png', '["https://bookea.lat/demo/decoracion.png"]', '{}', 'demo-deco-fiesta-magica'),
('Toldos y Eventos del Norte', 'Alquiler de toldos, sillas y mesas para todo evento.', 'Toldos de todos los tamaños, sillas tiffany, mesas redondas y mantelería. Montaje y desmontaje incluidos.', 'decoracion', 'toldos', 'Alajuela', 'San Carlos', null, null, 100000, 'evento', 'https://bookea.lat/demo/decoracion.png', '["https://bookea.lat/demo/decoracion.png"]', '{}', 'demo-toldos-eventos-norte'),

-- ---------- 3 OTROS ----------
('Transportes Fiesta Segura', 'Busetas para trasladar a tus invitados con seguridad.', 'Busetas de 15 y 30 pasajeros con conductor, ideales para bodas en fincas alejadas. Nadie maneja después de la fiesta.', 'otros', 'transporte', 'San José', 'San José', null, null, 80000, 'evento', 'https://bookea.lat/demo/otros.png', '["https://bookea.lat/demo/otros.png"]', '{}', 'demo-transportes-fiesta-segura'),
('Revelaciones CR', 'Revelaciones de sexo con humo, globos y confeti.', 'El momento más esperado con cañones de humo rosa o celeste, globos gigantes y coordinación de la sorpresa.', 'otros', 'revelacion_sexo', 'Heredia', 'Santo Domingo', null, null, 60000, 'evento', 'https://bookea.lat/demo/otros.png', '["https://bookea.lat/demo/otros.png"]', '{}', 'demo-revelaciones-cr'),
('Baños VIP Portátiles', 'Cabinas sanitarias premium para eventos al aire libre.', 'Baños portátiles con lavamanos, espejo e iluminación — la comodidad que tus invitados agradecen en fincas y playas.', 'otros', 'banos_portatiles', 'Puntarenas', 'Garabito', null, null, 70000, 'evento', 'https://bookea.lat/demo/otros.png', '["https://bookea.lat/demo/otros.png"]', '{}', 'demo-banos-vip-portatiles'),
-- ---------- +2 ANIMACIÓN (para llegar a 5) ----------
('Mariachi Juvenil Tapatío', 'Serenatas y mariachi para toda ocasión.', 'Trompetas, violines y las canciones de siempre para cumpleaños, aniversarios y sorpresas. Repertorio a la carta y traje de gala.', 'animacion', 'mariachis', 'San José', 'Goicoechea', null, null, 90000, 'evento', 'https://bookea.lat/demo/animacion.png', '["https://bookea.lat/demo/animacion.png"]', '{}', 'demo-mariachi-juvenil-tapatio'),
('Salta Salta Inflables', 'Alquiler de inflables y juegos para fiestas.', 'Castillos, toboganes y obstáculos para todas las edades. Incluye transporte, montaje y un encargado durante toda la actividad.', 'animacion', 'inflables', 'Cartago', 'El Guarco', null, null, 65000, 'evento', 'https://bookea.lat/demo/animacion.png', '["https://bookea.lat/demo/animacion.png"]', '{}', 'demo-salta-salta-inflables'),

-- ---------- +2 ORGANIZACIÓN (para llegar a 5) ----------
('Invitaciones Papel y Tinta', 'Invitaciones impresas y digitales con diseño propio.', 'Suites de invitación para bodas y quinceaños: papel de algodón, sobres forrados y versión digital animada para WhatsApp.', 'organizacion', 'invitaciones', 'Heredia', 'San Pablo', null, null, 45000, 'evento', 'https://bookea.lat/demo/organizacion.png', '["https://bookea.lat/demo/organizacion.png"]', '{}', 'demo-invitaciones-papel-y-tinta'),
('Prisma Producción Audiovisual', 'Video profesional de bodas y eventos corporativos.', 'Cobertura con dos cámaras y dron, highlights para redes en 48 horas y película completa del evento con audio de ceremonia.', 'organizacion', 'produccion_audiovisual', 'San José', 'Montes de Oca', null, null, 280000, 'evento', 'https://bookea.lat/demo/organizacion.png', '["https://bookea.lat/demo/organizacion.png"]', '{}', 'demo-prisma-produccion-audiovisual'),

-- ---------- +2 DECORACIÓN (para llegar a 5) ----------
('Sillas y Mesas Del Valle', 'Alquiler de sillas, mesas y mantelería.', 'Sillas tiffany, plegables y avant garde; mesas redondas y rectangulares con mantelería a juego. Entrega en todo el Valle Central.', 'decoracion', 'sillas_mesas', 'San José', 'Alajuelita', null, null, 55000, 'evento', 'https://bookea.lat/demo/decoracion.png', '["https://bookea.lat/demo/decoracion.png"]', '{}', 'demo-sillas-y-mesas-del-valle'),
('Tarimas Pro Eventos', 'Tarimas, graderías y estructuras para espectáculos.', 'Tarimas certificadas de todos los tamaños, techos para escenario y graderías. Montaje con personal propio y pólizas al día.', 'decoracion', 'tarimas', 'Alajuela', 'San Ramón', null, null, 150000, 'evento', 'https://bookea.lat/demo/decoracion.png', '["https://bookea.lat/demo/decoracion.png"]', '{}', 'demo-tarimas-pro-eventos'),

-- ---------- +2 OTROS (para llegar a 5) ----------
('Luz Total Plantas Eléctricas', 'Plantas eléctricas silenciosas para eventos.', 'Generadores insonorizados con operador y combustible incluido. Respaldo eléctrico para conciertos, ferias y bodas en fincas.', 'otros', 'planta_electrica', 'Guanacaste', 'Liberia', null, null, 120000, 'evento', 'https://bookea.lat/demo/otros.png', '["https://bookea.lat/demo/otros.png"]', '{}', 'demo-luz-total-plantas-electricas'),
('Guardianes Seguridad Privada', 'Oficiales de seguridad para eventos y parqueos.', 'Control de accesos, custodia de parqueo y acompañamiento durante todo el evento. Personal uniformado con carné al día.', 'otros', 'seguridad', 'San José', 'Pérez Zeledón', null, null, 85000, 'evento', 'https://bookea.lat/demo/otros.png', '["https://bookea.lat/demo/otros.png"]', '{}', 'demo-guardianes-seguridad-privada')

) as v(nombre, descripcion, descripcion_larga, categoria, subcategoria, provincia, canton, cap_min, cap_max, precio_desde, unidad_precio, foto_url, fotos, amenidades, slug);

-- Cuántos quedaron creados (debería decir 40):
select count(*) as demos_creados from ranchos where detalles->>'demo' = 'true';
