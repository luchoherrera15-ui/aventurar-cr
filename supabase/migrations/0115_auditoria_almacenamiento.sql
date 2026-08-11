-- ============================================================
-- BOOKEA — Auditoría de almacenamiento, consumo y plata (0115)
--
-- La 0080 ya contesta "quién pesa" para Supabase Storage: por bucket,
-- por usuario, por invitación y los archivos más grandes. Le faltan tres
-- cosas para poder decidir la migración a Cloudflare:
--
--   1. ÁLBUMES. Es la segmentación que no existe, y es justo el mayor
--      volumen medido: 118,5 MB en UN álbum, contra 716 KB de promedio
--      por foto. Hoy esos gigas se ven en el total del bucket y no se
--      pueden atribuir a nadie.
--
--   2. `media_assets`. Lo que ya está en R2 y Cloudflare no aparece en
--      ninguna pantalla. Sin esto no se puede comparar antes y después.
--
--   3. VISITAS EN BLOQUE. La analítica de Cloudflare dice cuántas
--      imágenes entregó EN TOTAL, pero no de qué álbum fue cada una: su
--      dataset es de la cuenta, no de nuestras entidades. Para poder
--      repartir ese total hace falta un peso por entidad, y lo único
--      real que tenemos son las visitas de `visitas_pagina` (0107).
--
--      ⚠️ Y solo cubre RANCHOS. Álbumes e invitaciones no tienen
--      contador de vistas. Por eso estas funciones devuelven las
--      visitas cuando existen y NULL cuando no, en vez de inventar un
--      cero: quien reparta arriba tiene que poder distinguir "no lo
--      vio nadie" de "no lo estamos midiendo", que no es lo mismo y
--      cambia si el número que sale es un dato o una estimación.
--
-- Todo `security definer` con `exigir_admin_almacenamiento()` (0080):
-- `storage.objects` no se expone —ahí viven los comprobantes— y solo se
-- devuelven AGREGADOS.
--
-- Aditiva. Segura de volver a aplicar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cuánto pesa cada ÁLBUM en Supabase Storage
--
-- La ruta del bucket `albumes` es `{albumId}/{ts}-{n}.jpg` (ver
-- src/app/a/[slug]/subir-fotos.tsx), así que el primer segmento es el
-- álbum. Se filtra por formato de uuid antes de castear: un objeto
-- suelto en la raíz del bucket reventaría el `::uuid`.
-- ------------------------------------------------------------

