-- ============================================================
-- BOOKEA — Panel de almacenamiento: quién pesa
--
-- Storage cobra por gigas guardados y hasta hoy nadie sabía de dónde
-- salían: una invitación con tres videos pesa más que doscientos
-- negocios con su foto de portada.
--
-- `storage.objects` no está expuesta por PostgREST (y mejor así: tiene
-- todos los archivos privados del proyecto). En vez de abrirla, se
-- publican cuatro funciones `security definer` que solo devuelven
-- AGREGADOS y que le exigen rol admin a quien las llama.
--
-- La atribución sale de la ruta del archivo:
--   invitaciones/{invitacion_id}/…   → esa invitación y su cliente
--   invitaciones/subidas/{user_id}/… → ese usuario (subió y nunca generó)
--   cualquier otra                   → el dueño del objeto (storage.owner)
-- ============================================================

-- ------------------------------------------------------------
-- 0. Quién puede mirar
-- ------------------------------------------------------------

create or replace function public.exigir_admin_almacenamiento()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from perfiles where id = auth.uid() and rol = 'admin'
  ) then
    raise exception 'Solo el equipo admin puede ver el almacenamiento';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 1. Cuánto pesa cada bucket
-- ------------------------------------------------------------

create or replace function public.almacenamiento_por_bucket()
returns table (bucket text, archivos bigint, bytes bigint)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  perform exigir_admin_almacenamiento();
  return query
    select o.bucket_id::text,
           count(*)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.objects o
     group by o.bucket_id
     order by 3 desc;
end;
$$;

-- ------------------------------------------------------------
-- 2. Cuánto pesa cada usuario
--
-- Suma lo que cuelga de sus invitaciones MÁS lo que subió y quedó sin
-- usar, y de paso dice cuánto de eso es basura (subidas huérfanas).
-- ------------------------------------------------------------

create or replace function public.almacenamiento_por_usuario()
returns table (
  usuario_id uuid,
  email text,
  nombre text,
  archivos bigint,
  bytes bigint,
  bytes_sin_usar bigint
)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  perform exigir_admin_almacenamiento();
  return query
  with objetos as (
    select o.name,
           coalesce((o.metadata->>'size')::bigint, 0) as peso,
           o.owner,
           -- La invitación dueña del archivo, si la ruta la nombra.
           case
             when o.name like 'invitaciones/%'
              and split_part(o.name, '/', 2) <> 'subidas'
              and split_part(o.name, '/', 2) ~
                  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then split_part(o.name, '/', 2)::uuid
           end as invitacion_id,
           -- El usuario que subió a la carpeta de staging.
           case
             when o.name like 'invitaciones/subidas/%'
              and split_part(o.name, '/', 3) ~
                  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then split_part(o.name, '/', 3)::uuid
           end as subidor
      from storage.objects o
  ),
  atribuidos as (
    select coalesce(ob.subidor, i.cliente_id, ob.owner) as usuario,
           ob.peso,
           (ob.subidor is not null) as sin_usar
      from objetos ob
      left join invitaciones i on i.id = ob.invitacion_id
  )
  select a.usuario,
         p.email::text,
         p.nombre::text,
         count(*)::bigint,
         coalesce(sum(a.peso), 0)::bigint,
         coalesce(sum(a.peso) filter (where a.sin_usar), 0)::bigint
    from atribuidos a
    left join perfiles p on p.id = a.usuario
   where a.usuario is not null
   group by a.usuario, p.email, p.nombre
   order by 5 desc;
end;
$$;

-- ------------------------------------------------------------
-- 3. Cuánto pesa cada invitación
-- ------------------------------------------------------------

create or replace function public.almacenamiento_por_invitacion()
returns table (
  invitacion_id uuid,
  titulo text,
  slug text,
  estado text,
  cliente text,
  creada timestamptz,
  archivos bigint,
  bytes bigint
)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  perform exigir_admin_almacenamiento();
  return query
  with objetos as (
    select split_part(o.name, '/', 2)::uuid as inv,
           coalesce((o.metadata->>'size')::bigint, 0) as peso
      from storage.objects o
     where o.name like 'invitaciones/%'
       and split_part(o.name, '/', 2) <> 'subidas'
       and split_part(o.name, '/', 2) ~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  select i.id,
         i.titulo::text,
         i.slug::text,
         i.estado::text,
         coalesce(p.email, p.nombre, '—')::text,
         i.created_at,
         count(*)::bigint,
         coalesce(sum(ob.peso), 0)::bigint
    from objetos ob
    join invitaciones i on i.id = ob.inv
    left join perfiles p on p.id = i.cliente_id
   group by i.id, i.titulo, i.slug, i.estado, p.email, p.nombre, i.created_at
   order by 8 desc;
end;
$$;

-- ------------------------------------------------------------
-- 4. Los archivos más pesados, uno por uno
-- ------------------------------------------------------------

create or replace function public.almacenamiento_archivos_top(limite int default 40)
returns table (
  bucket text,
  ruta text,
  bytes bigint,
  tipo text,
  creado timestamptz
)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  perform exigir_admin_almacenamiento();
  return query
    select o.bucket_id::text,
           o.name::text,
           coalesce((o.metadata->>'size')::bigint, 0)::bigint,
           coalesce(o.metadata->>'mimetype', '—')::text,
           o.created_at
      from storage.objects o
     order by 3 desc
     limit greatest(1, least(limite, 200));
end;
$$;

-- ------------------------------------------------------------
-- Permisos: nadie sin sesión, y adentro cada función exige admin.
-- ------------------------------------------------------------

revoke all on function public.exigir_admin_almacenamiento() from public, anon;
revoke all on function public.almacenamiento_por_bucket() from public, anon;
revoke all on function public.almacenamiento_por_usuario() from public, anon;
revoke all on function public.almacenamiento_por_invitacion() from public, anon;
revoke all on function public.almacenamiento_archivos_top(int) from public, anon;

grant execute on function public.almacenamiento_por_bucket() to authenticated;
grant execute on function public.almacenamiento_por_usuario() to authenticated;
grant execute on function public.almacenamiento_por_invitacion() to authenticated;
grant execute on function public.almacenamiento_archivos_top(int) to authenticated;
