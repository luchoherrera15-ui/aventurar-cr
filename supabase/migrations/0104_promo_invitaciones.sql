-- ============================================================
-- Promoción de lanzamiento de las invitaciones (agosto 2026):
--   Invitación Estándar  $25 → $19
--   Invitación Premium   $85 → $45
--
-- El precio que se COBRA es este (patrón de la 0087: la base manda,
-- TypeScript solo muestra). El precio de lista tachado vive en
-- src/lib/paquetes-invitaciones.ts como `precioAntesUSD`.
--
-- AL VENCER (6 de setiembre de 2026) hay que volver a 25 y 85 en los
-- DOS lados: acá con un update y allá borrando `precioAntesUSD`.
--
-- Los packs NO se tocan: durante la promo comprar las piezas sueltas
-- puede salir más barato que el pack, y por eso la pantalla deja de
-- anunciar un ahorro que no existe (ver `ahorroPack`). Si se decide
-- rebajar los packs también, va en una migración aparte.
--
-- Es seguro correrla varias veces.
-- ============================================================

update paquetes_invitacion set precio_usd = 19
where id = 'inv_esencial';

update paquetes_invitacion set precio_usd = 45
where id = 'inv_premium';
