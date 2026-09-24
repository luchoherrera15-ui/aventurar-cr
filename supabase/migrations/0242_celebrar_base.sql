-- ============================================================
-- 0242 · CELEBRAR — identidad, celebraciones, slugs y catálogo de plantillas
-- ============================================================
--
-- CELEBRAR (bookea.lat/celebrar → celebrar.lat) es un producto aparte
-- sobre la misma infraestructura de Bookea. Decisión del dueño (D-1,
-- 20 sep 2026): esquema PROPIO con prefijo `celebrar_`, sin tocar las
-- tablas del producto viejo de invitaciones (`invitaciones`,
-- `invitacion_rsvp`, `albumes`…), que siguen intactas.
--
-- Esta es la primera migración del producto (Fase 2 del plan en
-- docs/celebrar/audit.md):
--
--   celebrar_perfiles              lo propio de la persona (la identidad
--                                  sigue siendo auth.users + perfiles)
--   celebrar_plantilla_categorias  las once categorías del catálogo
--   celebrar_plantillas            + secciones + variantes
--   celebrar_celebraciones         el objeto central del producto
--   celebrar_slugs                 rutas del sistema y slugs históricos
--
-- Seguridad: RLS en todas. La persona ve y edita SOLO lo suyo
-- (owner_id = auth.uid()); el público NO lee la tabla de celebraciones
-- directamente — lee por `celebrar_publica_por_slug` (security definer)
-- que devuelve solo lo publicable. Es la lección de 0221→0224: un
-- `select` anónimo sobre una tabla con fechas y direcciones es una
-- enumeración esperando a pasar.
--
-- Idempotente a propósito (`if not exists`, `drop policy if exists`,
-- `create or replace`): se puede aplicar sola por
-- `node scripts/aplicar-migracion.mjs 0242` sin arrastrar la 0239 ni la
-- 0240, y un `db push` posterior no la rompe.
-- ============================================================

-- ------------------------------------------------------------
-- 0. updated_at compartido por las tablas de CELEBRAR
-- ------------------------------------------------------------
create or replace function public.celebrar_tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. El perfil de CELEBRAR (lo que Bookea no sabe de la persona)
-- ------------------------------------------------------------
create table if not exists public.celebrar_perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_publico text check (nombre_publico is null or char_length(nombre_publico) between 1 and 120),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9+][0-9 +-]{6,19}$'),
  pais text not null default 'CR' check (pais ~ '^[A-Z]{2}$'),
  moneda text not null default 'CRC' check (moneda ~ '^[A-Z]{3}$'),
  acepta_marketing boolean not null default false,
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists celebrar_perfiles_updated_at on public.celebrar_perfiles;
create trigger celebrar_perfiles_updated_at
  before update on public.celebrar_perfiles
  for each row execute function public.celebrar_tocar_updated_at();

alter table public.celebrar_perfiles enable row level security;

drop policy if exists "Cada quien ve su perfil de CELEBRAR" on public.celebrar_perfiles;
create policy "Cada quien ve su perfil de CELEBRAR" on public.celebrar_perfiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Cada quien crea su perfil de CELEBRAR" on public.celebrar_perfiles;
create policy "Cada quien crea su perfil de CELEBRAR" on public.celebrar_perfiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "Cada quien edita su perfil de CELEBRAR" on public.celebrar_perfiles;
create policy "Cada quien edita su perfil de CELEBRAR" on public.celebrar_perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- 2. El catálogo de plantillas
-- ------------------------------------------------------------
create table if not exists public.celebrar_plantilla_categorias (
  id text primary key check (id ~ '^[a-z][a-z_]{1,39}$'),
  nombre text not null check (char_length(nombre) between 1 and 60),
  descripcion text check (descripcion is null or char_length(descripcion) <= 300),
  orden integer not null default 0,
  activa boolean not null default true
);

