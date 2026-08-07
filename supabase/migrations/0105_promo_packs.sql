-- ============================================================
-- Los packs entran a la promoción de lanzamiento (agosto 2026):
--   El Brindis    $113 → $75
--   El Gran Día   $138 → $99
--   Para Siempre  $163 → $125
--
-- POR QUÉ: con la Premium rebajada a $45 (0104), comprar las piezas
-- por separado salía MÁS BARATO que cualquier pack — El Brindis
-- costaba $113 contra $84 de comprar Premium + álbum de 50 sueltos.
-- El pack dejaba de ser un pack. Con estos precios vuelve a haber un
-- ahorro real de $9, $15 y $19 respectivamente.
--
-- Como siempre: la base manda en lo que se COBRA, TypeScript en lo que
-- se muestra (patrón de la 0087). Al vencer la promo el 6 de setiembre
-- hay que volver a 113/138/163 acá y borrar `precioAntesUSD` allá.
--
-- Es seguro correrla varias veces.
-- ============================================================

update paquetes_invitacion set precio_usd = 75  where id = 'perla';
update paquetes_invitacion set precio_usd = 99  where id = 'zafiro';
update paquetes_invitacion set precio_usd = 125 where id = 'diamante';
