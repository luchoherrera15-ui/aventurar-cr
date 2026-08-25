-- ============================================================
-- Segunda rebaja de los tres packs (pedido del dueño, ago 2026),
-- encima de la de la 0209:
--   Pack El Brindis    ($75 → $35)
--   Pack El Gran Día   (sigue en $45 — ya estaba desde la 0209)
--   Pack Para Siempre  ($125 → $80)
--
-- El precio de lista tachado (`precioAntesUSD` en
-- src/lib/paquetes-invitaciones.ts) pasa a ser el precio ANTERIOR a
-- esta rebaja (75/99/125), no el original de catálogo (113/138/163):
-- el dueño pidió explícitamente "poné los precios anteriores
-- tachados" — la base no necesita cambio para eso, ese número solo
-- vive en TypeScript.
--
-- El precio que se COBRA es este (patrón de la 0087: la base manda,
-- TypeScript solo muestra).
--
-- Es seguro correrla varias veces.
-- ============================================================

update paquetes_invitacion set precio_usd = 35 where id = 'perla';
update paquetes_invitacion set precio_usd = 45 where id = 'zafiro';
update paquetes_invitacion set precio_usd = 80 where id = 'diamante';
