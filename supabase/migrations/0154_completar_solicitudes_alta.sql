-- ============================================================
-- COMPLETAR LA 0130 EN solicitudes_lealtad — se quedó a medias,
-- IGUAL QUE LA 0138 (ver la 0153).
--
-- QUÉ PASÓ: el dueño reportó un error real al intentar pedir un pase
-- desde /lealtad/nuevo:
--
--   Could not find the "meta_sellos" column of solicitudes_lealtad
--
-- La 0130 agrega 8 columnas + 1 constraint dentro de un solo bloque
-- `do $$ ... $$`, guardado por:
--
--   if not exists (... column_name = 'negocio_nombre') then
--     ...ocho ALTER TABLE seguidos...
--   end if;
--
-- El guard solo pregunta por `negocio_nombre` — la PRIMERA columna que
-- agrega el bloque. En algún momento el archivo se pegó cuando el
-- bloque todavía terminaba en `negocio_vertical` (una versión más
-- corta), y el bloque de hoy —con seis columnas más, hasta
-- `personalizado`— nunca se volvió a pegar: como `negocio_nombre` YA
-- existe, el `if not exists` corta en seco antes de llegar a nada más.
-- Comprobado en vivo: `negocio_nombre` y `negocio_vertical` SÍ existen;
-- `negocio_detalle`, `pase_color`, `pase_logo_url`, `regalia`,
-- `meta_sellos` y `personalizado` NO.
--
-- Distinto síntoma que la 0138 (ahí el bloque entero se revertía por un
-- error a mitad de camino) pero la misma lección: un guard que solo
-- mira la PRIMERA columna de un bloque que después creció es un guard
-- roto. Esta migración agrega cada pieza con su propio `if not exists`,
-- así que no importa dónde se haya cortado antes — y no se puede volver
-- a cortar así, porque cada ALTER se evalúa por separado.
-- ============================================================

do $s154$
begin
  if to_regclass('public.solicitudes_lealtad') is null then
    raise notice '0154: solicitudes_lealtad no existe (falta la 0126). No hay nada que completar.';
    return;
  end if;

  execute 'alter table public.solicitudes_lealtad add column if not exists negocio_detalle text';
  execute $sql$alter table public.solicitudes_lealtad drop constraint if exists solicitudes_lealtad_negocio_detalle_check$sql$;
  execute $sql$alter table public.solicitudes_lealtad add constraint solicitudes_lealtad_negocio_detalle_check check (negocio_detalle is null or char_length(negocio_detalle) <= 80)$sql$;

  execute 'alter table public.solicitudes_lealtad add column if not exists pase_color text';
  execute $sql$alter table public.solicitudes_lealtad drop constraint if exists solicitudes_lealtad_pase_color_check$sql$;
  execute $sql$alter table public.solicitudes_lealtad add constraint solicitudes_lealtad_pase_color_check check (pase_color is null or pase_color ~ '^#[0-9a-fA-F]{6}$')$sql$;

  execute 'alter table public.solicitudes_lealtad add column if not exists pase_logo_url text';
  execute $sql$alter table public.solicitudes_lealtad drop constraint if exists solicitudes_lealtad_pase_logo_url_check$sql$;
  execute $sql$alter table public.solicitudes_lealtad add constraint solicitudes_lealtad_pase_logo_url_check check (pase_logo_url is null or pase_logo_url like 'https://%')$sql$;

  execute 'alter table public.solicitudes_lealtad add column if not exists regalia text';
  execute $sql$alter table public.solicitudes_lealtad drop constraint if exists solicitudes_lealtad_regalia_check$sql$;
  execute $sql$alter table public.solicitudes_lealtad add constraint solicitudes_lealtad_regalia_check check (regalia is null or char_length(regalia) between 1 and 120)$sql$;

  execute 'alter table public.solicitudes_lealtad add column if not exists meta_sellos integer';
  execute $sql$alter table public.solicitudes_lealtad drop constraint if exists solicitudes_lealtad_meta_sellos_check$sql$;
  execute $sql$alter table public.solicitudes_lealtad add constraint solicitudes_lealtad_meta_sellos_check check (meta_sellos is null or (meta_sellos between 1 and 100))$sql$;

  execute 'alter table public.solicitudes_lealtad add column if not exists personalizado boolean not null default false';

  if not exists (
    select 1 from pg_constraint
     where conname = 'solicitudes_alta_coherente'
       and conrelid = 'public.solicitudes_lealtad'::regclass
  ) then
    execute $sql$alter table public.solicitudes_lealtad add constraint solicitudes_alta_coherente check (rancho_id is not null or negocio_nombre is not null)$sql$;
  end if;
end;
$s154$;

comment on column solicitudes_lealtad.negocio_detalle is
  'Si eligieron «otro»: qué negocio es, en sus palabras.';
comment on column solicitudes_lealtad.pase_color is
  'Color de fondo elegido en el onboarding — al aprobar se vuelve el color real de la tarjeta.';
comment on column solicitudes_lealtad.pase_logo_url is
  'El logo subido en el onboarding — al aprobar se vuelve el logo real de la tarjeta.';
comment on column solicitudes_lealtad.regalia is
  'La recompensa prometida («café gratis») — al aprobar se crea como la recompensa activa.';
comment on column solicitudes_lealtad.meta_sellos is
  'Cuántos sellos cuesta la regalía — el costo_puntos de esa recompensa.';
comment on column solicitudes_lealtad.personalizado is
  'true = pidió diseño personalizado: queda en espera y el equipo lo arma a mano (mensaje trae su descripción).';

notify pgrst, 'reload schema';