create table if not exists public.celebrar_plantillas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  nombre text not null check (char_length(nombre) between 1 and 80),
  categoria_id text not null references public.celebrar_plantilla_categorias(id),
  nivel text not null default 'gratis'
    check (nivel in ('gratis', 'premium', 'exclusiva', 'personalizada')),
  costo_creditos integer not null default 0 check (costo_creditos >= 0),
  -- Para qué celebraciones se recomienda; vacío = todas.
  tipos_evento text[] not null default '{}'::text[],
  descripcion text check (descripcion is null or char_length(descripcion) <= 400),
  preview_url text check (preview_url is null or preview_url ~ '^https?://'),
  -- El esquema de secciones y los tokens de estilo (colores, letra…).
  -- El editor (Fase 3) lee estos dos jsonb; una plantilla legado del
  -- producto viejo puede traer su HTML en `html_legado` y se muestra
  -- sin editor, marcada `exclusiva`.
  esquema jsonb not null default '{}'::jsonb,
  estilos jsonb not null default '{}'::jsonb,
  html_legado text,
  version integer not null default 1 check (version >= 1),
  activa boolean not null default true,
  orden integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists celebrar_plantillas_categoria_idx
  on public.celebrar_plantillas (categoria_id, orden) where activa;

drop trigger if exists celebrar_plantillas_updated_at on public.celebrar_plantillas;
create trigger celebrar_plantillas_updated_at
  before update on public.celebrar_plantillas
  for each row execute function public.celebrar_tocar_updated_at();

create table if not exists public.celebrar_plantilla_secciones (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.celebrar_plantillas(id) on delete cascade,
  tipo text not null check (tipo in (
    'hero', 'historia', 'countdown', 'detalles', 'ubicacion', 'galeria',
    'dress_code', 'rsvp', 'regalos', 'faq', 'mensaje', 'video', 'musica',
    'firmas', 'album', 'custom'
  )),
  orden integer not null default 0,
  obligatoria boolean not null default false,
  contenido_default jsonb not null default '{}'::jsonb,
  opciones jsonb not null default '{}'::jsonb
);

create index if not exists celebrar_plantilla_secciones_plantilla_idx
  on public.celebrar_plantilla_secciones (plantilla_id, orden);

create table if not exists public.celebrar_plantilla_variantes (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.celebrar_plantillas(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  tema jsonb not null default '{}'::jsonb,
  preview_url text check (preview_url is null or preview_url ~ '^https?://'),
  orden integer not null default 0,
  activa boolean not null default true
);

create index if not exists celebrar_plantilla_variantes_plantilla_idx
  on public.celebrar_plantilla_variantes (plantilla_id, orden) where activa;

alter table public.celebrar_plantilla_categorias enable row level security;
alter table public.celebrar_plantillas enable row level security;
alter table public.celebrar_plantilla_secciones enable row level security;
alter table public.celebrar_plantilla_variantes enable row level security;

-- El catálogo es público (lo activo). Solo el admin lo escribe, y lo
-- hace desde server actions con service_role: sin políticas de escritura.
drop policy if exists "Cualquiera ve las categorías activas" on public.celebrar_plantilla_categorias;
create policy "Cualquiera ve las categorías activas" on public.celebrar_plantilla_categorias
  for select to anon, authenticated
  using (activa or public.is_admin());

drop policy if exists "Cualquiera ve las plantillas activas" on public.celebrar_plantillas;
create policy "Cualquiera ve las plantillas activas" on public.celebrar_plantillas
  for select to anon, authenticated
  using (activa or public.is_admin());

drop policy if exists "Cualquiera ve las secciones de plantillas activas" on public.celebrar_plantilla_secciones;
create policy "Cualquiera ve las secciones de plantillas activas" on public.celebrar_plantilla_secciones
  for select to anon, authenticated
  using (exists (
    select 1 from public.celebrar_plantillas p
    where p.id = plantilla_id and (p.activa or public.is_admin())
  ));

drop policy if exists "Cualquiera ve las variantes activas" on public.celebrar_plantilla_variantes;
create policy "Cualquiera ve las variantes activas" on public.celebrar_plantilla_variantes
  for select to anon, authenticated
  using (activa and exists (
    select 1 from public.celebrar_plantillas p where p.id = plantilla_id and p.activa
  ));

-- ------------------------------------------------------------
-- 3. Los slugs del sistema y los históricos
-- ------------------------------------------------------------
-- `celebrar.lat/app` es el panel; `celebrar.lat/maria-y-juan` una
-- invitación. Si una celebración pudiera llamarse "app", una de las dos
-- moriría. Esta tabla es la defensa en la base (la del código es
-- SEGMENTOS_SISTEMA en src/lib/celebrar/rutas.ts — misma lista).
--
--   sistema    ruta del producto; nunca se libera
--   reservado  apartado por el equipo (marcas, palabras feas…)
--   historico  slug viejo de una celebración que se renombró; sirve para
--              redirigir y para que nadie lo reclame enseguida
create table if not exists public.celebrar_slugs (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9.-]{0,79}$'),
  celebracion_id uuid,
  motivo text not null check (motivo in ('sistema', 'reservado', 'historico')),
  created_at timestamptz not null default now()
);

