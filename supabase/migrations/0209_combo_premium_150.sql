-- ============================================================
-- El combo con el que se promociona el catálogo (pedido del dueño,
-- ago 2026):
--   Invitación Premium (sola)              $45 → $25
--   Pack El Gran Día (Premium + álbum 150) $99 → $45
--
-- La Invitación Estándar NO se toca — sigue en $19.
--
-- El precio que se COBRA es este (patrón de la 0087: la base manda,
-- TypeScript solo muestra). El precio de lista tachado sigue viviendo
-- en src/lib/paquetes-invitaciones.ts como `precioAntesUSD` (85 y 138
-- respectivamente) — no se toca, sigue siendo el precio original.
--
-- OJO: con la Premium en $25, comprar el Pack "El Brindis" (perla,
-- $75) o "Para Siempre" (diamante, $125) sueltos por partes puede
-- salir igual o más barato. El código ya no anuncia un ahorro falso
-- ahí (ver `ahorroPack`), pero esos dos packs no se repreciaron en
-- esta migración — quedó pendiente una decisión aparte.
--
-- Es seguro correrla varias veces.
-- ============================================================

update paquetes_invitacion set precio_usd = 25
where id = 'inv_premium';

update paquetes_invitacion set precio_usd = 45
where id = 'zafiro';
