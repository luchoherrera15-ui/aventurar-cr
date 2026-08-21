-- ─────────────────────────────────────────────────────────────────────
-- 0198: EL CATÁLOGO DE PRODUCTOS DEL NEGOCIO.
--
-- La 0197 le dio a cada sello su compra (`lealtad_transacciones`:
-- monto + producto), pero el mostrador escribe las DOS cosas a mano en
-- cada venta: el monto tecleado y el producto como texto libre. O sea
-- que «¿dónde configuro cuánto vale un capuchino?» no tenía respuesta
-- —no había dónde— y «Capuchino», «capuchino» y «Capucchino» eran tres
-- productos distintos en el reporte de ventas.
--
-- Esta migración agrega el CATÁLOGO: el dueño carga sus productos con
-- su precio una vez, y en la caja se elige de una lista que rellena el
-- monto sola. El monto sigue siendo EDITABLE (una venta puede llevar
-- dos cafés) y el catálogo sigue siendo OPCIONAL: sin productos
-- cargados, el mostrador se comporta exactamente igual que hoy.
--
-- ── DE QUIÉN ES ESTA TABLA ───────────────────────────────────────────
-- Del DUEÑO, con el mismo criterio de la 0196 (ubicaciones): el precio
-- de lo que se vende es CONFIGURACIÓN del negocio, no operación de
-- mostrador. Quien acredita sellos (un colaborador con `acreditar`)
-- ELIGE del catálogo; quien lo define es el dueño. Por eso la RLS va
-- por `ranchos.owner_id` y no por `gestiona_rancho`.
--
-- ── TOPE: 100 PRODUCTOS POR NEGOCIO ──────────────────────────────────
-- No es un límite comercial (ningún paquete promete «X productos»): es
-- el techo que hace que un desplegable en el teléfono del mostrador
-- siga siendo usable y que un bucle del navegador no llene la tabla.
-- Se remacha con trigger, porque un tope que solo vive en TypeScript es
-- decorativo (misma lección que la 0196).
--
-- ── EL HISTÓRICO NO SE TOCA ──────────────────────────────────────────
-- `lealtad_transacciones` gana `producto_id`, con ON DELETE SET NULL:
-- borrar un producto del catálogo NO puede borrar la venta que lo
-- vendió. El `producto` de TEXTO que la 0197 ya guarda queda como la
-- foto del nombre al momento de la venta — si mañana «Café» pasa a
-- llamarse «Café de la casa», el reporte del mes pasado sigue diciendo
-- lo que decía el menú ese día.
--
-- Es seguro correr esta migración varias veces.
-- ─────────────────────────────────────────────────────────────────────

-- ------------------------------------------------------------
-- 1. lealtad_productos — lo que el negocio vende, con su precio
-- ------------------------------------------------------------
create table if not exists lealtad_productos (
  id        uuid primary key default gen_random_uuid(),
  -- Por NEGOCIO y no por programa, igual que las ubicaciones (0196):
  -- el menú del local es el mismo emita una tarjeta o emita tres.
  rancho_id uuid not null references ranchos(id) on delete cascade,

  -- Como lo llama el negocio en su menú («Capuchino grande»). 80, el
  -- mismo tope que el nombre de una ubicación: lo que no entra en un
  -- renglón de la caja no sirve en la caja.
  nombre text not null check (char_length(nombre) between 1 and 80),

  -- Colones. `> 0` a propósito: un producto de ₡0 no es un precio, es
  -- un campo que quedó sin llenar — y al elegirlo en la caja pondría el
  -- monto en cero sin que nadie se dé cuenta. Lo que se regala se
  -- entrega por «Recompensas», que es donde vive lo gratis.
  -- El techo es el MISMO que el del monto de una compra (0197), para
  -- que un producto no pueda valer más que la venta más grande posible.
  precio numeric not null check (precio > 0 and precio <= 10000000),

  -- Apagado en vez de borrado: el café de temporada sale del menú sin
  -- perder las ventas que ya generó ni el renglón del reporte.
  activo boolean not null default true,

  -- En qué orden se ofrece en la caja. Empatados, manda el nombre.
  orden integer not null default 0,

  created_at timestamptz not null default now()
);

comment on table lealtad_productos is
  'El CATÁLOGO del negocio (0198): qué vende y a cuánto. El mostrador '
  'elige de acá y el monto de la venta se rellena solo (editable). '
  'Configuración del DUEÑO — quien acredita elige, no define precios. '
  'Máx. 100 por negocio (trigger).';
comment on column lealtad_productos.precio is
  'Colones. > 0: un producto de ₡0 es un campo sin llenar, no un precio.';
comment on column lealtad_productos.activo is
  'false = fuera del menú. No se borra: las ventas viejas lo siguen nombrando.';

