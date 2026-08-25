-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — "To Go": pedidos para llevar, sin comisión (0207)
--
-- Decisión del dueño: se paga al retirar en el restaurante (efectivo o
-- datáfono propio) — Bookea nunca toca el dinero del pedido, así que
-- "sin comisión" es automático y no hace falta integrar ningún
-- procesador de pagos. Por eso food_pedidos no tiene columna de pago:
-- solo el total informativo (para que el cliente sepa cuánto llevar).
--
-- Se activa SOLO si el negocio tiene menú cargado (food_menu_items
-- activos) — mismos datos que ya usa la reserva de mesa. El dueño
-- puede apagarlo con `acepta_para_llevar` aunque tenga menú.
--
-- Sin cupo ni franja: a diferencia de food_franjas (reserva de mesa
-- con descuento por horario), acá es una cola simple de pedidos — no
-- hay un recurso escaso que proteger con un candado transaccional.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════

alter table food_businesses
  add column if not exists acepta_para_llevar boolean not null default true;

comment on column food_businesses.acepta_para_llevar is
  'Interruptor del dueño para "To Go" (0207). Default true: se ofrece solo con tener menú cargado, sin pedir un alta aparte.';


-- ─────────────────────────────────────────────────────────────────
-- 1. food_pedidos — el pedido para llevar
-- ─────────────────────────────────────────────────────────────────
create table if not exists food_pedidos (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references food_businesses(id) on delete cascade,
  customer_id            uuid not null references auth.users(id) on delete cascade,
  codigo_confirmacion    text not null,
  estado                 text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmado', 'listo', 'entregado', 'cancelado')),
  -- Hora de retiro solicitada por el cliente, texto libre corto tipo
  -- "Lo antes posible" o "12:30 p.m." — no es una franja con cupo, así
  -- que no hace falta date/time real acá.
  hora_retiro            text,
  notas                  text,
  -- Suma de food_pedido_items.subtotal, congelada al crear el pedido.
  total                  integer not null check (total >= 0),
  created_at             timestamptz not null default now(),
  confirmado_at          timestamptz,
  listo_at               timestamptz,
  entregado_at           timestamptz,
  cancelado_at           timestamptz
);

create index if not exists food_pedidos_business_idx on food_pedidos (business_id, created_at desc);
create index if not exists food_pedidos_customer_idx on food_pedidos (customer_id, created_at desc);
create unique index if not exists food_pedidos_codigo_idx on food_pedidos (codigo_confirmacion);

comment on table food_pedidos is
  'Pedidos "To Go" (0207) — se paga al retirar, Bookea no cobra comisión. Independiente de food_reservations (mesa).';


-- ─────────────────────────────────────────────────────────────────
-- 2. food_pedido_items — líneas del pedido, precio CONGELADO
-- ─────────────────────────────────────────────────────────────────
create table if not exists food_pedido_items (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references food_pedidos(id) on delete cascade,
  -- set null (no cascade): si el dueño borra el plato después, el
  -- historial del pedido no debe desaparecer ni romperse.
  menu_item_id  uuid references food_menu_items(id) on delete set null,
  nombre        text not null,
  precio        integer not null check (precio >= 0),
  cantidad      integer not null check (cantidad > 0 and cantidad <= 50),
  subtotal      integer not null check (subtotal >= 0)
);

create index if not exists food_pedido_items_pedido_idx on food_pedido_items (pedido_id);

comment on column food_pedido_items.precio is
  'Copiado de food_menu_items.precio al crear el pedido (congelado) — un cambio de precio después no reinterpreta pedidos ya hechos.';


-- ═══════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════
alter table food_pedidos enable row level security;
alter table food_pedido_items enable row level security;

-- food_pedidos
drop policy if exists "El cliente ve sus pedidos de FOOD" on food_pedidos;
create policy "El cliente ve sus pedidos de FOOD" on food_pedidos
  for select using (customer_id = auth.uid());

drop policy if exists "El negocio ve los pedidos de su FOOD" on food_pedidos;
create policy "El negocio ve los pedidos de su FOOD" on food_pedidos
  for select using (gestiona_negocio_food(business_id));

-- El cliente solo puede cancelar (pendiente → cancelado), nunca
-- avanzar el pedido: `using` mira la fila VIEJA, `with check` la
-- NUEVA, así que esta policy es exactamente esa única transición.
drop policy if exists "El cliente cancela su pedido pendiente" on food_pedidos;
create policy "El cliente cancela su pedido pendiente" on food_pedidos
  for update using (customer_id = auth.uid() and estado = 'pendiente')
  with check (customer_id = auth.uid() and estado = 'cancelado');

drop policy if exists "El negocio avanza el estado de sus pedidos" on food_pedidos;
create policy "El negocio avanza el estado de sus pedidos" on food_pedidos
  for update using (gestiona_negocio_food(business_id)) with check (gestiona_negocio_food(business_id));

