
-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — favoritos reales (0201)
--
-- Hasta acá "favoritos" solo existía en /food/demo (localStorage,
-- puramente visual). restaurante-card.tsx lo decía explícito: "sin
-- corazón de favoritos... un control que no hace nada es peor que no
-- tenerlo". Esta migración es lo que lo vuelve real para el
-- directorio de verdad.
--
-- Mismo molde que food_reservations (0190): FK a auth.users, RLS por
-- customer_id = auth.uid(), sin service_role de por medio porque acá
-- no hay ningún cupo ni candado que proteger — guardar y sacar un
-- favorito es una operación del propio dueño de la fila, directa.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists food_favoritos (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references auth.users(id) on delete cascade,
  business_id   uuid not null references food_businesses(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint food_favoritos_unico unique (customer_id, business_id)
);

create index if not exists food_favoritos_customer_idx on food_favoritos (customer_id, created_at desc);
create index if not exists food_favoritos_business_idx on food_favoritos (business_id);

comment on table food_favoritos is
  'Favoritos reales del directorio de FOOD (0201). El customer_id es el único que puede leer/escribir sus propias filas.';

alter table food_favoritos enable row level security;

drop policy if exists "El cliente ve sus favoritos de FOOD" on food_favoritos;
create policy "El cliente ve sus favoritos de FOOD" on food_favoritos
  for select using (customer_id = auth.uid());

drop policy if exists "El cliente guarda sus favoritos de FOOD" on food_favoritos;
create policy "El cliente guarda sus favoritos de FOOD" on food_favoritos
  for insert with check (customer_id = auth.uid());

drop policy if exists "El cliente quita sus favoritos de FOOD" on food_favoritos;
create policy "El cliente quita sus favoritos de FOOD" on food_favoritos
  for delete using (customer_id = auth.uid());

grant select, insert, delete on food_favoritos to authenticated;
grant all on food_favoritos to service_role;

notify pgrst, 'reload schema';