-- El eje de lectura de la caja: los ACTIVOS de este negocio.
create index if not exists lealtad_productos_rancho_activo_idx
  on lealtad_productos (rancho_id, activo, orden);

-- Dos productos con el mismo nombre en el mismo negocio son un error de
-- carga que después se lee como dos renglones iguales en el reporte.
-- Sin distinguir mayúsculas: «Capuchino» y «capuchino» son el mismo.
create unique index if not exists lealtad_productos_nombre_unico
  on lealtad_productos (rancho_id, lower(nombre));

-- ── El tope de 100, remachado en la base ────────────────────────────
-- Un CHECK no puede contar filas, así que va por trigger. El `for
-- update` sobre la fila del rancho serializa dos inserts simultáneos
-- del mismo negocio: sin él, dos pestañas contando 99 a la vez meten
-- 101 (misma construcción que `lealtad_ubicaciones_tope`, 0196).
create or replace function public.lealtad_productos_tope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.ranchos r where r.id = new.rancho_id for update;

  if (select count(*)
        from public.lealtad_productos pr
       where pr.rancho_id = new.rancho_id) >= 100 then
    raise exception 'Un negocio puede tener hasta 100 productos en su catálogo.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- La 0083 revocó el EXECUTE por defecto; un trigger no lo necesita para
-- dispararse, pero se deja explícito que nadie la llama a mano.
revoke all on function public.lealtad_productos_tope() from public, anon, authenticated;

drop trigger if exists lealtad_productos_tope_trg on lealtad_productos;
create trigger lealtad_productos_tope_trg
  before insert on lealtad_productos
  for each row execute function public.lealtad_productos_tope();

-- ── RLS: del dueño y de nadie más ───────────────────────────────────
-- anon NADA, ni siquiera select: el catálogo es el costo interno del
-- negocio y no una carta pública. La caja no lo lee por RLS tampoco —
-- lo lee el SERVIDOR con la llave de servicio y le manda al navegador
-- solo los activos, igual que el resto del panel.
--
-- Patrón 0196 (owner_id) y no `gestiona_rancho`: definir el precio de
-- lo que se vende es identidad/configuración del negocio, no operación
-- de mostrador. Un colaborador con permiso de acreditar ELIGE del
-- catálogo; cambiarle el precio a un producto es del dueño.
alter table lealtad_productos enable row level security;

drop policy if exists "El dueño ve su catálogo" on lealtad_productos;
create policy "El dueño ve su catálogo" on lealtad_productos
  for select using (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

drop policy if exists "El dueño agrega productos" on lealtad_productos;
create policy "El dueño agrega productos" on lealtad_productos
  for insert with check (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

drop policy if exists "El dueño corrige sus productos" on lealtad_productos;
create policy "El dueño corrige sus productos" on lealtad_productos
  for update using (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  ) with check (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

drop policy if exists "El dueño elimina sus productos" on lealtad_productos;
create policy "El dueño elimina sus productos" on lealtad_productos
  for delete using (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

-- Sin grants la RLS más perfecta da "permission denied" (lección 0119).
-- El UPDATE va POR COLUMNA (patrón 0127/0126): `rancho_id` no está en
-- la lista, así que ni siquiera con la política a favor se puede mover
-- un producto —con su historial de ventas colgando— al catálogo de
-- otro negocio. Lo que se edita es lo que se ve en pantalla.
grant select, insert, delete on lealtad_productos to authenticated;
grant update (nombre, precio, activo, orden) on lealtad_productos to authenticated;
grant all on lealtad_productos to service_role;

-- ------------------------------------------------------------
-- 2. lealtad_transacciones aprende de QUÉ producto fue la venta
-- ------------------------------------------------------------
-- ON DELETE SET NULL y no CASCADE: si el dueño saca un producto del
-- catálogo, las ventas de ese producto NO se borran — se quedan sin el
-- enlace y con su nombre de texto intacto, que es justo para lo que la
-- 0197 guarda `producto`. El histórico de plata no depende del menú de
-- hoy.
alter table lealtad_transacciones
  add column if not exists producto_id uuid references lealtad_productos(id) on delete set null;

comment on column lealtad_transacciones.producto_id is
  'El producto del catálogo (0198) que se vendió. NULL = venta a mano o '
  'producto ya retirado del menú. El nombre de la venta vive en '
  '`producto` (texto), que es la foto del momento y no cambia.';

-- Sin este índice, borrar un producto escanea toda la tabla para poner
-- los NULL (el mismo criterio que los otros FK de la 0197).
create index if not exists lealtad_transacciones_producto_idx
  on lealtad_transacciones (producto_id) where producto_id is not null;

-- `grant select on lealtad_transacciones` (0197) es a nivel de TABLA y
-- ya cubre la columna nueva; se deja explícito para que quede dicho que
-- el negocio la lee y que escribir sigue siendo solo del servidor.
grant select (producto_id) on lealtad_transacciones to authenticated;
