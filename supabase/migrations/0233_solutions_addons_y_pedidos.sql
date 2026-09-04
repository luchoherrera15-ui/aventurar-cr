-- ════════════════════════════════════════════════════════════════════
--  0233 · SOLUTIONS — ADD-ONS POR NEGOCIO Y PEDIDOS PARA LLEVAR / EXPRÉS
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (4 sep 2026): «tiene que ser UNA cuenta principal;
-- a base de eso el negocio tiene ADD-ONS que se venden por separado:
-- el menú digital, el link hub… Lo primero, lo gratuito, es el link
-- hub; de ahí la persona dice qué quiere añadir por dinero. Ahorita
-- todo es prueba, pero dejalo previsto».
--
-- Y: «que la persona arme un pedido para llevar o exprés, llene sus
-- datos (nombre, cédula, dirección, teléfono, cómo paga) y se mande
-- organizadamente por WhatsApp al restaurante».
--
-- ── LA CUENTA YA ERA UNA ────────────────────────────────────────────
-- No hay una tabla de cuentas nueva: la cuenta principal es
-- `auth.users`, la misma con la que la persona entra a todo Bookea.
-- Lo que faltaba era el escalón de abajo: qué TIENE cada negocio de
-- esa cuenta. Eso es esta tabla.
--
-- ── EL PATRÓN ES EL DE addons_negocio (0077), Y POR LAS MISMAS RAZONES
-- El dueño LEE sus add-ons (lo necesita para pintar el panel) pero NO
-- puede escribirlos: sin política de insert/update/delete para
-- `authenticated`, la RLS niega por defecto y solo la llave de
-- servicio activa o desactiva. Si el dueño pudiera escribir, se
-- regalaría el add-on desde el navegador. Hoy activar es gratis (todo
-- es prueba), pero la puerta ya está donde tiene que estar: el día
-- que se cobre, lo único que cambia es qué pasa ANTES de escribir la
-- fila, no quién puede escribirla.
--
-- Tabla propia y no `addons_negocio` porque esa cuelga de `ranchos`, y
-- Solutions no depende de ranchos (dueño, 3 sep 2026).

-- ────────────────────────────────────────────────────────────────────
-- 1. LOS ADD-ONS DE CADA NEGOCIO
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.solutions_addons (
  negocio_id uuid not null references public.solutions_negocios (id) on delete cascade,
  -- El catálogo vive en src/lib/solutions/addons.ts; este CHECK lo
  -- espeja. linkhub = la página (gratis, siempre); menu = el menú
  -- digital; pedidos = mesa, para llevar y exprés; lealtad = la
  -- tarjeta, que se arma en Bookea Lealtad con la misma cuenta.
  addon text not null check (addon in ('linkhub', 'menu', 'pedidos', 'lealtad')),
  activo boolean not null default false,
  -- null = sin vencimiento (incluido, cortesía o prueba).
  vence_en timestamptz,
  -- Para cortesías y pruebas: por qué se activó.
  notas text,
  activado_en timestamptz,
  creado_en timestamptz not null default now(),
  primary key (negocio_id, addon)
);

comment on table public.solutions_addons is
  'Qué complementos tiene prendidos cada negocio de Solutions. El dueño solo lee; escribe el servidor con la llave de servicio (mismo criterio que addons_negocio, 0077).';

alter table public.solutions_addons enable row level security;

drop policy if exists "El equipo ve sus add-ons" on public.solutions_addons;
create policy "El equipo ve sus add-ons" on public.solutions_addons
  for select to authenticated
  using (public.solutions_es_del_equipo(negocio_id));

grant select on public.solutions_addons to authenticated;
grant all on public.solutions_addons to service_role;

-- ¿Este negocio tiene el add-on prendido y vigente? security definer
-- para poder usarla desde políticas y desde el servidor sin depender
-- de la RLS de la tabla.
create or replace function public.solutions_tiene_addon(p_negocio uuid, p_addon text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.solutions_addons a
    where a.negocio_id = p_negocio
      and a.addon = p_addon
      and a.activo
      and (a.vence_en is null or a.vence_en > now())
  );
$$;

-- ── EL BACKFILL: NADIE PIERDE LO QUE YA TENÍA EN LA CALLE ───────────
-- Todo negocio existente recibe linkhub (es lo incluido). Los que ya
-- cargaron platos reciben `menu`; los que ya reciben pedidos, `pedidos`.
-- Sin esto, la migración apagaría menús que hoy están publicados.
insert into public.solutions_addons (negocio_id, addon, activo, activado_en, notas)
select n.id, 'linkhub', true, now(), 'incluido (0233)'
from public.solutions_negocios n
on conflict (negocio_id, addon) do nothing;

insert into public.solutions_addons (negocio_id, addon, activo, activado_en, notas)
select distinct i.negocio_id, 'menu', true, now(), 'backfill 0233: ya tenía platos'
from public.solutions_menu_items i
on conflict (negocio_id, addon) do nothing;

