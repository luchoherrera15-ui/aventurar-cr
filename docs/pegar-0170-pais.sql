
-- 0170 — El país deja de ser un supuesto.
-- Pegar TODO esto de una vez en el SQL Editor de Supabase.
-- Se puede pegar dos veces sin romper nada. Explicación completa en
-- supabase/migrations/0170_pais_de_primera_clase.sql

alter table ranchos add column if not exists pais text;
alter table ranchos alter column pais set default 'cr';

update ranchos set pais = 'cr' where pais is null or btrim(pais) = '';
update ranchos set pais = lower(btrim(pais)) where pais is distinct from lower(btrim(pais));
update ranchos set provincia = null where provincia is not null and btrim(provincia) = '';
update ranchos set provincia = btrim(provincia) where provincia is distinct from btrim(provincia);

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ranchos'
       and column_name = 'pais' and is_nullable = 'YES'
  ) then
    execute 'alter table public.ranchos alter column pais set not null';
  end if;
end $$;

create or replace function public.ranchos_normalizar_pais()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.pais := lower(btrim(coalesce(new.pais, 'cr')));
  if new.pais = '' then
    new.pais := 'cr';
  end if;

  if new.provincia is not null then
    new.provincia := btrim(new.provincia);
    if new.provincia = '' then
      new.provincia := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ranchos_normalizar_pais_trg on ranchos;
create trigger ranchos_normalizar_pais_trg
  before insert or update of pais, provincia on ranchos
  for each row
  execute function public.ranchos_normalizar_pais();

do $$
declare
  c record;
begin
  if to_regclass('public.ranchos') is null then
    raise notice 'ranchos no existe todavía.';
    return;
  end if;

  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.ranchos'::regclass
       and contype  = 'c'
       and (
         pg_get_constraintdef(oid) ~ '\mprovincia\M'
         or pg_get_constraintdef(oid) ~ '\mpais\M'
       )
  loop
    execute format('alter table public.ranchos drop constraint if exists %I', c.conname);
  end loop;
end $$;

do $$
begin
  alter table public.ranchos
    drop constraint if exists ranchos_provincia_no_vacia;

  alter table public.ranchos
    add constraint ranchos_provincia_no_vacia
    check (
      provincia is null
      or (btrim(provincia) <> '' and char_length(provincia) <= 80)
    )
    not valid;
end $$;

alter table public.ranchos validate constraint ranchos_provincia_no_vacia;

do $$
begin
  alter table public.ranchos
    drop constraint if exists ranchos_pais_iso2;

  alter table public.ranchos
    add constraint ranchos_pais_iso2
    check (pais ~ '^[a-z]{2}$')
    not valid;
end $$;

alter table public.ranchos validate constraint ranchos_pais_iso2;

create index if not exists ranchos_pais_publicados_idx
  on ranchos (pais, vertical, created_at desc)
  where estado = 'aprobado';

grant select (pais) on ranchos to anon, authenticated;

comment on function public.ranchos_normalizar_pais() is
  'Normaliza ranchos.pais a ISO-3166 alpha-2 en minúscula y limpia provincia. '
  'Existe para que el código viejo que manda ''CR'' siga funcionando sin deploy coordinado.';

comment on column ranchos.pais is
  'País del negocio en ISO-3166 alpha-2 MINÚSCULA (cr, pa, mx). Siempre minúscula: '
  'coincide con el segmento de URL del ruteo por país (/cr, /pa) y lo garantiza el '
  'trigger ranchos_normalizar_pais_trg, no solo el CHECK. Default ''cr'': Costa Rica '
  'es el caso por defecto. La lista de países habilitados NO está en la base — vive '
  'en src/lib/zonas.ts (PAISES), para poder abrir un país sin pegar SQL en producción.';

comment on column ranchos.provincia is
  'División administrativa de primer nivel del negocio, en el idioma del país: '
  'provincia en CR y PA, estado en MX, departamento en CO. Texto libre a propósito — '
  'hasta la 0170 estaba amarrada por CHECK a las 7 provincias de Costa Rica, lo que '
  'hacía imposible guardar un negocio extranjero. Se validan la forma y el largo, no '
  'el contenido: el catálogo de regiones lo ofrece el formulario, no la base. Puede '
  'ser NULL (servicios sin sede física). Interpretarla SIEMPRE junto con `pais`: '
  '''San José'' existe en Costa Rica y en Argentina.';

comment on column ranchos.zona_horaria is
  'Zona horaria IANA del negocio (0062). Es la que tienen que leer los motores de '
  'disponibilidad, recordatorios y calendarios — nunca asumir America/Costa_Rica. '
  'Se deriva de `pais` al dar de alta con zonaDePais() de src/lib/zonas.ts.';

notify pgrst, 'reload schema';
