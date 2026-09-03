-- ════════════════════════════════════════════════════════════════════
--  0230 · BOOKEA SOLUTIONS — ESQUEMA PROPIO, DE CERO
-- ════════════════════════════════════════════════════════════════════
--
-- bookea.lat/solutions: linktree con marca, menú digital y pedidos
-- desde la mesa. Pedido del dueño (3 sep 2026), con una regla que
-- manda sobre todo lo demás: «vas a hacerlo de cero — nada va a
-- depender de ranchos.detalles ni ranchos-fotos».
--
-- Por eso NINGUNA tabla de acá referencia `ranchos`, `rancho_items`,
-- `lealtad_paginas` ni el bucket `ranchos-fotos`. Solutions es un
-- producto aparte —como FOOD tuvo `food_*` y WORK su base— que comparte
-- con Bookea solo la CUENTA (auth.users). Acoplarlo a `ranchos` habría
-- arrastrado la RLS de aprobación del marketplace, el select("*") de
-- la app móvil sobre rancho_items y la taxonomía de eventos: nada de
-- eso tiene por qué condicionar la carta de un restaurante.
--
-- ── EL MODELO ───────────────────────────────────────────────────────
--   solutions_negocios       el negocio: dueño, slug, marca, portada
--   solutions_colaboradores  quién más entra al panel (desde el día 1)
--   solutions_links          el linktree: hasta 12 puertas ordenadas
--   solutions_menu_secciones las secciones de la carta, ordenadas
--   solutions_menu_items     los platos, con foto, precio y disponibilidad
--   solutions_pedidos        la comanda de una mesa, con su estado
--   solutions_pedido_items   sus renglones, con precio CONGELADO
--
-- ── QUIÉN LEE, QUIÉN ESCRIBE ────────────────────────────────────────
-- Público: SOLO lo publicado (negocio.publicado = true), y de los
-- platos solo los disponibles. Dueño y colaboradores: leen todo lo
-- suyo por RLS (así un cliente en tiempo real puede suscribirse a las
-- comandas sin pasar por el servidor). La ESCRITURA va por server
-- action con la llave de servicio, detrás de verificarAccesoSolutions
-- — una sola puerta. Las comandas del público también: nunca un INSERT
-- abierto a anon, que sería aceptar pedidos inventados contra
-- cualquier negocio.

