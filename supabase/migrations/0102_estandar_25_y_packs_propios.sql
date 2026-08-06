-- ============================================================
-- Tres ajustes del catálogo de invitaciones (pedidos del dueño):
--
--  1. La Invitación Estándar baja a $25 (era $59) y la Premium a $85
--     (era $115). El precio que se COBRA es este — TypeScript solo
--     muestra; los dos lados se cambian juntos (patrón de la 0087).
--  2. Los packs dejan las piedras del competidor y toman nombres
--     propios de la casa: El Brindis, El Gran Día y Para Siempre.
--     Solo cambia el NOMBRE: los ids (perla/zafiro/diamante) se
--     quedan porque los pedidos hechos los referencian.
--
-- Es seguro correrla varias veces.
-- ============================================================

update paquetes_invitacion set precio_usd = 25
where id = 'inv_esencial';

update paquetes_invitacion set precio_usd = 85
where id = 'inv_premium';

update paquetes_invitacion set nombre = 'Pack El Brindis'
where id = 'perla';

update paquetes_invitacion set nombre = 'Pack El Gran Día'
where id = 'zafiro';

update paquetes_invitacion set nombre = 'Pack Para Siempre'
where id = 'diamante';
