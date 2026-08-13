-- ============================================================
-- BOOKEA — Catálogo de planes del módulo de Lealtad (0133)
--
-- El catálogo pasa a Prueba / Esencial / Crece / Pro / Empresa, que son
-- planes DEL MÓDULO DE LEALTAD y de nadie más: no reemplazan ni se
-- mezclan con los planes generales de Bookea.
--
-- Esta migración SOLO amplía los CHECK que enumeran los planes válidos.
-- El catálogo de verdad —precios, topes y capacidades— vive en
-- src/lib/lealtad/planes.ts, porque es producto y no dato del cliente.
--
-- ------------------------------------------------------------
-- LOS PLANES VIEJOS NO SE BORRAN
-- ------------------------------------------------------------
-- 'gratis', 'basico', 'estandar' y 'enterprise' SIGUEN en la lista
-- aunque ya no se vendan. Hay negocios con esos valores guardados
-- (Rancho Las Torres tiene «Básico»), y un CHECK que los excluyera
-- dejaría esas filas violando su propia restricción: cualquier UPDATE
-- posterior sobre el rancho —cambiar el nombre, la foto, lo que sea—
-- explotaría con un error que no tiene nada que ver con lo que se
-- quiso guardar.
--
-- Retirar un plan es dejar de OFRECERLO, no invalidar lo cobrado. Eso
-- se decide en planes.ts con `vigente: false`, no acá.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos drop constraint if exists ranchos_plan_lealtad_check;
alter table ranchos add constraint ranchos_plan_lealtad_check
  check (
    plan_lealtad is null
    or plan_lealtad in (
      -- Vigentes (0133)
      'prueba', 'esencial', 'crece', 'pro', 'empresa',
      -- Retirados, conservados por las filas que ya existen
      'gratis', 'basico', 'estandar', 'enterprise'
    )
  );

alter table solicitudes_lealtad drop constraint if exists solicitudes_lealtad_plan_check;
alter table solicitudes_lealtad add constraint solicitudes_lealtad_plan_check
  check (
    plan in (
      'prueba', 'esencial', 'crece', 'pro', 'empresa',
      'gratis', 'basico', 'estandar', 'enterprise'
    )
  );

comment on column ranchos.plan_lealtad is
  'Plan del módulo de Lealtad (0124, 0131, 0133). El catálogo con '
  'precios, topes y capacidades vive en src/lib/lealtad/planes.ts, no '
  'en la base: es producto de Bookea, igual para todos. Los planes '
  'retirados siguen siendo válidos — hay cuentas con esos valores.';
