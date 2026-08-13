-- ============================================================
-- BOOKEA — Los tres paquetes de Lealtad (0141)
--
-- El catálogo que se OFRECE pasa a tres paquetes de pago:
--
--     Arranque    $12/mes   ·    200 clientes activos
--     Impulso     $42/mes   ·  1.150 clientes activos
--     Ilimitado   $89/mes   ·  clientes sin tope
--
-- más «Prueba», el plan sin costo que ya existía y que se queda: el
-- alta automática de /lealtad/nuevo depende de que HAYA un plan a $0
-- (`crearGratisAlInstante` se dispara con `precioMensual === 0`). Sin
-- ninguno, todo el mundo caería en el camino manual con comprobante.
--
-- Esta migración SOLO amplía los CHECK que enumeran los ids válidos.
-- El catálogo de verdad —precios, topes y capacidades— sigue viviendo
-- en src/lib/lealtad/planes.ts, porque es producto y no dato del
-- cliente.
--
-- ------------------------------------------------------------
-- POR QUÉ NO SE SACA NINGÚN ID VIEJO
-- ------------------------------------------------------------
-- Los cinco del catálogo anterior ('prueba', 'esencial', 'crece',
-- 'pro', 'empresa') y los cuatro de antes ('gratis', 'basico',
-- 'estandar', 'enterprise') SIGUEN en la lista. Hay filas guardadas
-- con esos valores —Rancho Las Torres está en 'basico'— y un CHECK que
-- los excluyera dejaría esas filas violando su propia restricción:
-- cualquier UPDATE posterior sobre el rancho —cambiarle el nombre, la
-- foto, lo que sea— explotaría con un error que no tiene nada que ver
-- con lo que se quiso guardar.
--
-- Retirar un paquete es dejar de OFRECERLO, no invalidar lo cobrado.
-- Eso se decide en planes.ts con `vigente: false`, no acá.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos drop constraint if exists ranchos_plan_lealtad_check;
alter table ranchos add constraint ranchos_plan_lealtad_check
  check (
    plan_lealtad is null
    or plan_lealtad in (
      -- Ofrecidos (0141)
      'prueba', 'arranque', 'impulso', 'ilimitado',
      -- Retirados en la 0141, conservados por las filas que ya existen
      'esencial', 'crece', 'pro', 'empresa',
      -- Retirados en la 0133, por lo mismo
      'gratis', 'basico', 'estandar', 'enterprise'
    )
  );

alter table solicitudes_lealtad drop constraint if exists solicitudes_lealtad_plan_check;
alter table solicitudes_lealtad add constraint solicitudes_lealtad_plan_check
  check (
    plan in (
      'prueba', 'arranque', 'impulso', 'ilimitado',
      'esencial', 'crece', 'pro', 'empresa',
      'gratis', 'basico', 'estandar', 'enterprise'
    )
  );

-- `cuentas.plan` (0134) es de donde sale el plan efectivo desde que el
-- módulo cuelga de la cuenta y no del rancho. Se amplía IGUAL y con la
-- misma lista: si el CHECK viejo quedara, mover una cuenta a 'impulso'
-- rebotaría y el negocio se quedaría con el plan anterior sin que nadie
-- se enterara. El `if exists` es porque la 0134 la pega el dueño a mano
-- y puede no estar corrida todavía.
do $migracion0141$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cuentas' and column_name = 'plan'
  ) then
    alter table cuentas drop constraint if exists cuentas_plan_check;
    alter table cuentas add constraint cuentas_plan_check
      check (
        plan is null
        or plan in (
          'prueba', 'arranque', 'impulso', 'ilimitado',
          'esencial', 'crece', 'pro', 'empresa',
          'gratis', 'basico', 'estandar', 'enterprise'
        )
      );
  end if;
end
$migracion0141$;

comment on column ranchos.plan_lealtad is
  'Plan del módulo de Lealtad (0124, 0131, 0133, 0141). El catálogo con '
  'precios, topes y capacidades vive en src/lib/lealtad/planes.ts, no '
  'en la base: es producto de Bookea, igual para todos. Los planes '
  'retirados siguen siendo válidos — hay cuentas con esos valores.';
