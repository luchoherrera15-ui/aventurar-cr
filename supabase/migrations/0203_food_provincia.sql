-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — filtro real de ubicación por provincia (0203)
--
-- El pedido fue "un selector de ubicación arriba a la izquierda, tipo
-- por provincias, porque la plataforma quiere ser mundial y filtrar
-- por país". Hoy el 100% de los negocios reales son de Costa Rica —
-- inventar un catálogo de PAÍSES sin un solo negocio fuera de CR sería
-- prometer una cobertura que no existe. Lo que SÍ se puede hacer hoy,
-- de verdad, es filtrar por PROVINCIA dentro de Costa Rica: son datos
-- geográficos reales y fijos (las 7 de siempre), no un invento.
--
-- El selector de país queda listo en la UI con "Costa Rica" como única
-- hoja real — el día que haya un negocio de otro país, ese selector
-- crece agregando la columna `pais` (hoy no hace falta: todo lo que
-- existe ES de Costa Rica, así que una columna que dijera eso en cada
-- fila no agregaría ningún dato nuevo).
--
-- Nullable, mismo criterio que tipo_cocina (0202): un negocio existente
-- no se queda con una provincia inventada — no aparece en ningún
-- filtro hasta que su dueño la elija en Configuración.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════

alter table public.food_businesses
  add column if not exists provincia text;

alter table public.food_businesses
  drop constraint if exists food_businesses_provincia_check;

alter table public.food_businesses
  add constraint food_businesses_provincia_check
  check (provincia is null or provincia in (
    'san_jose', 'alajuela', 'cartago', 'heredia',
    'guanacaste', 'puntarenas', 'limon'
  ));

comment on column public.food_businesses.provincia is
  'Provincia de Costa Rica elegida por el dueño (opcional). Catálogo cerrado — ver PROVINCIAS_ID en src/lib/food/tipos.ts. null = sin ubicar, no sale en el filtro de ubicación.';

notify pgrst, 'reload schema';