alter table public.celebrar_slugs enable row level security;
-- Sin políticas: solo las funciones (security definer) la leen y escriben.

insert into public.celebrar_slugs (slug, motivo) values
  ('app', 'sistema'), ('admin', 'sistema'), ('api', 'sistema'), ('auth', 'sistema'),
  ('entrar', 'sistema'), ('salir', 'sistema'), ('registro', 'sistema'),
  ('plantillas', 'sistema'), ('precios', 'sistema'), ('como-funciona', 'sistema'),
  ('q', 'sistema'), ('e', 'sistema'), ('i', 'sistema'), ('a', 'sistema'), ('s', 'sistema'),
  ('celebrar', 'sistema'), ('cuenta', 'sistema'), ('ayuda', 'sistema'),
  ('terminos', 'sistema'), ('privacidad', 'sistema'),
  ('sitemap.xml', 'sistema'), ('robots.txt', 'sistema'),
  ('opengraph-image', 'sistema'), ('favicon.ico', 'sistema'),
  ('bookea', 'reservado'), ('linksy', 'reservado'), ('celebrar-lat', 'reservado')
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 4. La celebración
-- ------------------------------------------------------------
create table if not exists public.celebrar_celebraciones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in (
    'boda', 'cumpleanos', 'xv', 'baby_shower', 'bautizo', 'graduacion',
    'aniversario', 'despedida', 'fiesta', 'corporativo', 'otro'
  )),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  -- El slug es global: celebrar.lat/<slug>. Minúsculas, dígitos y guiones.
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  fecha date,
  hora time,
  zona_horaria text not null default 'America/Costa_Rica',
  lugar_nombre text check (lugar_nombre is null or char_length(lugar_nombre) <= 160),
  direccion text check (direccion is null or char_length(direccion) <= 300),
  maps_url text check (maps_url is null or maps_url ~ '^https?://'),
  lat double precision check (lat is null or (lat between -90 and 90)),
  lng double precision check (lng is null or (lng between -180 and 180)),
  portada_asset_id uuid references public.media_assets(id) on delete set null,
  descripcion text check (descripcion is null or char_length(descripcion) <= 2000),
  plantilla_id uuid references public.celebrar_plantillas(id) on delete set null,
  plantilla_version integer,
  tema jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'publicada', 'finalizada', 'recuerdos', 'archivada')),
  publicada_en timestamptz,
  expira_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists celebrar_celebraciones_owner_idx
  on public.celebrar_celebraciones (owner_id, created_at desc) where deleted_at is null;
