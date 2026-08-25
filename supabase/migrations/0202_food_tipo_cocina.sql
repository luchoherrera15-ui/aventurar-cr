-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — categoría gastronómica real, por fin (0202)
--
-- `src/lib/food/tarjetas.ts` y `mobile-food/src/lib/food-datos.ts`
-- tenían las dos, por separado, la misma regla escrita a mano: "nada
-- de rating, tipo de cocina ni distancia — esas columnas no existen
-- hoy, y no se inventan acá tampoco". Y `food/negocio/(panel)/perfil`
-- ya prometía "Categoría gastronómica" en su tarjeta "Muy pronto",
-- esperando justo esta migración para moverla a la vista real.
--
-- Nullable a propósito: un negocio existente no queda con una
-- categoría inventada por default — simplemente no aparece en ningún
-- filtro de categoría hasta que su dueño la elija.
--
-- El catálogo es FINITO (CHECK) y no texto libre: así el filtro de
-- categorías del cliente (un ícono fijo por categoría) tiene un
-- conjunto cerrado y conocido para pintar — mismo criterio que
-- `programa_lealtad.modo` (0121/0135) en el módulo de Lealtad. La
-- lista vive en código —`TIPOS_COCINA_ID` en src/lib/food/tipos.ts,
-- espejo en mobile-food/src/lib/food-tipos.ts— y NO en una tabla
-- aparte: es producto, igual para todos, no configurable por cuenta.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════

alter table public.food_businesses
  add column if not exists tipo_cocina text;

alter table public.food_businesses
  drop constraint if exists food_businesses_tipo_cocina_check;

alter table public.food_businesses
  add constraint food_businesses_tipo_cocina_check
  check (tipo_cocina is null or tipo_cocina in (
    'tipica', 'italiana', 'asiatica', 'mexicana', 'mariscos',
    'carnes', 'pizza', 'cafe_postres', 'saludable', 'comida_rapida'
  ));

comment on column public.food_businesses.tipo_cocina is
  'Categoría gastronómica elegida por el dueño (opcional). Catálogo cerrado — ver TIPOS_COCINA_ID en src/lib/food/tipos.ts. null = sin categorizar, no sale en ningún filtro de categoría.';

-- food_businesses ya usa RLS por FILA (0190/0194), no grants por
-- columna como `ranchos` (0187): una columna nueva no necesita un
-- GRANT aparte, la hereda del permiso de tabla existente.
notify pgrst, 'reload schema';
