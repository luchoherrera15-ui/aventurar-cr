
-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — el núcleo independiente (0190)
--
-- Decisión del dueño (arquitectura definitiva, confirmada): FOOD
-- reserva mesas con descuento por franja horaria (estilo Eatigo), y es
-- un dominio de negocio APARTE del marketplace de ranchos — no una
-- vertical más de él.
--
-- ── POR QUÉ NO REUSA `ranchos`/`reservas`, AUNQUE YA EXISTE UNA
--    VERTICAL "restaurantes" (src/app/restaurantes) ──────────────────
-- Esa vertical es una ficha del directorio de Bookea con reserva de
-- mesa simple, sin descuento. FOOD es otro producto: el descuento se
-- CONGELA por reserva y el cupo se protege con su propio candado
-- transaccional — mezclarlo con `ranchos` habría atado ese motor a una
-- tabla que sirve a otros ocho verticales que no tienen nada que ver.
-- Las dos cosas conviven sin relación obligatoria: un mismo dueño
-- podría tener su ficha en /restaurantes Y su negocio en /food.
-- `bookea_business_id` es el único puente, y es opcional.
--
-- Se reusa: auth.users (el cliente — no hay food_users), Storage, y el
-- resto de infraestructura transversal de Bookea. Esta migración NO
-- toca ninguna tabla ni función existente de Bookea salvo esa única FK
-- opcional hacia ranchos.id.
--
-- Sin flujo de aprobación manual: mismo criterio que el resto del
-- sitio (reserva instantánea, sin negociación previa). El dueño
-- publica y despublica su negocio con `activo`.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. food_businesses — el restaurante
-- ─────────────────────────────────────────────────────────────────
create table if not exists food_businesses (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users(id) on delete cascade,
  -- El único puente hacia Bookea, y es OPCIONAL: solo se llena si el
  -- dueño decide conectar su negocio de FOOD con su ficha del
  -- marketplace (para Wallet/Lealtad más adelante). Nunca se exige.
  bookea_business_id   uuid references ranchos(id) on delete set null,
  nombre               text not null,
  slug                 text not null unique,
  descripcion          text,
  foto_portada_url     text,
  telefono             text,
  zona_horaria         text not null default 'America/Costa_Rica',
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint food_businesses_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint food_businesses_slug_formato check (slug ~ '^[a-z0-9-]{2,60}$')
);

create index if not exists food_businesses_owner_idx on food_businesses (owner_id);
create index if not exists food_businesses_activo_idx on food_businesses (activo) where activo;

comment on table food_businesses is
  'La raíz del dominio FOOD (0190). Independiente de ranchos a propósito — ver el encabezado de esta migración.';
comment on column food_businesses.bookea_business_id is
  'Puente OPCIONAL hacia ranchos.id. null = negocio de FOOD sin ficha en el marketplace. Nunca se exige.';


