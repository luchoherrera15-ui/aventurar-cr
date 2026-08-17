-- ============================================================
-- BOOKEA — Los CHECK de plan vuelven a los CUATRO paquetes (0179)
--
-- El catálogo de Lealtad arrastraba OCHO paquetes retirados de tres
-- etapas anteriores:
--
--     0124/0131 →  'gratis', 'basico', 'estandar', 'enterprise'
--     0133      →  'esencial', 'crece', 'pro', 'empresa'
--
-- Ninguno se vende desde la 0141, pero sus ids seguían en los CHECK de
-- las cuatro columnas que guardan un plan, y sus definiciones seguían
-- en src/lib/lealtad/planes.ts. Esta migración deja las cuatro listas
-- en los cuatro paquetes de hoy:
--
--     'prueba', 'arranque', 'impulso', 'ilimitado'
--
-- ------------------------------------------------------------
-- POR QUÉ AHORA SE PUEDE, SI LA 0141 DIJO QUE NO
-- ------------------------------------------------------------
-- La 0141 conservó los ocho por una razón concreta y correcta: había
-- filas con esos valores. Rancho Las Torres estaba en 'basico', y un
-- CHECK que lo excluyera habría dejado esa fila violando su propia
-- restricción — cualquier UPDATE posterior sobre el rancho (el nombre,
-- la foto, lo que sea) explotaría con un error que no tiene nada que
-- ver con lo que se quiso guardar.
--
-- Esa razón se terminó: el 2026-08-17 se consultaron las CUATRO
-- columnas en producción y ninguna tenía una sola fila con ninguno de
-- los ocho ids. El único plan vivo en toda la base era
-- `ranchos.plan_lealtad = 'prueba'` (1 fila). Rancho Las Torres dejó el
-- módulo, que es lo que abrió la ventana.
--
-- ------------------------------------------------------------
-- SI ENTRE HOY Y EL PEGADO APARECE UNA FILA, ESTO FALLA LIMPIO
-- ------------------------------------------------------------
-- La ventana no se cierra sola: entre que esto se escribe y que alguien
-- lo pega en el SQL Editor puede pasar cualquier cosa —un admin
-- corrigiendo una fila a mano, una migración vieja a medio pegar—.
--
-- El riesgo real NO es que el ALTER falle: Postgres valida las filas
-- existentes al agregar un CHECK, así que una fila con 'basico' haría
-- reventar el `add constraint` solo. El problema es que reventaría con
-- «check constraint ... is violated by some row», sin decir QUÉ fila ni
-- QUÉ valor, y con parte del script ya corrido.
--
-- Por eso el bloque de abajo va PRIMERO y hace el trabajo de decirlo:
-- recorre las cuatro columnas, junta los valores que sobran con su
-- conteo y su tabla, y aborta con un mensaje que se entiende y que
-- indica qué hacer. Como todo el script corre en UNA transacción, el
-- `raise exception` deja la base exactamente como estaba: ningún CHECK
-- tocado, ninguna fila movida.
--
-- Y el orden importa en la otra dirección también: NO se corrige nada
-- automáticamente. Un UPDATE que mueva a alguien de 'basico' a 'prueba'
-- para que la migración pase le estaría cambiando el paquete a un
-- negocio sin que nadie lo decida — de un plan sin topes a uno de 5
-- clientes. Eso lo decide una persona, mirando el caso.
--
-- ⚠️ SI ESTO ABORTA: el catálogo de TypeScript y la base quedaron
-- desincronizados, y hay que volver a poner el id que apareció en
-- `PLANES_RETIRADOS` (con `vigente: false` y su definición) ANTES de
-- volver a intentar. Borrar la definición de un paquete que una fila
-- tiene puesto hace que `definicionDe()` devuelva null, y con plan
-- desconocido TODOS los topes quedan en null: no lo apaga, lo vuelve
-- ilimitado y gratis.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. LA PUERTA: ninguna fila puede tener un plan fuera de los cuatro.
-- ------------------------------------------------------------
-- Escrito con cuatro consultas literales y no con SQL dinámico a
-- propósito. Una versión con `format()` y `execute` recorriendo una
-- lista de tablas queda más corta, pero es un texto que nadie puede
-- leer para convencerse de que no escribe nada — y esto es justamente
-- el bloque que tiene que dar confianza antes de pegarlo.
--
-- `cuentas` (0134) y `suscripciones` (0143) pueden no existir todavía:
-- las migraciones las pega el dueño a mano. PL/pgSQL prepara cada
-- consulta la primera vez que la EJECUTA, así que la que queda dentro
-- de un `if` falso no se planea y no rompe. Es el mismo recurso que usa
-- la 0141 para `cuentas`.
do $migracion0179$
declare
  fila record;
  problemas text := '';
