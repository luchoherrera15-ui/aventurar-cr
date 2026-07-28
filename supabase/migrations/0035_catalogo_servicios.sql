-- ------------------------------------------------------------
-- Catálogo por negocio (menús, paquetes, productos) + pedido
-- estructurado en la reserva.
--
-- La meta: que un catering pueda publicar su menú, un DJ sus
-- paquetes, un alquiler su inventario — y que el cliente arme su
-- pedido al reservar la fecha, en vez de irse a WhatsApp a
-- preguntar "¿qué tienen?". El flujo de reservas de Lugares no se
-- toca: esto es para las demás categorías.
-- ------------------------------------------------------------

create table if not exists rancho_items (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 120),
  descripcion text check (descripcion is null or char_length(descripcion) <= 500),
  -- Precio opcional: "a cotizar" también es válido.
  precio numeric check (precio is null or precio >= 0),
  -- Cómo se cobra ese ítem: "por persona", "por unidad", "por hora"...
  unidad text check (unidad is null or char_length(unidad) <= 40),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists rancho_items_rancho_idx on rancho_items (rancho_id, orden);

alter table rancho_items enable row level security;

-- El catálogo es parte del portal público del negocio.
drop policy if exists "Catálogo visible para todos" on rancho_items;
create policy "Catálogo visible para todos" on rancho_items
  for select to anon, authenticated
  using (true);

drop policy if exists "Dueño administra su catálogo" on rancho_items;
create policy "Dueño administra su catálogo" on rancho_items
  for all to authenticated
  using (
    is_admin() or exists (
      select 1 from ranchos r where r.id = rancho_id and r.owner_id = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from ranchos r where r.id = rancho_id and r.owner_id = auth.uid()
    )
  );

grant select on rancho_items to anon, authenticated;
grant insert, update, delete on rancho_items to authenticated;

-- El pedido que armó el cliente al reservar, como snapshot:
-- { items: [{ item_id, nombre, precio, unidad, cantidad }], total_estimado }
-- Snapshot a propósito — si el proveedor cambia precios después, lo
-- pedido queda como estaba al momento de pedirlo.
alter table reservas add column if not exists detalle_pedido jsonb;
