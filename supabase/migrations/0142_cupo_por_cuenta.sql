-- ============================================================
-- BOOKEA — El cupo de clientes se cuenta POR CUENTA (0142)
--
-- El tope `clientesActivos` de src/lib/lealtad/planes.ts se hace
-- cumplir en las dos puertas de Wallet (generar.ts para Apple,
-- google.ts para Google). Hasta hoy lo contaba así:
--
--     select count(*) from miembros where programa_id = <la tarjeta>
--
-- y eso tenía TRES defectos, cada uno en dirección contraria:
--
--   1. CONTABA POR TARJETA, no por cuenta. Cada tarjeta nueva regalaba
--      un cupo entero: un paquete de 200 con dos tarjetas afiliaba 400
--      y nadie se enteraba. Por eso los paquetes de pago iban con
--      `programas: 1` — un candado puesto para tapar este agujero.
--
--   2. CONTABA FILAS, no personas. Desde la 0138 hay alta anónima y
--      `unique (programa_id, cliente_id)` ya no garantiza una fila por
--      persona: dos pases de la misma señora gastaban dos lugares,
--      mientras planes.ts promete por escrito que «varias tarjetas de
--      la misma persona = UN cliente».
--
--   3. CONTABA TODOS LOS ESTADOS, incluidos 'pausada' y 'cancelada',
--      mientras el tipo promete «pases vigentes». Un negocio que dio de
--      baja a media clientela seguía viéndose lleno.
--
-- La 0138 ya dejó escrito el arreglo de los puntos 2 y 3 en
-- `personas_activas_del_programa`… pero por PROGRAMA, y nadie la llama
-- (grep en src/: cero). Esta migración pone las dos que sí resuelven el
-- punto 1, que es el que cuesta plata.
--
-- ------------------------------------------------------------
-- LOS NÚMEROS SE MUEVEN EN LAS DOS DIRECCIONES
-- ------------------------------------------------------------
-- BAJAN donde haya miembros pausados o cancelados (antes contaban).
-- SUBEN donde el negocio tenga varias tarjetas (antes cada una tenía su
-- propio cupo). Un negocio con 300 clientes repartidos en dos tarjetas
-- de un paquete de 200 pasa a estar lleno de golpe sin haber hecho
-- nada. Antes de pegar esto, correr:
--
--     node scripts/cupo-antes-y-despues.mjs
--
-- que no escribe nada y dice, negocio por negocio, cuánto cambia.
--
-- ------------------------------------------------------------
-- LA CUARTA GRIETA, QUE ESTA MIGRACIÓN NO CIERRA
-- ------------------------------------------------------------
-- El tope vive SOLO en las dos puertas de Wallet. El RPC de alta
-- anónima de la 0138 (`alta_persona_por_qr`) inserta en `miembros`
-- directo y su propio comentario dice «el tope lo comprueba el servidor
-- antes de llamar». Hoy nadie lo llama desde src/, así que no hay fuga;
-- el día que se conecte, ese llamador TIENE que preguntar por
-- `personas_activas_de_la_cuenta` antes de insertar, o el tope se
-- salta entero por la puerta del QR.
--
-- ------------------------------------------------------------
-- Aditiva e idempotente: no borra ni cambia ninguna fila, y se puede
-- correr las veces que haga falta. Si falta una migración previa
-- (0134 / 0138) no revienta: avisa por NOTICE y crea lo que puede — el
-- código de src/lib/lealtad/cupo.ts cae al conteo a mano mientras
-- tanto.
-- ============================================================

do $cupo0142$
declare
  v_persona boolean;
  v_cuenta  boolean;
