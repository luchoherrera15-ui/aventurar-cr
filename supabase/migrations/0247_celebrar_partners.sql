-- ═══════════════════════════════════════════════════════════════════
--  CELEBRAR — 0247 · el programa de PARTNERS
-- ═══════════════════════════════════════════════════════════════════
--
-- El dueño (21 sep 2026): «gente que ya se encarga de crear eventos
-- (planners, agencias) crea la invitación con nosotros, nos paga a
-- nosotros un monto y le cobra por aparte a su cliente». El modelo es
-- MAYORISTA: el partner compra créditos más baratos (paquetes grandes
-- con descuento) y publica al mismo precio en créditos que todo el mundo.
--
--   1. `celebrar_partners`: una fila por cuenta (el id ES el auth.users).
--      La persona aplica (queda `pendiente`); el equipo aprueba desde el
--      admin y fija el descuento. Las columnas que valen plata (estado,
--      descuento) NO las puede tocar la persona: privilegios por columna.
--   2. La marca del partner en la invitación: «Diseñada por X» al pie,
--      con su link. Es el beneficio que más vale: cada invitación que
--      manda es publicidad suya ante 100 invitados.
--   3. `cliente` en la celebración: para quién es (el partner maneja
--      muchas). jsonb {nombre, contacto, notas}.
--   4. `celebrar_partner_plantillas`: los diseños propios del partner
--      (guardar una invitación como plantilla y reusarla con el próximo
--      cliente): su «estilo de la casa».
--   5. RPC pública `celebrar_partner_de(p_slug)`: la marca a mostrar en la
--      página de una celebración, solo si el partner está aprobado y
--      quiere mostrarla.
--
-- Aditiva e idempotente. Solo tablas celebrar_*; no toca nada de Bookea.

