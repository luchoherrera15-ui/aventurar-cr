-- ============================================================
-- 0243 · CELEBRAR — el documento de la invitación y su lectura pública
-- ============================================================
--
-- La invitación es un DOCUMENTO JSON (estilo + secciones) que el editor
-- modifica en vivo y la página pública renderiza con el mismo
-- componente (src/components/celebrar/invitacion/render-invitacion.tsx).
-- El esquema del JSON y su saneado viven en el código
-- (src/lib/celebrar/invitacion/esquema.ts): la base lo guarda tal cual
-- y el código NUNCA lo usa sin normalizarlo antes.
--
-- Una celebración puede tener varios documentos (`tipo`): la invitación,
-- el save the date y, después de la fiesta, la página de recuerdos. Hoy
-- se usa `invitacion`; los otros dos quedan listos para las fases que
-- vienen.
--
-- Idempotente y aditiva, como la 0242. Se aplica sola con
-- `node scripts/aplicar-migracion.mjs 0243`.
-- ============================================================

create table if not exists public.celebrar_invitaciones (
  id uuid primary key default gen_random_uuid(),
  celebracion_id uuid not null references public.celebrar_celebraciones(id) on delete cascade,
  tipo text not null default 'invitacion' check (tipo in ('invitacion', 'save_the_date', 'recuerdos')),
  contenido jsonb not null default '{}'::jsonb,
  -- Una plantilla puede cambiar de versión; se anota cuál se usó al
  -- crear para poder ofrecer «actualizar» sin pisar lo editado.
  plantilla_slug text,
  version integer not null default 1 check (version >= 1),
  publicada_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint celebrar_invitaciones_una_por_tipo unique (celebracion_id, tipo),
  -- El documento no puede ser un blob arbitrario de megas.
  constraint celebrar_invitaciones_tamano check (pg_column_size(contenido) <= 262144)
);

create index if not exists celebrar_invitaciones_celebracion_idx
  on public.celebrar_invitaciones (celebracion_id);

drop trigger if exists celebrar_invitaciones_updated_at on public.celebrar_invitaciones;
create trigger celebrar_invitaciones_updated_at
  before update on public.celebrar_invitaciones
  for each row execute function public.celebrar_tocar_updated_at();

alter table public.celebrar_invitaciones enable row level security;

drop policy if exists "Cada quien ve las invitaciones de sus celebraciones" on public.celebrar_invitaciones;
create policy "Cada quien ve las invitaciones de sus celebraciones" on public.celebrar_invitaciones
  for select to authenticated
  using (public.celebrar_es_duena(celebracion_id) or public.is_admin());

drop policy if exists "Cada quien crea las invitaciones de sus celebraciones" on public.celebrar_invitaciones;
create policy "Cada quien crea las invitaciones de sus celebraciones" on public.celebrar_invitaciones
  for insert to authenticated
  with check (public.celebrar_es_duena(celebracion_id));

drop policy if exists "Cada quien edita las invitaciones de sus celebraciones" on public.celebrar_invitaciones;
create policy "Cada quien edita las invitaciones de sus celebraciones" on public.celebrar_invitaciones
  for update to authenticated
  using (public.celebrar_es_duena(celebracion_id))
  with check (public.celebrar_es_duena(celebracion_id));

grant select, insert, update on public.celebrar_invitaciones to authenticated;
grant all on public.celebrar_invitaciones to service_role;
revoke truncate, trigger, references on public.celebrar_invitaciones from anon, authenticated;

-- ------------------------------------------------------------
-- Lo que ve un invitado: la celebración publicada + su invitación
-- ------------------------------------------------------------
-- Devuelve UNA fila o ninguna. Sigue los slugs históricos (para que un
-- link ya compartido siga funcionando después de renombrar) y avisa con
-- `slug_actual = false` para que la página redirija al nuevo. Nunca
-- devuelve owner_id ni nada de la cuenta.
create or replace function public.celebrar_invitacion_publica(p_slug text)
returns table (
  id uuid,
  slug text,
  slug_actual boolean,
  tipo text,
  nombre text,
  fecha date,
  hora time,
  lugar_nombre text,
  direccion text,
  maps_url text,
  estado text,
  publicada_en timestamptz,
  contenido jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with objetivo as (
    select c.*, true as slug_actual
      from public.celebrar_celebraciones c
     where c.slug = p_slug and c.deleted_at is null
    union all
    select c.*, false as slug_actual
      from public.celebrar_slugs s
      join public.celebrar_celebraciones c on c.id = s.celebracion_id
     where s.slug = p_slug and s.motivo = 'historico' and c.deleted_at is null
    limit 1
  )
  select o.id, o.slug, o.slug_actual, o.tipo, o.nombre, o.fecha, o.hora,
         o.lugar_nombre, o.direccion, o.maps_url, o.estado, o.publicada_en,
         coalesce(i.contenido, '{}'::jsonb) as contenido,
         greatest(o.updated_at, i.updated_at) as updated_at
    from objetivo o
    left join public.celebrar_invitaciones i
      on i.celebracion_id = o.id and i.tipo = 'invitacion'
   where o.estado in ('publicada', 'finalizada', 'recuerdos');
$$;

grant execute on function public.celebrar_invitacion_publica(text) to anon, authenticated, service_role;

-- El editor vive en /celebrar/editor/<id>: «editor» es ruta del sistema.
insert into public.celebrar_slugs (slug, motivo) values ('editor', 'sistema')
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