create or replace function public.almacenamiento_por_album()
returns table (
  album_id  uuid,
  titulo    text,
  slug      text,
  estado    text,
  cliente   text,
  creado    timestamptz,
  archivos  bigint,
  bytes     bigint,
  -- Cuántas de esas fotos ya están registradas en `media_assets`. Es lo
  -- que dice si el álbum está migrado, a medias o sin tocar.
  migradas  bigint
)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  perform exigir_admin_almacenamiento();
  return query
  with objetos as (
    select split_part(o.name, '/', 1)::uuid as alb,
           coalesce((o.metadata->>'size')::bigint, 0) as peso
      from storage.objects o
     where o.bucket_id = 'albumes'
       and split_part(o.name, '/', 1) ~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  migrado as (
    select m.entity_id, count(*)::bigint as n
      from public.media_assets m
     where m.entity_type = 'album' and m.deleted_at is null
     group by m.entity_id
  )
  select a.id,
         a.titulo::text,
         a.slug::text,
         a.estado::text,
         coalesce(p.email, p.nombre, '—')::text,
         a.created_at,
         count(*)::bigint,
         coalesce(sum(ob.peso), 0)::bigint,
         coalesce(max(mg.n), 0)::bigint
    from objetos ob
    join albumes a on a.id = ob.alb
    left join perfiles p on p.id = a.cliente_id
    left join migrado mg on mg.entity_id = a.id
   group by a.id, a.titulo, a.slug, a.estado, p.email, p.nombre, a.created_at
   order by 8 desc;
end;
$$;

revoke all on function public.almacenamiento_por_album() from public, anon;
grant execute on function public.almacenamiento_por_album() to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Qué hay ya en R2 y en Cloudflare Images
--
-- Se cuenta lo que está VIVO y CONFIRMADO, no lo reservado: una fila en
-- `pendiente` no ocupa un byte en ningún lado todavía. `imagenes_cf` es
-- la unidad que factura Cloudflare Images —imágenes guardadas, no
-- gigas—, así que se cuenta aparte de `bytes`.
-- ------------------------------------------------------------

create or replace function public.media_uso_por_entidad()
returns table (
  entity_type  text,
  archivos     bigint,
  bytes        bigint,
  imagenes_cf  bigint,
  en_r2        bigint,
  incompletos  bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_admin_almacenamiento();
  return query
    select m.entity_type::text,
           count(*)::bigint,
           coalesce(sum(m.bytes) filter (where m.r2_verificado_en is not null), 0)::bigint,
           count(*) filter (where m.cf_verificado_en is not null)::bigint,
           count(*) filter (where m.r2_verificado_en is not null)::bigint,
           -- Lo que quedó a mitad de camino: ocupa lugar y no se ve.
           count(*) filter (where m.estado in ('parcial_r2','parcial_cf','error'))::bigint
      from public.media_assets m
     where m.deleted_at is null
     group by m.entity_type
     order by 3 desc;
end;
$$;

revoke all on function public.media_uso_por_entidad() from public, anon;
grant execute on function public.media_uso_por_entidad() to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Lo mismo, fila por fila, para las entidades que importan
--
-- Devuelve las visitas cuando la entidad las tiene medidas y NULL
-- cuando no. Ver la advertencia del encabezado: NULL no es cero.
-- ------------------------------------------------------------

create or replace function public.media_uso_detalle(p_limite int default 100)
returns table (
  entity_type text,
  entity_id   uuid,
  nombre      text,
  archivos    bigint,
  bytes       bigint,
  imagenes_cf bigint,
  visitas_30d bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_admin_almacenamiento();

  if p_limite is null or p_limite < 1 or p_limite > 500 then
    raise exception 'media_uso_detalle: límite fuera de rango.' using errcode = '22023';
  end if;

  return query
  with agregado as (
    select m.entity_type::text as et,
           m.entity_id as eid,
           count(*)::bigint as n,
           coalesce(sum(m.bytes) filter (where m.r2_verificado_en is not null), 0)::bigint as b,
           count(*) filter (where m.cf_verificado_en is not null)::bigint as cf
      from public.media_assets m
     where m.deleted_at is null
     group by m.entity_type, m.entity_id
  ),
  visitas as (
    select v.rancho_id, count(*)::bigint as n
      from public.visitas_pagina v
     where v.dia >= current_date - 30
     group by v.rancho_id
  )
  select ag.et,
         ag.eid,
         coalesce(
           case ag.et
             when 'album'       then (select a.titulo from albumes a where a.id = ag.eid)
             when 'invitacion'  then (select i.titulo from invitaciones i where i.id = ag.eid)
             when 'rancho'      then (select r.nombre from ranchos r where r.id = ag.eid)
             when 'rancho_item' then (select ri.nombre from rancho_items ri where ri.id = ag.eid)
             when 'equipo'      then (select e.nombre from equipo_rancho e where e.id = ag.eid)
             else null
           end,
           '—'
         )::text,
         ag.n,
         ag.b,
         ag.cf,
         -- Solo los ranchos tienen contador. En el resto va NULL, que
         -- arriba se traduce en "reparto proporcional, no medición".
         case when ag.et = 'rancho' then coalesce(vi.n, 0) else null end
    from agregado ag
    left join visitas vi on ag.et = 'rancho' and vi.rancho_id = ag.eid
   order by ag.b desc, ag.n desc
   limit p_limite;
end;
$$;

revoke all on function public.media_uso_detalle(int) from public, anon;
grant execute on function public.media_uso_detalle(int) to authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Visitas en bloque, para repartir el total de Cloudflare
--
-- `visitas_pagina_resumen` (0107) es de a un rancho por llamada. Para
-- pesar doscientos negocios harían falta doscientas llamadas.
-- ------------------------------------------------------------

create or replace function public.almacenamiento_visitas_por_rancho(p_dias int default 30)
returns table (rancho_id uuid, nombre text, visitas bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_admin_almacenamiento();

  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'almacenamiento_visitas_por_rancho: días fuera de rango.'
      using errcode = '22023';
  end if;

  return query
    select v.rancho_id, coalesce(r.nombre, '—')::text, count(*)::bigint
      from public.visitas_pagina v
      left join ranchos r on r.id = v.rancho_id
     where v.dia >= current_date - p_dias
     group by v.rancho_id, r.nombre
     order by 3 desc;
end;
$$;

revoke all on function public.almacenamiento_visitas_por_rancho(int) from public, anon;
grant execute on function public.almacenamiento_visitas_por_rancho(int)
  to authenticated, service_role;

comment on function public.almacenamiento_por_album() is
  'Cuánto pesa cada álbum en el bucket `albumes`, y cuántas de sus fotos ya '
  'están en media_assets. Era la segmentación que le faltaba a la 0080 y es '
  'la del mayor volumen medido.';

comment on function public.media_uso_detalle(int) is
  'Uso por entidad en R2/Cloudflare. `visitas_30d` va NULL en todo lo que no '
  'sea rancho: solo los ranchos tienen contador de visitas, y un cero ahí '
  'haría pasar por medición lo que es una estimación.';

notify pgrst, 'reload schema';