create index if not exists celebrar_celebraciones_estado_idx
  on public.celebrar_celebraciones (estado) where deleted_at is null;

drop trigger if exists celebrar_celebraciones_updated_at on public.celebrar_celebraciones;
create trigger celebrar_celebraciones_updated_at
  before update on public.celebrar_celebraciones
  for each row execute function public.celebrar_tocar_updated_at();

-- El slug no puede ser una ruta del sistema ni uno reservado. Cuando
-- una celebración cambia de slug, el viejo queda como histórico
-- apuntando a ella (para redirigir y para que no lo tome otra).
create or replace function public.celebrar_vigilar_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text;
  v_de_quien uuid;
begin
  select motivo, celebracion_id into v_motivo, v_de_quien
    from public.celebrar_slugs where slug = new.slug;
  if v_motivo in ('sistema', 'reservado') then
    raise exception 'Esa dirección está reservada. Probá con otra.'
      using errcode = 'check_violation';
  end if;
  if v_motivo = 'historico' and v_de_quien is distinct from new.id then
    raise exception 'Esa dirección la usó otra celebración hace poco. Probá con otra.'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.slug <> new.slug then
    insert into public.celebrar_slugs (slug, celebracion_id, motivo)
      values (old.slug, old.id, 'historico')
      on conflict (slug) do update set celebracion_id = excluded.celebracion_id, motivo = 'historico';
    -- Si vuelve a un slug propio histórico, ya no es histórico.
    delete from public.celebrar_slugs where slug = new.slug and celebracion_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists celebrar_celebraciones_slug on public.celebrar_celebraciones;
create trigger celebrar_celebraciones_slug
  before insert or update of slug on public.celebrar_celebraciones
  for each row execute function public.celebrar_vigilar_slug();

alter table public.celebrar_celebraciones enable row level security;

drop policy if exists "Cada quien ve sus celebraciones" on public.celebrar_celebraciones;
create policy "Cada quien ve sus celebraciones" on public.celebrar_celebraciones
  for select to authenticated
  using ((owner_id = auth.uid() and deleted_at is null) or public.is_admin());

drop policy if exists "Cada quien crea sus celebraciones" on public.celebrar_celebraciones;
create policy "Cada quien crea sus celebraciones" on public.celebrar_celebraciones
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Cada quien edita sus celebraciones" on public.celebrar_celebraciones;
create policy "Cada quien edita sus celebraciones" on public.celebrar_celebraciones
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Sin DELETE: se archiva o se marca deleted_at desde la propia fila.

-- ¿Es mía esta celebración? Para las tablas hijas de las fases que vienen.
create or replace function public.celebrar_es_duena(p_celebracion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.celebrar_celebraciones c
    where c.id = p_celebracion and c.owner_id = auth.uid() and c.deleted_at is null
  );
$$;

-- ------------------------------------------------------------
-- 5. Funciones para el producto
-- ------------------------------------------------------------