-- ────────────────────────────────────────────────────────────────────
-- 1. EL NEGOCIO
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.solutions_negocios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,

  nombre text not null check (char_length(nombre) between 1 and 80),
  -- La URL pública: bookea.lat/s/<slug>. Único en ESTA tabla; no
  -- comparte espacio con los slugs de ranchos.
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  bajada text not null default '' check (char_length(bajada) <= 140),

  -- La marca. Colores hex; sin logo pinta la inicial.
  color_fondo text not null default '#0a1226' check (color_fondo ~ '^#[0-9a-fA-F]{6}$'),
  color_acento text not null default '#9db4ff' check (color_acento ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text,
  foto_portada_url text,

  -- Contacto que sale en la página (y en la comanda al negocio).
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{8,15}$'),
  direccion text check (direccion is null or char_length(direccion) <= 160),

  -- El interruptor de la calle.
  publicado boolean not null default true,
  -- Prevista de mesas para la hoja de QR (/s/<slug>/menu?mesa=N).
  mesas smallint not null default 0 check (mesas between 0 and 99),
  -- Se puede publicar la página sin carta (un salón que solo quiere links).
  mostrar_menu boolean not null default true,
  -- Los pedidos desde la mesa se prenden aparte del menú.
  acepta_pedidos boolean not null default false,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.solutions_negocios is
  'Negocio de Bookea Solutions (/s/<slug>): dueño, marca, portada, mesas. Independiente de ranchos a propósito (dueño, 3 sep 2026).';

create index if not exists solutions_negocios_owner_idx on public.solutions_negocios (owner_id);

-- ────────────────────────────────────────────────────────────────────
-- 2. COLABORADORES — desde el día uno (dueño, 3 sep 2026)
-- ────────────────────────────────────────────────────────────────────
-- Un mesero ve las comandas sin la cuenta del dueño. Se invita por
-- correo: la fila guarda el usuario si ya existe, o queda pendiente
-- con el correo hasta que esa persona entre con él.
create table if not exists public.solutions_colaboradores (
  negocio_id uuid not null references public.solutions_negocios (id) on delete cascade,
  usuario_id uuid references auth.users (id) on delete cascade,
  correo text not null check (correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  rol text not null default 'equipo' check (rol in ('admin', 'equipo')),
  creado_en timestamptz not null default now(),
  primary key (negocio_id, correo)
);
create index if not exists solutions_colaboradores_usuario_idx
  on public.solutions_colaboradores (usuario_id) where usuario_id is not null;

comment on table public.solutions_colaboradores is
  'Quién entra al panel de un negocio de Solutions además del dueño. admin = edita todo; equipo = atiende comandas.';

-- ────────────────────────────────────────────────────────────────────
-- 3. EL LINKTREE
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.solutions_links (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.solutions_negocios (id) on delete cascade,
  etiqueta text not null check (char_length(etiqueta) between 1 and 40),
  -- Solo esquemas que un negocio usa de verdad. Nada de javascript: ni
  -- data: — la página es pública y estos links los abre cualquiera.
  url text not null check (url ~* '^(https?://|mailto:|tel:)'),
  icono text not null default 'link'
    check (icono in ('link','instagram','facebook','tiktok','whatsapp','telefono','mapa','reservar','web','correo','youtube','tienda','menu')),
  orden smallint not null default 0,
  visible boolean not null default true
);
create index if not exists solutions_links_negocio_idx on public.solutions_links (negocio_id, orden);

-- ────────────────────────────────────────────────────────────────────
-- 4. EL MENÚ
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.solutions_menu_secciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.solutions_negocios (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 40),
  orden smallint not null default 0
);
create index if not exists solutions_menu_secciones_negocio_idx
  on public.solutions_menu_secciones (negocio_id, orden);

create table if not exists public.solutions_menu_items (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.solutions_negocios (id) on delete cascade,
  -- Sin sección = «Otros», al final. Borrar la sección no borra platos.
  seccion_id uuid references public.solutions_menu_secciones (id) on delete set null,
  nombre text not null check (char_length(nombre) between 1 and 80),
  descripcion text not null default '' check (char_length(descripcion) <= 240),
  -- NULL = «consultar». En colones.
  precio numeric(12,2) check (precio is null or precio >= 0),
  foto_url text,
  -- `disponible` es el interruptor permanente; `agotado_hoy` el del
  -- turno — se apaga solo cada día en la lectura (ver datos.ts).
  disponible boolean not null default true,
  agotado_hoy boolean not null default false,
  orden smallint not null default 0
);
create index if not exists solutions_menu_items_negocio_idx
  on public.solutions_menu_items (negocio_id, seccion_id, orden);

-- ────────────────────────────────────────────────────────────────────
-- 5. LAS COMANDAS
-- ────────────────────────────────────────────────────────────────────
-- Una comanda = una mesa que pidió. Sin cuenta ni verificación del
-- cliente: el negocio la ve al lado del número de mesa y con eso
-- alcanza. Los renglones copian nombre y precio: el menú cambia y la
-- comanda de ayer tiene que decir lo que costó ayer. Sin «pagado»: el
-- cobro sigue en caja — esto es un comandero, no una pasarela.
create table if not exists public.solutions_pedidos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.solutions_negocios (id) on delete cascade,
  mesa smallint not null check (mesa between 1 and 99),
  nombre text not null default '' check (char_length(nombre) <= 60),
  nota text not null default '' check (char_length(nota) <= 280),
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'preparando', 'listo', 'entregado', 'cancelado')),
  total numeric(12,2) not null default 0 check (total >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists solutions_pedidos_negocio_idx
  on public.solutions_pedidos (negocio_id, estado, creado_en desc);

create table if not exists public.solutions_pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.solutions_pedidos (id) on delete cascade,
  item_id uuid references public.solutions_menu_items (id) on delete set null,
  nombre text not null check (char_length(nombre) between 1 and 80),
  precio numeric(12,2) not null check (precio >= 0),
  cantidad smallint not null default 1 check (cantidad between 1 and 20)
);
create index if not exists solutions_pedido_items_pedido_idx
  on public.solutions_pedido_items (pedido_id);

-- ────────────────────────────────────────────────────────────────────
-- 6. EL BUCKET PROPIO
-- ────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('solutions-fotos', 'solutions-fotos', true)
on conflict (id) do nothing;

drop policy if exists "Cualquiera ve las fotos de solutions" on storage.objects;
create policy "Cualquiera ve las fotos de solutions"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'solutions-fotos');

drop policy if exists "Cuentas con sesión suben fotos de solutions" on storage.objects;
create policy "Cuentas con sesión suben fotos de solutions"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'solutions-fotos');

drop policy if exists "Cuentas con sesión reemplazan fotos de solutions" on storage.objects;
create policy "Cuentas con sesión reemplazan fotos de solutions"
  on storage.objects for update to authenticated
  using (bucket_id = 'solutions-fotos');

drop policy if exists "Cuentas con sesión borran fotos de solutions" on storage.objects;
create policy "Cuentas con sesión borran fotos de solutions"
  on storage.objects for delete to authenticated
  using (bucket_id = 'solutions-fotos');

