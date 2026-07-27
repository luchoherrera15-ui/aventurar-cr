-- ============================================================
-- 0031 — URL propia por rancho (bookearcr.com/nombrecorto)
--
-- Cada rancho/servicio obtiene un "slug": una versión corta de su
-- nombre sin tildes, espacios ni símbolos (ej. "Rancho Las Torres"
-- → "rancholastorres"), usada como URL pública en la raíz del sitio.
-- Es opcional (nullable) porque las filas creadas antes de esta
-- migración no tienen una todavía hasta que se les asigna acá abajo;
-- de ahí en adelante toda publicación nueva la trae desde que se crea
-- (ver src/app/mi-rancho/nuevo/actions.ts).
-- ============================================================

create extension if not exists unaccent;

alter table ranchos add column if not exists slug text;

-- Único, pero solo entre las filas que sí tienen slug: no bloquea las
-- que todavía no pasaron por el backfill de abajo.
create unique index if not exists ranchos_slug_key
  on ranchos (slug)
  where slug is not null;

-- Reduce el nombre a minúsculas sin tildes ni símbolos: mismo criterio
-- que src/lib/slug.ts en el código (ambos deben coincidir para que un
-- slug calculado en el server y uno recalculado acá den lo mismo).
create or replace function public.slugify(p_texto text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(unaccent(coalesce(p_texto, ''))),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

-- Backfill: a cada rancho aprobado sin slug le asigna uno a partir de
-- su nombre, agregando un número al final si ya existe (mismo estilo
-- que usará el código para las colisiones al crear uno nuevo).
do $$
declare
  fila record;
  base text;
  candidato text;
  sufijo int;
begin
  for fila in
    select id, nombre from ranchos where slug is null order by created_at asc
  loop
    base := public.slugify(fila.nombre);
    if base = '' then
      base := 'rancho';
    end if;

    candidato := base;
    sufijo := 1;
    while exists (select 1 from ranchos where slug = candidato) loop
      sufijo := sufijo + 1;
      candidato := base || sufijo::text;
    end loop;

    update ranchos set slug = candidato where id = fila.id;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
