
-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — negocios DEMO, separados del directorio real (0193)
--
-- El dueño pidió sembrar restaurantes "demo" latinos puramente
-- visuales/explicativos en /food/demo, dejando explícito que ese seed
-- vive APARTE de los negocios reales de FOOD y de las reservas reales.
--
-- `es_demo` es la marca. Nace en `false` para que las 0190/0191 y todo
-- negocio real ya sembrado no cambien de comportamiento: el directorio
-- público (/food) seguía viendo exactamente lo mismo antes y después
-- de esta migración hasta que scripts/seed-food-demo.mjs siembre filas
-- con `es_demo = true`.
--
-- Las políticas RLS de "público ve activos" en food_businesses,
-- food_locations, food_menu_categories, food_menu_items y food_franjas
-- se PARTEN en dos cada una (real / demo) en vez de agregar un OR
-- disperso: es el mismo patrón ya usado en este archivo de tablas
-- (una política por caso de uso), y dos políticas SELECT permisivas se
-- combinan con OR — así que el conjunto total que puede leer `anon` no
-- cambia (sigue siendo "activo"), pero queda documentado cuál mitad
-- sirve a cuál pantalla. LA EXCLUSIÓN REAL de los negocios demo del
-- directorio público es de la aplicación, no de RLS: /food (el
-- directorio) filtra `es_demo = false` en su propia consulta, y
-- /food/demo filtra `es_demo = true` en la suya — ver
-- src/app/food/page.tsx y src/app/food/demo/page.tsx. Ambos usan el
-- mismo cliente anónimo que ya usaban antes de esta migración: no hace
-- falta service_role para leer negocios demo, porque son datos
-- públicos igual que los reales, solo que de mentira.
--
-- Reservas reales sobre negocios demo: el candado transaccional de
-- crear_reserva_food() (0190/0191) NO distingue es_demo — sigue sin
-- tocarse acá, a propósito, porque el dueño pidió no reconstruir el
-- core. La barrera está un nivel arriba, en la acción del servidor
-- (reservarFood, src/app/food/restaurante/[slug]/actions.ts), que
-- ahora rechaza reservar sobre una franja de un negocio con
-- es_demo = true ANTES de invocar la RPC — así ninguna reserva contra
-- un restaurante de mentira llega a escribir una fila real.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. La columna
-- ─────────────────────────────────────────────────────────────────
alter table food_businesses
  add column if not exists es_demo boolean not null default false;

create index if not exists food_businesses_demo_idx on food_businesses (es_demo) where es_demo;

comment on column food_businesses.es_demo is
  'true = negocio de muestra sembrado por scripts/seed-food-demo.mjs para /food/demo (0193). Puramente visual/explicativo: nunca es un negocio real ni acepta reservas reales (ver el guard en reservarFood()). El directorio público (/food) lo excluye filtrando es_demo=false en su propia consulta.';


-- ═══════════════════════════════════════════════════════════════════
-- 2. RLS — cada política pública "ve activos" se parte en real / demo
-- ═══════════════════════════════════════════════════════════════════

-- food_businesses
drop policy if exists "Publico ve negocios activos de FOOD" on food_businesses;
create policy "Publico ve negocios activos de FOOD" on food_businesses
  for select using (activo and not es_demo);

drop policy if exists "Publico ve negocios demo de FOOD" on food_businesses;
create policy "Publico ve negocios demo de FOOD" on food_businesses
  for select using (activo and es_demo);

-- food_locations
drop policy if exists "Publico ve sedes de negocios activos" on food_locations;
create policy "Publico ve sedes de negocios activos" on food_locations
  for select using (
    exists (select 1 from food_businesses b where b.id = business_id and b.activo and not b.es_demo)
  );

drop policy if exists "Publico ve sedes de negocios demo" on food_locations;
create policy "Publico ve sedes de negocios demo" on food_locations
  for select using (
    exists (select 1 from food_businesses b where b.id = business_id and b.activo and b.es_demo)
  );

-- food_menu_categories
drop policy if exists "Publico ve categorias de negocios activos" on food_menu_categories;
create policy "Publico ve categorias de negocios activos" on food_menu_categories
  for select using (
    exists (select 1 from food_businesses b where b.id = business_id and b.activo and not b.es_demo)
  );

drop policy if exists "Publico ve categorias de negocios demo" on food_menu_categories;
create policy "Publico ve categorias de negocios demo" on food_menu_categories
  for select using (
    exists (select 1 from food_businesses b where b.id = business_id and b.activo and b.es_demo)
  );

-- food_menu_items
drop policy if exists "Publico ve items activos de negocios activos" on food_menu_items;
create policy "Publico ve items activos de negocios activos" on food_menu_items
  for select using (
    activo and exists (select 1 from food_businesses b where b.id = business_id and b.activo and not b.es_demo)
  );

drop policy if exists "Publico ve items activos de negocios demo" on food_menu_items;
create policy "Publico ve items activos de negocios demo" on food_menu_items
  for select using (
    activo and exists (select 1 from food_businesses b where b.id = business_id and b.activo and b.es_demo)
  );

-- food_franjas
drop policy if exists "Publico ve franjas activas de negocios activos" on food_franjas;
create policy "Publico ve franjas activas de negocios activos" on food_franjas
  for select using (
    activa and exists (select 1 from food_businesses b where b.id = business_id and b.activo and not b.es_demo)
  );

drop policy if exists "Publico ve franjas activas de negocios demo" on food_franjas;
create policy "Publico ve franjas activas de negocios demo" on food_franjas
  for select using (
    activa and exists (select 1 from food_businesses b where b.id = business_id and b.activo and b.es_demo)
  );

notify pgrst, 'reload schema';