grant select on food_pedidos to authenticated;
grant update (estado, confirmado_at, listo_at, entregado_at, cancelado_at) on food_pedidos to authenticated;
grant all on food_pedidos to service_role;

-- food_pedido_items — de solo lectura para authenticated (se crean
-- únicamente desde crear_pedido_food, más abajo).
drop policy if exists "El cliente ve los items de sus pedidos" on food_pedido_items;
create policy "El cliente ve los items de sus pedidos" on food_pedido_items
  for select using (
    exists (select 1 from food_pedidos p where p.id = pedido_id and p.customer_id = auth.uid())
  );

drop policy if exists "El negocio ve los items de sus pedidos" on food_pedido_items;
create policy "El negocio ve los items de sus pedidos" on food_pedido_items
  for select using (
    exists (select 1 from food_pedidos p where p.id = pedido_id and gestiona_negocio_food(p.business_id))
  );

grant select on food_pedido_items to authenticated;
grant all on food_pedido_items to service_role;


-- ═══════════════════════════════════════════════════════════════════
-- RPC: crear_pedido_food — el precio y el total los decide el
-- servidor, NUNCA el teléfono. Sin candado transaccional: a diferencia
-- de food_franjas acá no hay cupo que proteger.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.crear_pedido_food(
  p_business_id uuid,
  p_customer_id uuid,
  p_items jsonb,       -- [{ "menu_item_id": uuid, "cantidad": int }, ...]
  p_hora_retiro text,
  p_notas text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio record;
  v_item record;
  v_pedido_id uuid;
  v_codigo text;
  v_total integer := 0;
  v_cantidad integer;
  v_item_ids uuid[];
  v_i integer;
begin
  select id, activo, acepta_para_llevar into v_negocio from food_businesses where id = p_business_id;
  if v_negocio.id is null or not v_negocio.activo then
    return jsonb_build_object('ok', false, 'motivo', 'Ese restaurante no está disponible.');
  end if;
  if not v_negocio.acepta_para_llevar then
    return jsonb_build_object('ok', false, 'motivo', 'Ese restaurante no ofrece pedidos para llevar por ahora.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'El pedido no tiene platos.');
  end if;
  if jsonb_array_length(p_items) > 40 then
    return jsonb_build_object('ok', false, 'motivo', 'Ese pedido tiene demasiadas líneas.');
  end if;

  select array_agg((e->>'menu_item_id')::uuid) into v_item_ids
    from jsonb_array_elements(p_items) e;
  if array_length(v_item_ids, 1) <> (select count(distinct x) from unnest(v_item_ids) x) then
    return jsonb_build_object('ok', false, 'motivo', 'El pedido tiene un plato repetido.');
  end if;

  v_pedido_id := null;
  for v_i in 1..5 loop
    v_codigo := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin
      insert into food_pedidos (business_id, customer_id, codigo_confirmacion, hora_retiro, notas, total)
      values (p_business_id, p_customer_id, v_codigo, nullif(btrim(p_hora_retiro), ''), nullif(btrim(p_notas), ''), 0)
      returning id into v_pedido_id;
      exit;
    exception when unique_violation then
      v_pedido_id := null;
    end;
  end loop;

  if v_pedido_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'No se pudo generar un código, intentá de nuevo.');
  end if;

  for v_item in
    select
      (e->>'menu_item_id')::uuid as menu_item_id,
      (e->>'cantidad')::integer as cantidad
    from jsonb_array_elements(p_items) e
  loop
    v_cantidad := v_item.cantidad;
    if v_cantidad is null or v_cantidad <= 0 or v_cantidad > 50 then
      raise exception 'cantidad_invalida';
    end if;

    insert into food_pedido_items (pedido_id, menu_item_id, nombre, precio, cantidad, subtotal)
    select v_pedido_id, mi.id, mi.nombre, mi.precio, v_cantidad, mi.precio * v_cantidad
      from food_menu_items mi
     where mi.id = v_item.menu_item_id
       and mi.business_id = p_business_id
       and mi.activo;

    if not found then
      raise exception 'plato_invalido';
    end if;

    v_total := v_total + (select precio * v_cantidad from food_menu_items where id = v_item.menu_item_id);
  end loop;

  update food_pedidos set total = v_total where id = v_pedido_id;

  return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'codigo', v_codigo, 'total', v_total);
exception
  when others then
    if v_pedido_id is not null then
      delete from food_pedidos where id = v_pedido_id;
    end if;
    if sqlerrm = 'cantidad_invalida' then
      return jsonb_build_object('ok', false, 'motivo', 'Alguna cantidad no es válida.');
    elsif sqlerrm = 'plato_invalido' then
      return jsonb_build_object('ok', false, 'motivo', 'Algún plato ya no está disponible.');
    end if;
    return jsonb_build_object('ok', false, 'motivo', 'No se pudo crear el pedido, intentá de nuevo.');
end;
$$;

revoke all on function public.crear_pedido_food(uuid, uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.crear_pedido_food(uuid, uuid, jsonb, text, text) to service_role;

notify pgrst, 'reload schema';