begin
  for fila in
    select plan_lealtad as plan, count(*) as cuantas
    from public.ranchos
    where plan_lealtad is not null
      and plan_lealtad not in ('prueba', 'arranque', 'impulso', 'ilimitado')
    group by 1 order by 1
  loop
    problemas := problemas
      || format(E'  ranchos.plan_lealtad = %L  ->  %s fila(s)\n', fila.plan, fila.cuantas);
  end loop;

  for fila in
    select plan as plan, count(*) as cuantas
    from public.solicitudes_lealtad
    where plan is not null
      and plan not in ('prueba', 'arranque', 'impulso', 'ilimitado')
    group by 1 order by 1
  loop
    problemas := problemas
      || format(E'  solicitudes_lealtad.plan = %L  ->  %s fila(s)\n', fila.plan, fila.cuantas);
  end loop;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cuentas' and column_name = 'plan'
  ) then
    for fila in
      select plan as plan, count(*) as cuantas
      from public.cuentas
      where plan is not null
        and plan not in ('prueba', 'arranque', 'impulso', 'ilimitado')
      group by 1 order by 1
    loop
      problemas := problemas
        || format(E'  cuentas.plan = %L  ->  %s fila(s)\n', fila.plan, fila.cuantas);
    end loop;
  end if;

  if to_regclass('public.suscripciones') is not null then
    for fila in
      select plan as plan, count(*) as cuantas
      from public.suscripciones
      where plan is not null
        and plan not in ('prueba', 'arranque', 'impulso', 'ilimitado')
      group by 1 order by 1
    loop
      problemas := problemas
        || format(E'  suscripciones.plan = %L  ->  %s fila(s)\n', fila.plan, fila.cuantas);
    end loop;
  end if;

  if problemas <> '' then
    raise exception using
      message = 'La 0179 NO se aplicó: hay filas con un paquete que ya no está en el catálogo.',
      detail  = E'\n' || problemas,
      hint    = 'No lo arreglés con un UPDATE a ciegas: cambiarle el paquete a un negocio es '
             || 'cambiarle los topes. Volvé a poner ese id en PLANES_RETIRADOS '
             || '(src/lib/lealtad/planes.ts) con vigente:false y su definición, o movele el '
             || 'plan a mano decidiendo caso por caso. Recién ahí corré esta migración otra vez.';
  end if;
end
$migracion0179$;

-- ------------------------------------------------------------
-- 2. LOS CUATRO CHECK, redeclarados enteros.
-- ------------------------------------------------------------
-- Se redeclaran completos (`drop` + `add`) y no se «editan»: un CHECK
-- no se modifica en Postgres, y tenerlos escritos enteros es lo que
-- hace que `checks-de-planes.test.ts` pueda leer la lista de verdad
-- desde el .sql y compararla contra PLANES_ID en las dos direcciones.
--
-- ⚠️ Esa prueba lee LA ÚLTIMA migración que tocó cada CHECK. Si mañana
-- una 0190 vuelve a ampliarlos, hay que mover la lista CHECKS de ese
-- archivo a la 0190.

alter table ranchos drop constraint if exists ranchos_plan_lealtad_check;
alter table ranchos add constraint ranchos_plan_lealtad_check
  check (
    plan_lealtad is null
    or plan_lealtad in ('prueba', 'arranque', 'impulso', 'ilimitado')
  );

alter table solicitudes_lealtad drop constraint if exists solicitudes_lealtad_plan_check;
alter table solicitudes_lealtad add constraint solicitudes_lealtad_plan_check
  check (
    plan in ('prueba', 'arranque', 'impulso', 'ilimitado')
  );

-- `cuentas.plan` (0134) es de donde sale el plan efectivo desde que el
-- módulo cuelga de la cuenta y no del rancho. El `if exists` es porque
-- la 0134 la pega el dueño a mano y puede no estar corrida todavía.
do $cuentas0179$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cuentas' and column_name = 'plan'
  ) then
    alter table cuentas drop constraint if exists cuentas_plan_check;
    alter table cuentas add constraint cuentas_plan_check
      check (
        plan is null
        or plan in ('prueba', 'arranque', 'impulso', 'ilimitado')
      );
  end if;
end
$cuentas0179$;

-- `suscripciones.plan` (0143). Tiene que aceptar EXACTAMENTE lo mismo
-- que las otras tres: si acá entrara un id que allá no existe, el
-- webhook guardaría la suscripción bien y después reventaría al
-- escribir el plan en el negocio — cobrado y sin activar, el peor de
-- los dos mundos.
do $suscripciones0179$
begin
  if to_regclass('public.suscripciones') is not null then
    alter table suscripciones drop constraint if exists suscripciones_plan_check;
    alter table suscripciones add constraint suscripciones_plan_check
      check (
        plan is null
        or plan in ('prueba', 'arranque', 'impulso', 'ilimitado')
      );
  end if;
end
$suscripciones0179$;

-- ------------------------------------------------------------
-- 3. El comentario de la columna, que decía lo contrario.
-- ------------------------------------------------------------
comment on column ranchos.plan_lealtad is
  'Plan del módulo de Lealtad (0124, 0131, 0133, 0141, 0179). El catálogo con '
  'precios, topes y capacidades vive en src/lib/lealtad/planes.ts, no '
  'en la base: es producto de Bookea, igual para todos. Hoy son cuatro '
  'y ninguno está retirado; el día que se retire uno, su id SE QUEDA en '
  'este CHECK y en PLANES_RETIRADOS mientras exista una fila que lo tenga.';