-- ¿Está libre esta dirección? Lo consulta el asistente mientras la
-- persona escribe. No revela de quién es un slug ocupado: solo sí/no.
create or replace function public.celebrar_slug_disponible(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'
     and not exists (select 1 from public.celebrar_slugs s where s.slug = p_slug)
     and not exists (select 1 from public.celebrar_celebraciones c where c.slug = p_slug);
$$;

-- Crea la celebración de la persona con sesión (y su perfil de CELEBRAR
-- si todavía no existe). Devuelve id y slug. Los mensajes de error son
-- los que ve la persona.
create or replace function public.celebrar_crear_celebracion(
  p_tipo text,
  p_nombre text,
  p_slug text,
  p_fecha date default null,
  p_hora time default null,
  p_lugar_nombre text default null,
  p_direccion text default null,
  p_maps_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fila public.celebrar_celebraciones%rowtype;
begin
  if v_uid is null then
    raise exception 'Entrá con tu cuenta para crear una celebración.';
  end if;
  if coalesce(btrim(p_nombre), '') = '' or char_length(btrim(p_nombre)) < 2 then
    raise exception 'Contanos cómo se llama la celebración.';
  end if;
  if not public.celebrar_slug_disponible(p_slug) then
    raise exception 'Esa dirección no está disponible. Probá con otra.';
  end if;

  insert into public.celebrar_perfiles (id) values (v_uid)
  on conflict (id) do nothing;

  insert into public.celebrar_celebraciones (
    owner_id, tipo, nombre, slug, fecha, hora, lugar_nombre, direccion, maps_url
  ) values (
    v_uid, p_tipo, btrim(p_nombre), p_slug, p_fecha, p_hora,
    nullif(left(btrim(p_lugar_nombre), 160), ''),
    nullif(left(btrim(p_direccion), 300), ''),
    nullif(btrim(p_maps_url), '')
  )
  returning * into v_fila;

  return jsonb_build_object('id', v_fila.id, 'slug', v_fila.slug);
end;
$$;

-- Lo público de una celebración publicada, por slug (Fase 3 la usa para
-- la invitación). Devuelve SOLO lo que puede ver un invitado: nunca el
-- owner_id ni nada de la cuenta. Sigue los slugs históricos.
create or replace function public.celebrar_publica_por_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  tipo text,
  nombre text,
  fecha date,
  hora time,
  zona_horaria text,
  lugar_nombre text,
  direccion text,
  maps_url text,
  lat double precision,
  lng double precision,
  portada_asset_id uuid,
  descripcion text,
  plantilla_id uuid,
  tema jsonb,
  config jsonb,
  estado text,
  slug_actual boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with objetivo as (
    select c.* , true as slug_actual
      from public.celebrar_celebraciones c
     where c.slug = p_slug and c.deleted_at is null
    union all
    select c.*, false as slug_actual
      from public.celebrar_slugs s
      join public.celebrar_celebraciones c on c.id = s.celebracion_id
     where s.slug = p_slug and s.motivo = 'historico' and c.deleted_at is null
    limit 1
  )
  select o.id, o.slug, o.tipo, o.nombre, o.fecha, o.hora, o.zona_horaria,
         o.lugar_nombre, o.direccion, o.maps_url, o.lat, o.lng,
         o.portada_asset_id, o.descripcion, o.plantilla_id, o.tema, o.config,
         o.estado, o.slug_actual
    from objetivo o
   where o.estado in ('publicada', 'finalizada', 'recuerdos');
$$;

-- ------------------------------------------------------------
-- 6. Permisos
-- ------------------------------------------------------------
grant select, insert, update on public.celebrar_perfiles to authenticated;
grant select on
  public.celebrar_plantilla_categorias, public.celebrar_plantillas,
  public.celebrar_plantilla_secciones, public.celebrar_plantilla_variantes
  to anon, authenticated;
grant select, insert, update on public.celebrar_celebraciones to authenticated;
grant all on
  public.celebrar_perfiles, public.celebrar_plantilla_categorias, public.celebrar_plantillas,
  public.celebrar_plantilla_secciones, public.celebrar_plantilla_variantes,
  public.celebrar_celebraciones, public.celebrar_slugs
  to service_role;

-- Higiene: los privilegios por defecto del proyecto dejan TRUNCATE,
-- TRIGGER y REFERENCES a anon/authenticated en toda tabla nueva (se ve en
-- `role_table_grants` de cualquier tabla del sitio). PostgREST no los
-- expone, pero en las tablas de CELEBRAR se quitan igual: RLS no frena un
-- TRUNCATE.
revoke truncate, trigger, references on
  public.celebrar_perfiles, public.celebrar_plantilla_categorias, public.celebrar_plantillas,
  public.celebrar_plantilla_secciones, public.celebrar_plantilla_variantes,
  public.celebrar_celebraciones, public.celebrar_slugs
  from anon, authenticated;

grant execute on function public.celebrar_es_duena(uuid) to authenticated, service_role;
grant execute on function public.celebrar_slug_disponible(text) to anon, authenticated, service_role;
grant execute on function public.celebrar_crear_celebracion(text, text, text, date, time, text, text, text) to authenticated, service_role;
grant execute on function public.celebrar_publica_por_slug(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Semillas del catálogo
-- ------------------------------------------------------------
insert into public.celebrar_plantilla_categorias (id, nombre, descripcion, orden) values
  ('elegante',    'Elegante',    'Mucho aire y un solo acento. La opción segura para una boda formal.', 1),
  ('minimalista', 'Minimalista', 'Solo lo necesario: los nombres, la fecha, el lugar.', 2),
  ('luxury',      'Luxury',      'Fondos oscuros, dorado fino y tipografía grande.', 3),
  ('romantica',   'Romántica',   'Tonos blush y una historia contada en primera persona.', 4),
  ('floral',      'Floral',      'Ilustraciones botánicas que enmarcan el texto.', 5),
  ('moderna',     'Moderna',     'Geometría, contraste alto y colores planos.', 6),
  ('editorial',   'Editorial',   'Como una revista: columnas, titulares grandes y fotos a sangre.', 7),
  ('tropical',    'Tropical',    'Verdes, hojas y luz. Para una celebración al aire libre.', 8),
  ('infantil',    'Infantil',    'Colores vivos, personajes propios y animaciones que se tocan.', 9),
  ('fiesta',      'Fiesta',      'Confeti, neón y música desde el primer scroll.', 10),
  ('corporativa', 'Corporativa', 'Sobria y clara, con espacio para la marca y la agenda.', 11)
on conflict (id) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  orden = excluded.orden;

-- Tres plantillas de arranque. Quedaron INACTIVAS (activa = false) desde
-- la Fase 3: el catálogo real (440, 40 por tipo) lo produce
-- src/lib/celebrar/plantillas/generador.ts y lo siembra
-- scripts/celebrar-sembrar-plantillas.mts. Se conservan como registro.
insert into public.celebrar_plantillas (slug, nombre, categoria_id, nivel, costo_creditos, tipos_evento, descripcion, esquema, estilos, orden, activa)
values
  ('clasica-marina', 'Clásica marina', 'elegante', 'gratis', 0, '{}',
   'Fondo marino, tipografía grande y un acento cálido. Funciona para cualquier ocasión.',
   '{"secciones": ["hero","detalles","countdown","ubicacion","dress_code","rsvp","regalos"]}',
   '{"fondo":"#0b1e45","tinta":"#ffffff","acento":"#f26b5b","letra":"Montserrat"}', 1, false),
  ('blanca-minimal', 'Blanca minimal', 'minimalista', 'gratis', 0, '{}',
   'Blanco, texto oscuro y mucho aire. Se lee en un segundo.',
   '{"secciones": ["hero","detalles","ubicacion","rsvp"]}',
   '{"fondo":"#ffffff","tinta":"#0f1b33","acento":"#1f4fd8","letra":"Montserrat"}', 2, false),
  ('coral-fiesta', 'Coral fiesta', 'fiesta', 'gratis', 0, '{cumpleanos,xv,despedida,fiesta}',
   'Coral suave con energía. Para cumpleaños, quince años y despedidas.',
   '{"secciones": ["hero","countdown","detalles","ubicacion","galeria","rsvp","regalos"]}',
   '{"fondo":"#fdece9","tinta":"#b33a2b","acento":"#0b1e45","letra":"Montserrat"}', 3, false)
on conflict (slug) do update set
  nombre = excluded.nombre,
  categoria_id = excluded.categoria_id,
  descripcion = excluded.descripcion,
  esquema = excluded.esquema,
  estilos = excluded.estilos,
  orden = excluded.orden,
  activa = excluded.activa;

notify pgrst, 'reload schema';
