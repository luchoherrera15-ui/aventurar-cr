-- ------------------------------------------------------------
-- El catálogo pasa de "lista de precios" a paquetes reservables.
--
-- La visión: un photobooth publica "Estación 1 · 5 horas · ₡85.000 ·
-- tengo 2", una barra de cócteles su menú de productos, y el cliente
-- arma su reserva directo — sin pasar por el chat. Para eso el ítem
-- necesita foto, duración, mínimos/máximos por pedido, sección para
-- agrupar, y cuántas unidades se pueden atender por día.
--
-- El pedido, además, deja de vivir SOLO dentro de un jsonb. El jsonb
-- (reservas.detalle_pedido) se mantiene: es el snapshot legible que
-- arma el primer mensaje del chat y que leen las reservas viejas. La
-- tabla reserva_items es lo que se puede CONTAR: sin ella, responder
-- "¿cuántas estaciones quedan libres el 12 de octubre?" obligaría a
-- escanear el jsonb de todas las reservas del negocio por cada celda
-- del calendario. Regla: jsonb = lo que se le muestra a un humano;
-- reserva_items = lo que se cuenta.
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

alter table rancho_items add column if not exists foto_url text;
alter table rancho_items add column if not exists duracion_horas numeric;
alter table rancho_items add column if not exists grupo text;
alter table rancho_items add column if not exists tipo text not null default 'producto';
alter table rancho_items add column if not exists min_por_reserva integer not null default 1;
alter table rancho_items add column if not exists max_por_reserva integer;
alter table rancho_items add column if not exists capacidad_dia integer;

-- 'paquete' = tarjeta grande con foto (una estación de fotos, un combo
-- DJ); 'producto' = fila compacta con contador (un plato, una silla).
-- El default 'producto' deja los catálogos ya cargados viéndose igual.
alter table rancho_items drop constraint if exists rancho_items_tipo_check;
alter table rancho_items add constraint rancho_items_tipo_check
  check (tipo in ('paquete', 'producto'));

alter table rancho_items drop constraint if exists rancho_items_grupo_check;
alter table rancho_items add constraint rancho_items_grupo_check
  check (grupo is null or char_length(trim(grupo)) between 1 and 40);

alter table rancho_items drop constraint if exists rancho_items_duracion_check;
alter table rancho_items add constraint rancho_items_duracion_check
  check (duracion_horas is null or (duracion_horas > 0 and duracion_horas <= 240));

alter table rancho_items drop constraint if exists rancho_items_cantidades_check;
alter table rancho_items add constraint rancho_items_cantidades_check
  check (min_por_reserva >= 1
     and (max_por_reserva is null or max_por_reserva >= min_por_reserva)
     and (capacidad_dia is null or capacidad_dia >= 1));

-- `orden` existía desde 0035 pero nunca se escribió: todo vale 0 y el
-- orden real era el de creación. Se numera una vez, respetando ese
-- orden, para que el reordenar del panel tenga de dónde partir.
with numerados as (
  select id,
         row_number() over (partition by rancho_id order by orden, created_at) as n
  from rancho_items
)
update rancho_items i
set orden = numerados.n
from numerados
where numerados.id = i.id
  and i.orden = 0;

-- ------------------------------------------------------------
-- El pedido, ya normalizado. Cada línea copia nombre, precio, unidad
-- y duración AL MOMENTO de reservar: si el proveedor después cambia
-- el precio o borra el paquete, la reserva no cambia ni pierde nada
-- (item_id queda en null, la línea sigue completa).
-- ------------------------------------------------------------

create table if not exists reserva_items (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id) on delete cascade,
  item_id uuid references rancho_items(id) on delete set null,
  nombre text not null,
  precio_unitario numeric,
  unidad text,
  duracion_horas numeric,
  cantidad integer not null check (cantidad between 1 and 999),
  created_at timestamptz not null default now()
);

create index if not exists reserva_items_reserva_idx on reserva_items (reserva_id);
create index if not exists reserva_items_item_idx on reserva_items (item_id);

alter table reserva_items enable row level security;

-- Las líneas siguen a su reserva: las ve el equipo, el cliente que la
-- hizo, o el dueño del negocio. Nadie más.
drop policy if exists "Las líneas siguen a su reserva" on reserva_items;
create policy "Las líneas siguen a su reserva" on reserva_items
  for select to authenticated
  using (
    exists (
      select 1 from reservas r
      where r.id = reserva_id
        and (
          is_admin()
          or r.cliente_id = auth.uid()
          or r.rancho_id in (select id from ranchos where owner_id = auth.uid())
        )
    )
  );

-- ------------------------------------------------------------
-- Cuánto de cada paquete está tomado, por fecha. Mismo patrón que
-- disponibilidad_rancho (0011): números agregados, sin ningún dato
-- personal, para que el calendario público pinte "Queda 1".
-- ------------------------------------------------------------

create or replace view disponibilidad_items as
  select ri.item_id,
         r.rancho_id,
         r.fecha,
         sum(ri.cantidad)::int as reservadas
  from reserva_items ri
  join reservas r on r.id = ri.reserva_id
  where ri.item_id is not null
    and (
      r.estado in ('pendiente', 'confirmada')
      or (r.estado = 'temporal' and r.expira_en > now())
    )
  group by ri.item_id, r.rancho_id, r.fecha;

grant select on disponibilidad_items to anon, authenticated;

notify pgrst, 'reload schema';