create table if not exists public.celebrar_partners (
  id                     uuid primary key references auth.users(id) on delete cascade,
  nombre_comercial       text not null check (char_length(nombre_comercial) between 2 and 80),
  slug                   text unique check (slug is null or slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'),
  tipo                   text not null default 'planner'
                         check (tipo in ('planner', 'agencia', 'fotografia', 'lugar', 'diseno', 'catering', 'otro')),
  ciudad                 text check (ciudad is null or char_length(ciudad) <= 80),
  sitio                  text check (sitio is null or sitio ~ '^https?://'),
  instagram              text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  whatsapp               text check (whatsapp is null or whatsapp ~ '^[0-9+][0-9 +-]{6,19}$'),
  descripcion            text check (descripcion is null or char_length(descripcion) <= 600),
  logo_url               text check (logo_url is null or logo_url ~ '^https://'),
  eventos_por_anio       integer check (eventos_por_anio is null or eventos_por_anio between 0 and 10000),
  -- Lo que decide el equipo
  estado                 text not null default 'pendiente'
                         check (estado in ('pendiente', 'aprobado', 'suspendido', 'rechazado')),
  descuento_pct          integer not null default 20 check (descuento_pct between 0 and 60),
  notas_admin            text,
  aprobado_en            timestamptz,
  -- Lo que decide el partner
  marca_en_invitaciones  boolean not null default true,
  mostrar_en_directorio  boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

drop trigger if exists celebrar_partners_updated_at on public.celebrar_partners;
create trigger celebrar_partners_updated_at
  before update on public.celebrar_partners
  for each row execute function public.celebrar_tocar_updated_at();

alter table public.celebrar_partners enable row level security;

drop policy if exists "El partner ve su ficha" on public.celebrar_partners;
create policy "El partner ve su ficha" on public.celebrar_partners
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- Aplicar: solo la propia cuenta, y siempre entra pendiente con el
-- descuento base (las columnas del equipo no se pueden fijar al aplicar).
drop policy if exists "Aplicar al programa" on public.celebrar_partners;
create policy "Aplicar al programa" on public.celebrar_partners
  for insert to authenticated
  with check (id = auth.uid() and estado = 'pendiente' and descuento_pct = 20 and aprobado_en is null and notas_admin is null);

drop policy if exists "El partner edita su ficha" on public.celebrar_partners;
create policy "El partner edita su ficha" on public.celebrar_partners
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "El admin administra partners" on public.celebrar_partners;
create policy "El admin administra partners" on public.celebrar_partners
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Privilegios por COLUMNA: la persona solo puede escribir lo suyo. Estado,
-- descuento, notas y fecha de aprobación quedan para el admin (RPC abajo)
-- y el service role.
revoke all on public.celebrar_partners from anon, authenticated;
grant select on public.celebrar_partners to authenticated;
grant insert (id, nombre_comercial, slug, tipo, ciudad, sitio, instagram, whatsapp, descripcion, logo_url, eventos_por_anio, marca_en_invitaciones, mostrar_en_directorio)
  on public.celebrar_partners to authenticated;
grant update (nombre_comercial, slug, tipo, ciudad, sitio, instagram, whatsapp, descripcion, logo_url, eventos_por_anio, marca_en_invitaciones, mostrar_en_directorio)
  on public.celebrar_partners to authenticated;
grant all on public.celebrar_partners to service_role;

/** El equipo aprueba, suspende o rechaza y fija el descuento. */
create or replace function public.celebrar_admin_partner_estado(
  p_id uuid,
  p_estado text,
  p_descuento integer default null,
  p_notas text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo.' using errcode = '42501';
  end if;
  if p_estado not in ('pendiente', 'aprobado', 'suspendido', 'rechazado') then
    raise exception 'Estado inválido.' using errcode = '22023';
  end if;
  update public.celebrar_partners
     set estado = p_estado,
         descuento_pct = coalesce(p_descuento, descuento_pct),
         notas_admin = coalesce(p_notas, notas_admin),
         aprobado_en = case when p_estado = 'aprobado' then coalesce(aprobado_en, now()) else aprobado_en end
   where id = p_id;
  return found;
end;
$$;
revoke all on function public.celebrar_admin_partner_estado(uuid, text, integer, text) from public;
grant execute on function public.celebrar_admin_partner_estado(uuid, text, integer, text) to authenticated, service_role;

/** El listado para el admin, con el correo de la cuenta y su saldo. */
create or replace function public.celebrar_admin_partners()
returns table (
  id uuid, correo text, nombre_comercial text, slug text, tipo text, ciudad text, sitio text, instagram text, whatsapp text,
  descripcion text, logo_url text, eventos_por_anio integer, estado text, descuento_pct integer, notas_admin text,
  aprobado_en timestamptz, marca_en_invitaciones boolean, mostrar_en_directorio boolean, created_at timestamptz,
  saldo integer, celebraciones integer, publicadas integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, u.email::text, p.nombre_comercial, p.slug, p.tipo, p.ciudad, p.sitio, p.instagram, p.whatsapp,
    p.descripcion, p.logo_url, p.eventos_por_anio, p.estado, p.descuento_pct, p.notas_admin,
    p.aprobado_en, p.marca_en_invitaciones, p.mostrar_en_directorio, p.created_at,
    coalesce((select sum(m.cantidad) from public.celebrar_creditos_movimientos m where m.owner_id = p.id), 0)::integer,
    (select count(*) from public.celebrar_celebraciones c where c.owner_id = p.id)::integer,
    (select count(*) from public.celebrar_celebraciones c where c.owner_id = p.id and c.estado = 'publicada')::integer
  from public.celebrar_partners p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by (p.estado = 'pendiente') desc, p.created_at desc;
$$;
revoke all on function public.celebrar_admin_partners() from public;
grant execute on function public.celebrar_admin_partners() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- La celebración sabe para qué cliente es
-- ─────────────────────────────────────────────────────────────────────
alter table public.celebrar_celebraciones
  add column if not exists cliente jsonb;
comment on column public.celebrar_celebraciones.cliente is
  'Para partners: {nombre, contacto, notas} de la persona para quien se hace la invitación.';

-- ─────────────────────────────────────────────────────────────────────
-- Las plantillas propias del partner
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.celebrar_partner_plantillas (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references auth.users(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 80),
  tipo        text,
  documento   jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists celebrar_partner_plantillas_partner_idx
  on public.celebrar_partner_plantillas (partner_id, created_at desc);

drop trigger if exists celebrar_partner_plantillas_updated_at on public.celebrar_partner_plantillas;
create trigger celebrar_partner_plantillas_updated_at
  before update on public.celebrar_partner_plantillas
  for each row execute function public.celebrar_tocar_updated_at();

alter table public.celebrar_partner_plantillas enable row level security;
drop policy if exists "El partner maneja sus plantillas" on public.celebrar_partner_plantillas;
create policy "El partner maneja sus plantillas" on public.celebrar_partner_plantillas
  for all to authenticated using (partner_id = auth.uid()) with check (partner_id = auth.uid());
revoke all on public.celebrar_partner_plantillas from anon, authenticated;
grant select, insert, update, delete on public.celebrar_partner_plantillas to authenticated;
grant all on public.celebrar_partner_plantillas to service_role;

-- ─────────────────────────────────────────────────────────────────────
-- La marca del partner en la página pública
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.celebrar_partner_de(p_slug text)
returns table (nombre_comercial text, slug text, sitio text, instagram text, whatsapp text, logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.nombre_comercial, p.slug, p.sitio, p.instagram, p.whatsapp, p.logo_url
  from public.celebrar_celebraciones c
  join public.celebrar_partners p on p.id = c.owner_id
  where c.slug = lower(trim(p_slug))
    and c.estado = 'publicada'
    and p.estado = 'aprobado'
    and p.marca_en_invitaciones
  limit 1;
$$;
revoke all on function public.celebrar_partner_de(text) from public;
grant execute on function public.celebrar_partner_de(text) to anon, authenticated, service_role;

/** El directorio público: los partners aprobados que quieren aparecer. */
create or replace function public.celebrar_partners_directorio()
returns table (nombre_comercial text, slug text, tipo text, ciudad text, sitio text, instagram text, whatsapp text, descripcion text, logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.nombre_comercial, p.slug, p.tipo, p.ciudad, p.sitio, p.instagram, p.whatsapp, p.descripcion, p.logo_url
  from public.celebrar_partners p
  where p.estado = 'aprobado' and p.mostrar_en_directorio
  order by p.aprobado_en asc nulls last;
$$;
revoke all on function public.celebrar_partners_directorio() from public;
grant execute on function public.celebrar_partners_directorio() to anon, authenticated, service_role;

-- Las rutas nuevas del sistema no pueden ser slugs de celebración.
insert into public.celebrar_slugs (slug, motivo) values ('partners', 'sistema'), ('partner', 'sistema')
on conflict (slug) do nothing;