-- ────────────────────────────────────────────────────────────────────
-- 7. RLS
-- ────────────────────────────────────────────────────────────────────
alter table public.solutions_negocios       enable row level security;
alter table public.solutions_colaboradores  enable row level security;
alter table public.solutions_links          enable row level security;
alter table public.solutions_menu_secciones enable row level security;
alter table public.solutions_menu_items     enable row level security;
alter table public.solutions_pedidos        enable row level security;
alter table public.solutions_pedido_items   enable row level security;

-- ¿Esta cuenta pertenece al equipo de este negocio? Dueño o colaborador
-- ya vinculado. Una sola función para no repetir el EXISTS en siete
-- políticas y que el criterio viva en un solo lugar.
create or replace function public.solutions_es_del_equipo(p_negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.solutions_negocios n
    where n.id = p_negocio and n.owner_id = auth.uid()
  ) or exists (
    select 1 from public.solutions_colaboradores c
    where c.negocio_id = p_negocio and c.usuario_id = auth.uid()
  );
$$;

-- negocios: la calle ve los publicados; el equipo ve los suyos.
drop policy if exists "Público ve negocios publicados" on public.solutions_negocios;
create policy "Público ve negocios publicados" on public.solutions_negocios
  for select to anon, authenticated using (publicado);
drop policy if exists "El equipo ve su negocio" on public.solutions_negocios;
create policy "El equipo ve su negocio" on public.solutions_negocios
  for select to authenticated using (public.solutions_es_del_equipo(id));

-- colaboradores: solo el equipo (y cada quien su propia invitación).
drop policy if exists "El equipo ve a sus colaboradores" on public.solutions_colaboradores;
create policy "El equipo ve a sus colaboradores" on public.solutions_colaboradores
  for select to authenticated
  using (public.solutions_es_del_equipo(negocio_id) or usuario_id = auth.uid());

-- links y menú: público si el negocio está publicado; el equipo siempre.
drop policy if exists "Público ve links publicados" on public.solutions_links;
create policy "Público ve links publicados" on public.solutions_links
  for select to anon, authenticated
  using (visible and exists (select 1 from public.solutions_negocios n where n.id = negocio_id and n.publicado));
drop policy if exists "El equipo ve sus links" on public.solutions_links;
create policy "El equipo ve sus links" on public.solutions_links
  for select to authenticated using (public.solutions_es_del_equipo(negocio_id));

drop policy if exists "Público ve secciones publicadas" on public.solutions_menu_secciones;
create policy "Público ve secciones publicadas" on public.solutions_menu_secciones
  for select to anon, authenticated
  using (exists (select 1 from public.solutions_negocios n where n.id = negocio_id and n.publicado));
drop policy if exists "El equipo ve sus secciones" on public.solutions_menu_secciones;
create policy "El equipo ve sus secciones" on public.solutions_menu_secciones
  for select to authenticated using (public.solutions_es_del_equipo(negocio_id));

drop policy if exists "Público ve platos disponibles" on public.solutions_menu_items;
create policy "Público ve platos disponibles" on public.solutions_menu_items
  for select to anon, authenticated
  using (disponible and exists (select 1 from public.solutions_negocios n where n.id = negocio_id and n.publicado));
drop policy if exists "El equipo ve sus platos" on public.solutions_menu_items;
create policy "El equipo ve sus platos" on public.solutions_menu_items
  for select to authenticated using (public.solutions_es_del_equipo(negocio_id));

-- comandas: SOLO el equipo. El público no lee comandas ajenas nunca.
drop policy if exists "El equipo ve sus comandas" on public.solutions_pedidos;
create policy "El equipo ve sus comandas" on public.solutions_pedidos
  for select to authenticated using (public.solutions_es_del_equipo(negocio_id));
drop policy if exists "El equipo ve los renglones" on public.solutions_pedido_items;
create policy "El equipo ve los renglones" on public.solutions_pedido_items
  for select to authenticated
  using (exists (select 1 from public.solutions_pedidos p where p.id = pedido_id and public.solutions_es_del_equipo(p.negocio_id)));

-- Sin políticas de INSERT/UPDATE/DELETE para anon ni authenticated:
-- toda escritura entra por server action con service_role.
grant select on
  public.solutions_negocios, public.solutions_colaboradores, public.solutions_links,
  public.solutions_menu_secciones, public.solutions_menu_items,
  public.solutions_pedidos, public.solutions_pedido_items
  to anon, authenticated;
grant all on
  public.solutions_negocios, public.solutions_colaboradores, public.solutions_links,
  public.solutions_menu_secciones, public.solutions_menu_items,
  public.solutions_pedidos, public.solutions_pedido_items
  to service_role;
grant execute on function public.solutions_es_del_equipo(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