-- ─────────────────────────────────────────────────────────────────
-- 2. food_locations — sedes del negocio (1:N desde el día uno)
-- ─────────────────────────────────────────────────────────────────
create table if not exists food_locations (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references food_businesses(id) on delete cascade,
  nombre       text not null,
  direccion    text,
  telefono     text,
  created_at   timestamptz not null default now(),
  constraint food_locations_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

create index if not exists food_locations_business_idx on food_locations (business_id);


-- ─────────────────────────────────────────────────────────────────
-- 3. food_hours — horario informativo (NO gatilla reservas: eso lo
--    hace food_franjas, cada una es su propio cupo)
-- ─────────────────────────────────────────────────────────────────
create table if not exists food_hours (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references food_locations(id) on delete cascade,
  dia_semana    smallint not null check (dia_semana between 0 and 6),
  abre          time not null,
  cierra        time not null,
  constraint food_hours_horario_coherente check (cierra > abre)
);

create index if not exists food_hours_location_idx on food_hours (location_id);


-- ─────────────────────────────────────────────────────────────────
-- 4. food_menu_categories / food_menu_items
-- ─────────────────────────────────────────────────────────────────
create table if not exists food_menu_categories (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references food_businesses(id) on delete cascade,
  nombre       text not null,
  orden        integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint food_menu_categories_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

create index if not exists food_menu_categories_business_idx on food_menu_categories (business_id, orden);

create table if not exists food_menu_items (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references food_businesses(id) on delete cascade,
  category_id   uuid not null references food_menu_categories(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  precio        integer not null check (precio >= 0),
  foto_url      text,
  activo        boolean not null default true,
  orden         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint food_menu_items_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

create index if not exists food_menu_items_business_idx on food_menu_items (business_id);
create index if not exists food_menu_items_category_idx on food_menu_items (category_id, orden);


-- ─────────────────────────────────────────────────────────────────
-- 5. food_franjas — LA ENTIDAD CENTRAL: la oportunidad de reserva
-- ─────────────────────────────────────────────────────────────────
create table if not exists food_franjas (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references food_businesses(id) on delete cascade,
  location_id            uuid not null references food_locations(id) on delete cascade,
  -- date/time, nunca timestamptz: se piensa en día y hora local del
  -- restaurante, no en un instante UTC. Mismo criterio que promociones
  -- (0189) y horarios_recurso.
  fecha                  date not null,
  hora                   time not null,
  capacidad              integer not null check (capacidad > 0 and capacidad <= 500),
  -- Cupo ya tomado. Se toca SOLO desde crear_reserva_food(): nunca a
  -- mano ni desde el navegador — por eso queda fuera del grant de
  -- update más abajo. El CHECK de coherencia es el cinturón además del
  -- candado transaccional del RPC.
  reservado              integer not null default 0 check (reservado >= 0),
  descuento_porcentaje   integer not null default 0
    check (descuento_porcentaje between 0 and 90),
  activa                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint food_franjas_cupo_coherente check (reservado <= capacidad),
  constraint food_franjas_unica unique (location_id, fecha, hora)
);

create index if not exists food_franjas_business_idx on food_franjas (business_id, fecha);
create index if not exists food_franjas_disponibles_idx
  on food_franjas (location_id, fecha, hora) where activa;

comment on column food_franjas.reservado is
  'Cupo tomado. Lo mueve SOLO crear_reserva_food() bajo candado transaccional — no tiene grant de update para authenticated.';
comment on column food_franjas.descuento_porcentaje is
  'El descuento de ESTA franja. crear_reserva_food() lo copia (congela) a food_reservations al reservar: cambiarlo después no reinterpreta reservas ya hechas.';


-- ─────────────────────────────────────────────────────────────────
-- 6. food_reservations
-- ─────────────────────────────────────────────────────────────────
create table if not exists food_reservations (
  id                     uuid primary key default gen_random_uuid(),
  franja_id              uuid not null references food_franjas(id) on delete restrict,
  business_id            uuid not null references food_businesses(id) on delete cascade,
  customer_id            uuid not null references auth.users(id) on delete cascade,
  party_size             integer not null check (party_size > 0 and party_size <= 30),
  -- Congelado al crear la reserva — nunca se recalcula desde la franja.
  descuento_porcentaje   integer not null check (descuento_porcentaje between 0 and 90),
  codigo_confirmacion    text not null,
  estado                 text not null default 'confirmada'
    check (estado in ('confirmada', 'check_in', 'no_show', 'cancelada')),
  notas                  text,
  created_at             timestamptz not null default now(),
  checked_in_at          timestamptz,
  checked_in_by          uuid references auth.users(id) on delete set null,
  cancelled_at           timestamptz
);

create index if not exists food_reservations_franja_idx on food_reservations (franja_id);
create index if not exists food_reservations_business_idx on food_reservations (business_id, created_at desc);
create index if not exists food_reservations_customer_idx on food_reservations (customer_id, created_at desc);
create unique index if not exists food_reservations_codigo_idx on food_reservations (codigo_confirmacion);

comment on column food_reservations.descuento_porcentaje is
  'Copiado de food_franjas al momento de reservar (congelado). El navegador nunca manda este número — lo decide crear_reserva_food().';


-- ─────────────────────────────────────────────────────────────────
-- 7. gestiona_negocio_food() — el mismo molde de gestiona_rancho
--    (0116), propio de FOOD, sin ninguna referencia a
--    rancho_colaboradores.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.gestiona_negocio_food(p_negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_negocio is not null
     and auth.uid() is not null
     and (
       exists (select 1 from public.food_businesses b
                where b.id = p_negocio and b.owner_id = auth.uid())
       or exists (select 1 from public.perfiles p
                   where p.id = auth.uid() and p.rol = 'admin')
     );
$$;

revoke all on function public.gestiona_negocio_food(uuid) from public, anon;
grant execute on function public.gestiona_negocio_food(uuid) to authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- RLS — quién ve y toca qué
-- ═══════════════════════════════════════════════════════════════════
alter table food_businesses enable row level security;
alter table food_locations enable row level security;
alter table food_hours enable row level security;
alter table food_menu_categories enable row level security;
alter table food_menu_items enable row level security;
alter table food_franjas enable row level security;
alter table food_reservations enable row level security;

-- food_businesses
drop policy if exists "Publico ve negocios activos de FOOD" on food_businesses;
create policy "Publico ve negocios activos de FOOD" on food_businesses
  for select using (activo);

drop policy if exists "El dueno ve su negocio de FOOD" on food_businesses;
create policy "El dueno ve su negocio de FOOD" on food_businesses
  for select using (gestiona_negocio_food(id));

drop policy if exists "El dueno crea su negocio de FOOD" on food_businesses;
create policy "El dueno crea su negocio de FOOD" on food_businesses
  for insert with check (owner_id = auth.uid());

drop policy if exists "El dueno edita su negocio de FOOD" on food_businesses;
create policy "El dueno edita su negocio de FOOD" on food_businesses
  for update using (gestiona_negocio_food(id)) with check (gestiona_negocio_food(id));

grant select, insert on food_businesses to authenticated;
grant update (
  nombre, descripcion, foto_portada_url, telefono, zona_horaria,
  activo, bookea_business_id, updated_at
) on food_businesses to authenticated;
grant select on food_businesses to anon;
grant all on food_businesses to service_role;

-- food_locations
drop policy if exists "Publico ve sedes de negocios activos" on food_locations;
create policy "Publico ve sedes de negocios activos" on food_locations
  for select using (
    exists (select 1 from food_businesses b where b.id = business_id and b.activo)
  );

drop policy if exists "El dueno administra sus sedes" on food_locations;
create policy "El dueno administra sus sedes" on food_locations
  for all using (gestiona_negocio_food(business_id)) with check (gestiona_negocio_food(business_id));

grant select on food_locations to anon;
grant select, insert, update, delete on food_locations to authenticated;
grant all on food_locations to service_role;

-- food_hours
drop policy if exists "Publico ve horario de negocios activos" on food_hours;
create policy "Publico ve horario de negocios activos" on food_hours
  for select using (
    exists (
      select 1 from food_locations l join food_businesses b on b.id = l.business_id
       where l.id = location_id and b.activo
    )
  );

drop policy if exists "El dueno administra su horario" on food_hours;
create policy "El dueno administra su horario" on food_hours
  for all using (
    exists (select 1 from food_locations l where l.id = location_id and gestiona_negocio_food(l.business_id))
  ) with check (
    exists (select 1 from food_locations l where l.id = location_id and gestiona_negocio_food(l.business_id))
  );

grant select on food_hours to anon;
grant select, insert, update, delete on food_hours to authenticated;
grant all on food_hours to service_role;

-- food_menu_categories
drop policy if exists "Publico ve categorias de negocios activos" on food_menu_categories;
create policy "Publico ve categorias de negocios activos" on food_menu_categories
  for select using (
    exists (select 1 from food_businesses b where b.id = business_id and b.activo)
  );

drop policy if exists "El dueno administra sus categorias" on food_menu_categories;
create policy "El dueno administra sus categorias" on food_menu_categories
  for all using (gestiona_negocio_food(business_id)) with check (gestiona_negocio_food(business_id));

grant select on food_menu_categories to anon;
grant select, insert, update, delete on food_menu_categories to authenticated;
grant all on food_menu_categories to service_role;

-- food_menu_items
drop policy if exists "Publico ve items activos de negocios activos" on food_menu_items;
create policy "Publico ve items activos de negocios activos" on food_menu_items
  for select using (
    activo and exists (select 1 from food_businesses b where b.id = business_id and b.activo)
  );

drop policy if exists "El dueno administra su menu" on food_menu_items;
create policy "El dueno administra su menu" on food_menu_items
  for all using (gestiona_negocio_food(business_id)) with check (gestiona_negocio_food(business_id));

grant select on food_menu_items to anon;
grant select, insert, update, delete on food_menu_items to authenticated;
grant all on food_menu_items to service_role;

-- food_franjas
drop policy if exists "Publico ve franjas activas de negocios activos" on food_franjas;
create policy "Publico ve franjas activas de negocios activos" on food_franjas
  for select using (
    activa and exists (select 1 from food_businesses b where b.id = business_id and b.activo)
  );

drop policy if exists "El dueno ve sus franjas" on food_franjas;
create policy "El dueno ve sus franjas" on food_franjas
  for select using (gestiona_negocio_food(business_id));

drop policy if exists "El dueno crea sus franjas" on food_franjas;
create policy "El dueno crea sus franjas" on food_franjas
  for insert with check (gestiona_negocio_food(business_id));

drop policy if exists "El dueno edita sus franjas" on food_franjas;
create policy "El dueno edita sus franjas" on food_franjas
  for update using (gestiona_negocio_food(business_id)) with check (gestiona_negocio_food(business_id));

drop policy if exists "El dueno borra sus franjas" on food_franjas;
create policy "El dueno borra sus franjas" on food_franjas
  for delete using (gestiona_negocio_food(business_id));

grant select on food_franjas to anon;
grant select, insert, delete on food_franjas to authenticated;
-- `reservado` FUERA del grant: solo lo mueve la RPC (service_role).
grant update (location_id, fecha, hora, capacidad, descuento_porcentaje, activa, updated_at)
  on food_franjas to authenticated;
grant all on food_franjas to service_role;

-- food_reservations
-- Nadie inserta directo: crear_reserva_food() corre con service_role
-- (más abajo), igual que acreditar_lealtad (0125) — así el cupo y el
-- descuento nunca los decide el navegador.
drop policy if exists "El cliente ve sus reservas de FOOD" on food_reservations;
create policy "El cliente ve sus reservas de FOOD" on food_reservations
  for select using (customer_id = auth.uid());

drop policy if exists "El negocio ve las reservas de su FOOD" on food_reservations;
create policy "El negocio ve las reservas de su FOOD" on food_reservations
  for select using (gestiona_negocio_food(business_id));

drop policy if exists "El negocio hace check-in de sus reservas" on food_reservations;
create policy "El negocio hace check-in de sus reservas" on food_reservations
  for update using (gestiona_negocio_food(business_id)) with check (gestiona_negocio_food(business_id));

grant select on food_reservations to authenticated;
grant update (estado, checked_in_at, checked_in_by, cancelled_at) on food_reservations to authenticated;
grant all on food_reservations to service_role;


-- ═══════════════════════════════════════════════════════════════════
-- RPC: crear_reserva_food — la reserva atómica y segura de cupo
--
-- Candado (pg_advisory_xact_lock) + lectura + inserción + incremento
-- del cupo, TODO dentro de la misma función: dos llamadas simultáneas
-- sobre la misma franja se serializan, la segunda ve el cupo ya
-- descontado por la primera y nunca las dos pueden juntas superar la
-- capacidad. Mismo patrón que acreditar_lealtad (0125), que ya corre
-- así en producción.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.crear_reserva_food(
  p_franja_id uuid,
  p_customer_id uuid,
  p_party_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_franja record;
  v_codigo text;
  v_reserva_id uuid;
  v_intento integer;
begin
  if p_party_size is null or p_party_size <= 0 or p_party_size > 30 then
    return jsonb_build_object('ok', false, 'motivo', 'La cantidad de personas no es válida.');
  end if;

  perform pg_advisory_xact_lock(hashtext('food_franja:' || p_franja_id::text));

  select * into v_franja from food_franjas where id = p_franja_id;
  if v_franja.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'Esa franja no existe.');
  end if;
  if not v_franja.activa then
    return jsonb_build_object('ok', false, 'motivo', 'Esa franja ya no está disponible.');
  end if;
  if v_franja.fecha < (now() at time zone 'America/Costa_Rica')::date then
    return jsonb_build_object('ok', false, 'motivo', 'Esa franja ya pasó.');
  end if;
  if (v_franja.capacidad - v_franja.reservado) < p_party_size then
    return jsonb_build_object('ok', false, 'motivo',
      'No hay cupo suficiente: quedan ' || (v_franja.capacidad - v_franja.reservado) || ' lugares.');
  end if;

  v_reserva_id := null;
  for v_intento in 1..5 loop
    v_codigo := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin
      insert into food_reservations
        (franja_id, business_id, customer_id, party_size, descuento_porcentaje, codigo_confirmacion)
      values
        (p_franja_id, v_franja.business_id, p_customer_id, p_party_size,
         v_franja.descuento_porcentaje, v_codigo)
      returning id into v_reserva_id;
      exit;
    exception when unique_violation then
      v_reserva_id := null;
    end;
  end loop;

  if v_reserva_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'No se pudo generar un código, intentá de nuevo.');
  end if;

  update food_franjas set reservado = reservado + p_party_size, updated_at = now()
   where id = p_franja_id;

  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'codigo', v_codigo,
    'descuento_porcentaje', v_franja.descuento_porcentaje,
    'fecha', v_franja.fecha,
    'hora', v_franja.hora
  );
end;
$$;

-- Solo service_role: el servidor valida sesión y datos ANTES de
-- invocar (ver src/app/food/restaurante/[slug]/actions.ts). Un cliente
-- autenticado no puede llamarla directo.
revoke all on function public.crear_reserva_food(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.crear_reserva_food(uuid, uuid, integer) to service_role;

notify pgrst, 'reload schema';
