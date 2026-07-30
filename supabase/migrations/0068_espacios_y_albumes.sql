-- ============================================================
-- BOOKEA — Espacios del anfitrión y álbumes digitales (0068)
--
-- Amplía el producto de Invitaciones digitales (0066) en tres frentes:
--
--  1) PREGUNTAS CONFIGURABLES EN EL RSVP
--     - `invitaciones.preguntas`: lista jsonb de hasta 3 preguntas que
--       el equipo define desde el admin. Cada una es
--         {"id":"p1","etiqueta":"¿Sos vegetariano/a?","tipo":"opciones",
--          "opciones":["No","Vegetariano/a","Vegano/a"]}
--       o {"id":"p2","etiqueta":"Alergias","tipo":"texto"}.
--     - `invitacion_rsvp.respuestas`: jsonb {id de pregunta → respuesta}
--       que el invitado deja al confirmar. Con esto el anfitrión puede
--       pasarle números exactos al catering ("5 vegetarianos").
--     El código tolera que estas columnas no existan todavía: sin
--     correr esta migración todo sigue funcionando sin preguntas.
--
--  2) ESPACIO DEL ANFITRIÓN (/cuenta/evento/{id})
--     No necesita tablas nuevas: usa las políticas de 0066 (el dueño ya
--     puede leer su invitación y sus confirmaciones).
--
--  3) ÁLBUMES DIGITALES CON QR (/a/{slug})
--     - `albumes`: el álbum del evento. Lo crea el equipo desde el
--       admin (solo service role escribe); puede colgar de una
--       invitación o vivir solo. Activo = público; archivado = el link
--       deja de servir.
--     - `album_fotos`: cada foto subida. Los INVITADOS suben fotos sin
--       cuenta (anon) mientras el álbum esté activo, con un tope simple
--       en base (500 fotos por álbum) además de la validación de la
--       página (máx 10 por tanda, solo imágenes, redimensionadas a
--       1920px antes de subir).
--     - Bucket de storage `albumes`, público de lectura: las fotos se
--       sirven por URL pública y la fila en `album_fotos` es el índice.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Preguntas del RSVP
-- ------------------------------------------------------------

alter table invitaciones add column if not exists preguntas jsonb;
alter table invitacion_rsvp add column if not exists respuestas jsonb;

-- ------------------------------------------------------------
-- 3) Álbumes digitales
-- ------------------------------------------------------------

create table if not exists albumes (
  id uuid primary key default gen_random_uuid(),
  -- Si se borra la invitación, el álbum sobrevive suelto (las fotos
  -- del evento no se pierden por limpiar invitaciones).
  invitacion_id uuid references invitaciones(id) on delete set null,
  cliente_id uuid references auth.users(id) on delete set null,
  slug text unique not null,
  titulo text not null,
  subtitulo text,
  estado text not null default 'activo'
    check (estado in ('activo', 'archivado')),
  created_at timestamptz not null default now()
);

create index if not exists albumes_invitacion_idx
  on albumes (invitacion_id);
create index if not exists albumes_cliente_idx
  on albumes (cliente_id, created_at desc);

create table if not exists album_fotos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albumes(id) on delete cascade,
  -- Ruta dentro del bucket `albumes` (ej. "{albumId}/1722-1.jpg").
  path text not null check (char_length(path) between 1 and 300),
  -- Nombre opcional de quien subió la foto ("De parte de Tía Rosa").
  autor text check (autor is null or char_length(autor) <= 80),
  created_at timestamptz not null default now()
);

create index if not exists album_fotos_album_idx
  on album_fotos (album_id, created_at desc);

alter table albumes enable row level security;
alter table album_fotos enable row level security;

-- El álbum activo es público: cualquiera con el link (o el QR) lo ve.
drop policy if exists "Cualquiera ve los álbumes activos" on albumes;
create policy "Cualquiera ve los álbumes activos" on albumes
  for select to anon, authenticated
  using (estado = 'activo');

-- El cliente dueño (o un admin) lo ve aunque esté archivado.
drop policy if exists "El dueño ve sus álbumes" on albumes;
create policy "El dueño ve sus álbumes" on albumes
  for select to authenticated
  using (cliente_id = auth.uid() or is_admin());

-- Crear / archivar álbumes es solo del equipo: no hay políticas de
-- escritura para usuarios — el admin escribe con el service role.

-- Las fotos son públicas (la página del álbum las lista para todos).
drop policy if exists "Cualquiera ve las fotos" on album_fotos;
create policy "Cualquiera ve las fotos" on album_fotos
  for select to anon, authenticated
  using (true);

-- Los invitados suben fotos sin cuenta, solo a álbumes activos y con
-- un tope simple en base: 500 fotos por álbum (la página además limita
-- a 10 por tanda y comprime a 1920px).
drop policy if exists "Cualquiera sube fotos a un álbum activo" on album_fotos;
create policy "Cualquiera sube fotos a un álbum activo" on album_fotos
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from albumes a
      where a.id = album_id and a.estado = 'activo'
    )
    and (select count(*) from album_fotos f where f.album_id = album_fotos.album_id) < 500
  );

grant select on albumes to anon, authenticated;
grant select, insert on album_fotos to anon, authenticated;

-- ------------------------------------------------------------
-- Storage: bucket `albumes`, público de lectura.
--
-- Si esta parte falla por permisos sobre el esquema `storage` (según
-- el plan/rol con que se corra el SQL), crear el bucket a mano en el
-- dashboard: Storage → New bucket → nombre "albumes", Public bucket ✓,
-- y agregar las dos políticas de abajo desde Storage → Policies.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('albumes', 'albumes', true)
on conflict (id) do nothing;

-- Lectura pública (el bucket ya es público, esto habilita además el
-- listado/descarga vía API con la llave anónima).
drop policy if exists "Cualquiera ve las fotos de albumes" on storage.objects;
create policy "Cualquiera ve las fotos de albumes"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'albumes');

-- Los invitados suben sus fotos sin cuenta.
drop policy if exists "Cualquiera sube fotos a albumes" on storage.objects;
create policy "Cualquiera sube fotos a albumes"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'albumes');

notify pgrst, 'reload schema';
