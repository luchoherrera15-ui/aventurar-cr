-- ============================================================
-- Precios terminados en .99 para las dos invitaciones sueltas
-- (pedido del dueño, ago 2026):
--   Invitación Estándar  $19 → $14.99
--   Invitación Premium   $25 → $19.99
--
-- El precio de lista TACHADO no se toca: sigue viviendo solo en
-- src/lib/paquetes-invitaciones.ts como `precioAntesUSD` (25 y 85),
-- que es el original de catálogo.
--
-- El precio que se COBRA es este (patrón de la 0087: la base manda,
-- TypeScript solo muestra). `precio_usd` es numeric(8,2), así que los
-- centavos entran sin redondeo.
--
-- EFECTO DE YAPA EN LA PORTADA: el «Desde $X» del hero de
-- /invitaciones sale del mínimo de PRODUCTOS_INDIVIDUALES, no de un
-- texto escrito a mano — con la Estándar en 14.99 pasa a decir
-- «Desde $14.99» solo, sin tocar esa página.
--
-- Es seguro correrla varias veces.
-- ============================================================

update paquetes_invitacion set precio_usd = 14.99 where id = 'inv_esencial';
update paquetes_invitacion set precio_usd = 19.99 where id = 'inv_premium';
