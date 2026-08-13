
-- ─────────────────────────────────────────────────────────────────────
-- 0129: los negocios nuevos nacen EN REVISIÓN para lealtad.
--
-- Crear "Otro negocio" desde el dashboard ya no da acceso inmediato:
-- la fila se crea (el dato existe), pero el mundo de lealtad la trata
-- como EN HOLD hasta que un administrador la apruebe desde
-- /admin/complementos. Sin aprobar: sin panel y sin poder solicitar
-- plan.
--
-- Es un eje APARTE de `estado` a propósito: `estado='aprobado'`
-- significa "publicado en el directorio del marketplace", y un negocio
-- de solo-lealtad nunca se publica — mezclar los dos ejes fue
-- exactamente el error que la auditoría del módulo prohibió.
-- ─────────────────────────────────────────────────────────────────────

-- Columnas + backfill en un bloque de una sola pasada (patrón 0127):
-- re-pegar este archivo NO re-aprueba nada ni vuelve a backfillear.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'ranchos'
       and column_name = 'lealtad_aprobado_en'
  ) then
    alter table ranchos add column lealtad_aprobado_en timestamptz;
    alter table ranchos add column lealtad_aprobado_por uuid
      references auth.users(id) on delete set null;

    -- Los negocios que YA existen no pasan por la revisión nueva:
    -- quedan aprobados tal cual estaban operando.
    update ranchos set lealtad_aprobado_en = now();
  end if;
end $$;

comment on column ranchos.lealtad_aprobado_en is
  'null = en revisión para el mundo de lealtad (sin panel ni solicitudes). La aprueba un admin.';
comment on column ranchos.lealtad_aprobado_por is
  'Quién aprobó — un registro sin autor es un rumor.';

-- El dueño puede EDITAR su rancho (0008), así que sin este candado se
-- auto-aprobaría con un UPDATE por la API. Mismo patrón que el trigger
-- que protege owner_id (0116): admin o llave de servicio, nadie más.
create or replace function public.ranchos_proteger_aprobacion_lealtad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- service_role: el servidor decide (acciones de admin)
  end if;
  if exists (select 1 from public.perfiles p
              where p.id = auth.uid() and p.rol = 'admin') then
    return new;
  end if;
  raise exception 'Solo un administrador aprueba un negocio para lealtad.'
    using errcode = '42501';
end;
$$;

drop trigger if exists ranchos_proteger_aprobacion_lealtad on ranchos;
create trigger ranchos_proteger_aprobacion_lealtad
  before update of lealtad_aprobado_en, lealtad_aprobado_por on ranchos
  for each row
  when (
    old.lealtad_aprobado_en is distinct from new.lealtad_aprobado_en
    or old.lealtad_aprobado_por is distinct from new.lealtad_aprobado_por
  )
  execute function public.ranchos_proteger_aprobacion_lealtad();