begin
  -- Sin las tablas del módulo no hay nada que contar.
  if to_regclass('public.miembros') is null
     or to_regclass('public.programa_lealtad') is null then
    raise notice 'AVISO 0142: falta miembros o programa_lealtad (0060). No se crea nada.';
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'miembros'
       and column_name = 'persona_id'
  ) into v_persona;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'programa_lealtad'
       and column_name = 'cuenta_id'
  ) into v_cuenta;

  -- `persona_id` es de la 0138 y es lo que hace que dos pases de la
  -- misma señora cuenten UNO. Sin esa columna, estas funciones no se
  -- pueden ni compilar: son `language sql`, o sea que Postgres les
  -- valida el cuerpo al crearlas.
  if not v_persona then
    raise notice 'AVISO 0142: falta miembros.persona_id (0138). Pegá la 0138 y volvé a correr esta.';
    return;
  end if;

  -- ----------------------------------------------------------
  -- 1. Por CUENTA — el número que manda desde la 0134
  --
  -- `coalesce(m.persona_id, m.id)` y no `m.persona_id` pelado: si el
  -- backfill de la 0138 dejó filas sin persona (la columna quedó
  -- nullable a propósito en ese caso), `count(distinct persona_id)` las
  -- IGNORARÍA y el negocio se vería más vacío de lo que está. Contar la
  -- fila como su propia persona nunca regala cupo, que es el error que
  -- se puede permitir de los dos.
  -- ----------------------------------------------------------
  if v_cuenta then
    execute $fn_cuenta$
create or replace function public.personas_activas_de_la_cuenta(p_cuenta uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $cuerpo_cuenta$
  select coalesce(count(distinct coalesce(m.persona_id, m.id)), 0)::integer
    from miembros m
    join programa_lealtad pl on pl.id = m.programa_id
   where pl.cuenta_id = p_cuenta
     and m.estado = 'activa';
$cuerpo_cuenta$;
$fn_cuenta$;

    execute 'revoke all on function public.personas_activas_de_la_cuenta(uuid) from public, anon';
    execute 'grant execute on function public.personas_activas_de_la_cuenta(uuid) to authenticated, service_role';

    execute $doc_cuenta$
comment on function public.personas_activas_de_la_cuenta(uuid) is
  'Personas distintas con al menos un pase VIGENTE en cualquier tarjeta '
  'de la cuenta (0142). Es el número contra el que se compara el tope '
  'clientesActivos del paquete. Cuenta personas y no filas, y solo '
  'estado activa: una tarjeta mas NO agrega cupo.';
$doc_cuenta$;
  else
    raise notice 'AVISO 0142: falta programa_lealtad.cuenta_id (0134). Queda solo la funcion por negocio.';
  end if;

  -- ----------------------------------------------------------
  -- 2. Por NEGOCIO — el respaldo de la transición
  --
  -- La 0134 movió el módulo de `ranchos` a `cuentas` en dos tiempos, y
  -- el segundo tiempo no se corrió: hay programas con `cuenta_id` en
  -- null. Para esos, y para la ventana en que un negocio todavía no
  -- tiene cuenta, este es el conteo que vale. Se cuenta por
  -- `rancho_id`, que TODO programa tiene desde la 0060.
  -- ----------------------------------------------------------
  execute $fn_negocio$
create or replace function public.personas_activas_del_negocio(p_rancho uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $cuerpo_negocio$
  select coalesce(count(distinct coalesce(m.persona_id, m.id)), 0)::integer
    from miembros m
    join programa_lealtad pl on pl.id = m.programa_id
   where pl.rancho_id = p_rancho
     and m.estado = 'activa';
$cuerpo_negocio$;
$fn_negocio$;

  execute 'revoke all on function public.personas_activas_del_negocio(uuid) from public, anon';
  execute 'grant execute on function public.personas_activas_del_negocio(uuid) to authenticated, service_role';

  execute $doc_negocio$
comment on function public.personas_activas_del_negocio(uuid) is
  'Lo mismo que personas_activas_de_la_cuenta pero por rancho_id '
  '(0142), para los programas que la 0134 todavia no colgo de una '
  'cuenta. src/lib/lealtad/cupo.ts pide las dos y se queda con la '
  'mayor: quedarse corto seria regalar cupo.';
$doc_negocio$;
end
$cupo0142$;