insert into public.solutions_addons (negocio_id, addon, activo, activado_en, notas)
select n.id, 'pedidos', true, now(), 'backfill 0233: ya recibía pedidos'
from public.solutions_negocios n
where n.acepta_pedidos
on conflict (negocio_id, addon) do nothing;

-- ────────────────────────────────────────────────────────────────────
-- 2. CÓMO RECIBE PEDIDOS EL NEGOCIO, ADEMÁS DE LA MESA
-- ────────────────────────────────────────────────────────────────────
-- `acepta_pedidos` (0230) sigue siendo «desde la mesa». Estas dos son
-- las otras dos modalidades; las tres son independientes porque un
-- local puede tener mesas sin exprés o exprés sin mesas.
alter table public.solutions_negocios
  add column if not exists pedidos_llevar boolean not null default false;
alter table public.solutions_negocios
  add column if not exists pedidos_express boolean not null default false;
-- Lo que se suma al pedido cuando es exprés. 0 = envío gratis.
alter table public.solutions_negocios
  add column if not exists costo_express numeric(12,2) not null default 0 check (costo_express >= 0);
-- Con qué se puede pagar. Lista cerrada; la UI del cliente ofrece
-- SOLO estas. Default efectivo, que es lo que todo local acepta.
alter table public.solutions_negocios
  add column if not exists metodos_pago text[] not null default '{efectivo}'
  check (metodos_pago <@ array['efectivo', 'tarjeta', 'transferencia']::text[] and cardinality(metodos_pago) >= 1);
-- A qué número llega el pedido por WhatsApp. null = el `whatsapp` de la
-- página. Aparte porque muchos locales atienden pedidos en otra línea.
alter table public.solutions_negocios
  add column if not exists whatsapp_pedidos text
  check (whatsapp_pedidos is null or whatsapp_pedidos ~ '^[0-9]{8,15}$');

comment on column public.solutions_negocios.pedidos_llevar is 'Recibe pedidos para llevar (recoger en el local) por WhatsApp.';
comment on column public.solutions_negocios.pedidos_express is 'Recibe pedidos exprés (envío a domicilio) por WhatsApp.';
comment on column public.solutions_negocios.costo_express is 'Cargo por envío que se suma al pedido exprés. 0 = gratis.';
comment on column public.solutions_negocios.metodos_pago is 'Formas de pago que el cliente puede elegir al pedir: efectivo, tarjeta, transferencia.';
comment on column public.solutions_negocios.whatsapp_pedidos is 'Número al que llegan los pedidos por WhatsApp. null = el whatsapp de la página.';

-- ────────────────────────────────────────────────────────────────────
-- 3. EL PEDIDO YA NO ES SOLO DE UNA MESA
-- ────────────────────────────────────────────────────────────────────
-- `mesa` pasa a ser nullable: un pedido para llevar no tiene mesa. El
-- CHECK de rango se conserva para cuando sí la hay.
alter table public.solutions_pedidos alter column mesa drop not null;

alter table public.solutions_pedidos
  add column if not exists modalidad text not null default 'mesa'
  check (modalidad in ('mesa', 'llevar', 'express'));

-- Los datos del cliente, que en la mesa no hacen falta y para llevar
-- o exprés son lo que permite entregarle. Todos opcionales en la
-- tabla; la obligatoriedad por modalidad la impone la action, que es
-- quien sabe qué modalidad es.
alter table public.solutions_pedidos
  add column if not exists telefono text check (telefono is null or telefono ~ '^[0-9]{8,15}$');
alter table public.solutions_pedidos
  add column if not exists cedula text check (cedula is null or char_length(cedula) <= 20);
alter table public.solutions_pedidos
  add column if not exists direccion text check (direccion is null or char_length(direccion) <= 200);
alter table public.solutions_pedidos
  add column if not exists metodo_pago text check (metodo_pago is null or metodo_pago in ('efectivo', 'tarjeta', 'transferencia'));
-- Lo que se cobró de envío en ESTE pedido, congelado: si el negocio
-- cambia el costo mañana, el pedido de hoy no cambia.
alter table public.solutions_pedidos
  add column if not exists costo_envio numeric(12,2) not null default 0 check (costo_envio >= 0);

-- Un pedido de mesa tiene mesa; uno para llevar o exprés, no.
alter table public.solutions_pedidos drop constraint if exists solutions_pedidos_modalidad_mesa_chk;
alter table public.solutions_pedidos add constraint solutions_pedidos_modalidad_mesa_chk
  check ((modalidad = 'mesa' and mesa is not null) or (modalidad <> 'mesa' and mesa is null));

comment on column public.solutions_pedidos.modalidad is 'mesa (QR de la mesa, llega al panel), llevar (recoge en el local) o express (envío). Las dos últimas se mandan además por WhatsApp.';

notify pgrst, 'reload schema';
