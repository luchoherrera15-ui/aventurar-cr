
-- ============================================================
-- BOOKEA — Regalías marcadas y rastro de quién movió el plan (0173)
--
-- Tres cosas, todas para la administración del módulo de Lealtad:
--
--   1. UNA REGALÍA SE PUEDE DISTINGUIR DE UNA VENTA.
--      Hoy no se puede. `addons_negocio` tiene `notas` («Para cortesías
--      y pruebas: por qué se activó», 0077) y el panel ofrece una
--      duración rotulada «1 mes (cortesía)»… que escribe EXACTAMENTE lo
--      mismo que una venta de un mes. La única diferencia entre lo
--      regalado y lo cobrado queda enterrada en prosa escrita a mano.
--      Cualquier auditoría de ingresos que quiera restar las cortesías
--      tendría que PARSEAR TEXTO LIBRE EN ESPAÑOL — o, peor, contarlas
--      como plata que entró.
--
--   2. EL PLAN DEJA RASTRO.
--      `ranchos.plan_lealtad` (0124) y `cuentas.plan` (0134) son UNA
--      columna de texto cada una: sin autor, sin fecha y sin historia.
--      Nadie puede contestar «¿quién le puso Impulso a este negocio, y
--      cuándo?» ni «¿qué paquete tenía el mes pasado?». Un registro sin
--      autor es un rumor — la misma regla que la 0126 aplicó a las
--      solicitudes con `atendida_por`.
--
--   3. LOS CLIENTES DE TODOS LOS NEGOCIOS, EN UNA CONSULTA.
--      La pantalla de admin traía la tabla `miembros` ENTERA a memoria
--      para contar por negocio (y encima cortada en 1.000 filas por el
--      `max-rows` de PostgREST, o sea que el número ya venía mal). Acá
--      va la función que lo contesta de una, con el MISMO criterio de
--      la 0142: personas distintas, solo membresías activas, por cuenta
--      y por negocio quedándose con el mayor.
--
-- ------------------------------------------------------------
-- LO QUE ESTA MIGRACIÓN **NO** HACE, Y HAY QUE DECIRLO
-- ------------------------------------------------------------
-- NO agrega el MONTO de lo que se cobró. Ni acá ni en ningún lado
-- existe hoy cuánta plata entró por un paquete de Lealtad: ni
-- `solicitudes_lealtad` (SINPE) ni `suscripciones` (Stripe) guardan
-- monto ni moneda. Esta migración deja marcado lo que se REGALÓ, que es
-- la mitad que sí se puede saber con certeza; la otra mitad —lo que se
-- cobró— necesita su propia decisión de producto (¿en dólares?, ¿en
-- colones al tipo de cambio del día?, ¿se cargan los cobros viejos a
-- mano?) y su propia migración.
--
-- O sea: después de pegar esto se puede contestar «¿esto se regaló?»
-- con un `where`. Todavía NO se puede contestar «¿cuánto entró?».
--
-- Aditiva e idempotente: no borra ni reescribe ninguna fila y se puede
-- correr las veces que haga falta.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Una regalía de COMPLEMENTO se marca como regalía
-- ------------------------------------------------------------
-- Se EXTIENDE `addons_negocio` (0077) en vez de estrenar una tabla de
-- cortesías: el complemento regalado y el vendido son la misma fila —
-- se enciende igual, vence igual y se quita igual. Lo único distinto es
-- si entró plata. Una tabla aparte obligaría a que las dos se
-- mantuvieran en sincronía, y a la primera desincronización el panel
-- diría una cosa y el gate `tiene_addon()` haría otra.
--
-- `vence_en` NO se duplica: la duración de la cortesía ya vive ahí
-- (null = indefinida, que es lo que la pantalla llama «sin
-- vencimiento»), y la hace cumplir la base desde la 0077. Agregar un
-- «cortesia_hasta» sería una SEGUNDA fecha de corte que nadie compara
-- — el mismo error que `prueba.ts` documenta sobre `cuentas.prueba_hasta`.
--
-- `notas` tampoco se duplica: ES el «por qué se dio», tal como lo
-- pensó la 0077. Lo que faltaba era el booleano y el autor.

alter table addons_negocio
  add column if not exists es_cortesia boolean not null default false;

-- Quién la otorgó. `on delete set null`: si algún día se borra la
-- cuenta del admin que la dio, la cortesía sigue marcada como cortesía
-- — perder el autor no puede convertir un regalo en una venta.
alter table addons_negocio
  add column if not exists otorgado_por uuid references auth.users(id) on delete set null;

comment on column addons_negocio.es_cortesia is
  'true = se REGALO (0173). No entro plata por esta fila. La duracion '
  'sigue siendo vence_en (null = indefinida) y el por que sigue siendo '
  'notas. Toda auditoria de ingresos tiene que excluir estas filas.';

comment on column addons_negocio.otorgado_por is
  'El admin que lo activo (0173). Un registro sin autor es un rumor.';

-- El índice sirve a la única consulta nueva que se hace seguido: «qué
-- se está regalando hoy». Parcial, porque lo normal es que sea false.
create index if not exists addons_negocio_cortesia_idx
  on addons_negocio (es_cortesia, vence_en)
  where es_cortesia;


-- ------------------------------------------------------------
-- 2. historial_plan_lealtad — quién movió el plan, cuándo y por qué
-- ------------------------------------------------------------
-- Es una BITÁCORA, no la fuente de verdad. El plan que manda sigue
-- siendo `cuentas.plan` con `ranchos.plan_lealtad` de respaldo (ver
-- `planEfectivo` en src/lib/lealtad/cuenta.ts). Acá queda lo que esas
-- dos columnas no pueden guardar: el antes, el autor, el motivo y si
-- fue venta o regalo.
--
-- POR QUÉ NO ES UN TRIGGER SOBRE `ranchos`
-- Porque un trigger no sabe el POR QUÉ ni el CONCEPTO, que es
-- justamente lo que hay que registrar: para el trigger, regalar
-- «Impulso» y venderlo son el mismo UPDATE. Y porque el webhook de
-- Stripe escribe esas columnas con la llave de servicio: un trigger
-- ahí adentro convierte un fallo de bitácora en un cobro que no
-- activa. La bitácora la escribe quien SABE lo que está haciendo.
--
-- Consecuencia honesta, y va escrita para que nadie la descubra tarde:
-- **el historial NO es completo.** Un plan movido por el webhook de
-- Stripe o por el alta automática no deja fila acá. Lo que se puede
-- afirmar mirando esta tabla es «esto lo hizo tal admin, tal día, por
-- esto»; lo que NO se puede afirmar es «el plan nunca cambió de otra
-- forma».

create table if not exists historial_plan_lealtad (
  id uuid primary key default gen_random_uuid(),

  -- El negocio. `cascade`: si el negocio se borra, su bitácora de plan
  -- se va con él (no hay a quién auditarle nada).
  rancho_id uuid not null references ranchos(id) on delete cascade,

  -- La cuenta (0134), cuando existe. Se guarda además del rancho
  -- porque el plan efectivo sale de acá, y saber en cuál de las dos se
  -- escribió es la diferencia entre «se aplicó» y «se vio aplicado».
  --
  -- SIN `references cuentas(id)` a propósito, por dos razones: la 0134
  -- puede no estar corrida en la base donde se pegue esto (y una FK a
  -- una tabla que no existe aborta la migración entera), y borrar una
  -- cuenta no puede llevarse por delante el registro de lo que se le
  -- regaló.
  cuenta_id uuid,

  -- Sin CHECK contra la lista de paquetes A PROPÓSITO: es historia, y
  -- el día que un paquete se retire del catálogo estas filas tienen que
  -- seguir diciendo lo que decían. Un CHECK acá haría que retirar un
  -- plan reescribiera el pasado o rompiera los INSERT.
  plan_antes text,
  plan_despues text,

  -- QUÉ FUE ESTE MOVIMIENTO. Es la columna que separa la plata del
  -- regalo, y por eso sí lleva CHECK:
  --   venta      — el negocio pagó (SINPE, transferencia o tarjeta).
  --   cortesia   — se REGALÓ. No entró plata.
  --   correccion — se arregló un dato mal cargado. No es ni venta ni
  --                regalo: el negocio queda como debía estar.
  --   baja       — se le quitó el paquete (se acabó la cortesía, dejó
  --                de pagar, se dio de baja).
  concepto text not null check (concepto in ('venta', 'cortesia', 'correccion', 'baja')),

  -- Hasta cuándo dura la regalía. null = indefinida.
  --
  -- ⚠️ ESTA FECHA NO APAGA NADA POR SÍ SOLA, y decirlo importa: el plan
  -- no tiene gate por tiempo (el que sí lo tiene es el complemento
  -- `lealtad`, por `addons_negocio.vence_en`). Acá es un COMPROMISO
  -- ANOTADO, y la pantalla de admin lo saca a la superficie cuando se
  -- pasa la fecha. Prometer que se apaga sola sería vender un candado
  -- que no existe.
  cortesia_hasta timestamptz,

  -- Por qué. Para las cortesías es obligatorio del lado del servidor
  -- (una regalía sin motivo es plata que se fue sin explicación); acá
  -- queda nullable porque una venta o una baja pueden no necesitarlo.
  motivo text check (motivo is null or char_length(motivo) <= 300),

  -- Quién lo hizo. `set null` por lo mismo que arriba: perder al autor
  -- no puede borrar el hecho.
  autor_id uuid references auth.users(id) on delete set null,

  creado_en timestamptz not null default now()
);

create index if not exists historial_plan_lealtad_rancho_idx
  on historial_plan_lealtad (rancho_id, creado_en desc);

-- Para la bandeja «cortesías»: las vigentes y las que se pasaron de
-- fecha, sin recorrer la bitácora entera.
create index if not exists historial_plan_lealtad_cortesias_idx
  on historial_plan_lealtad (creado_en desc)
  where concepto = 'cortesia';

comment on table historial_plan_lealtad is
  'Bitacora de los cambios de paquete de Lealtad hechos desde el panel '
  'de admin (0173): que habia antes, que quedo, quien lo hizo, cuando y '
  'con que concepto (venta / cortesia / correccion / baja). NO es la '
  'fuente de verdad del plan (esa es cuentas.plan con ranchos.plan_lealtad '
  'de respaldo) y NO es completa: lo que mueve el webhook de Stripe o el '
  'alta automatica no deja fila aca.';

alter table historial_plan_lealtad enable row level security;

-- Solo Bookea la ve. No es información del dueño del negocio: dice
-- cuánto se le regaló y quién lo autorizó.
drop policy if exists "Solo Bookea ve el historial de planes" on historial_plan_lealtad;
create policy "Solo Bookea ve el historial de planes" on historial_plan_lealtad
  for select to authenticated
  using (is_admin());

-- Y NADIE escribe desde el navegador, ni siquiera un admin: sin
-- política de insert/update/delete la RLS niega por defecto. Escribe
-- únicamente el servidor con la llave de servicio, en la misma acción
-- que mueve el plan — así la bitácora no puede quedar contando una
-- historia distinta de la que pasó.
--
-- Sin `grant` la RLS más perfecta contesta "permission denied"
-- (lección de la 0119).
grant select on historial_plan_lealtad to authenticated;
grant all on historial_plan_lealtad to service_role;


-- ------------------------------------------------------------
-- 3. Los clientes de TODOS los negocios, en una sola consulta
-- ------------------------------------------------------------
-- Mismo criterio, palabra por palabra, que `personas_activas_de_la_cuenta`
-- y `personas_activas_del_negocio` (0142):
--
--   · personas DISTINTAS, no filas — dos pases de la misma señora son
--     UN cliente (lo promete `planes.ts` por escrito);
--   · `coalesce(persona_id, id)` — una fila sin persona cuenta como su
--     propia persona: ignorarla mostraría el negocio más vacío de lo
--     que está, y regalar cupo es el error que no se puede permitir;
--   · solo `estado = 'activa'` — pausadas y canceladas no ocupan;
--   · el MAYOR entre el conteo por cuenta y el conteo por negocio,
--     porque la 0134 se corrió en dos tiempos y hay programas con
--     `cuenta_id` en null. Quedarse con el menor sería regalar cupo.
--
-- Si los tres números no coinciden con los de las funciones de la 0142,
-- el panel de admin diría un número y la puerta de Wallet otra: por eso
-- el criterio se repite entero acá abajo y no se "simplifica".
--
-- Es `security definer` y se otorga SOLO a `service_role`: la única que
-- la llama es la pantalla de admin, que ya lee con la llave de
-- servicio. Un `authenticated` con esto en la mano tendría el mapa de
-- clientes de toda la plataforma.

do $regalias0173$
declare
  v_persona boolean;
  v_cuenta  boolean;
  v_expr    text;
  v_cuerpo  text;
begin
  if to_regclass('public.miembros') is null
     or to_regclass('public.programa_lealtad') is null then
    raise notice 'AVISO 0173: falta miembros o programa_lealtad (0060). No se crea la funcion de conteo.';
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'miembros' and column_name = 'persona_id'
  ) into v_persona;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'programa_lealtad' and column_name = 'cuenta_id'
  ) into v_cuenta;

  -- Sin la 0138 no hay `persona_id`: se cuenta por fila, que es lo que
  -- hacía el código viejo. Se degrada al comportamiento anterior, no a
  -- uno peor.
  v_expr := case when v_persona then 'coalesce(m.persona_id, m.id)' else 'm.id' end;

  if v_cuenta and to_regclass('public.cuentas') is not null then
    v_cuerpo := format($cuerpo$
      with vivos as (
        select pl.rancho_id as r_negocio, pl.cuenta_id, %s as persona
          from miembros m
          join programa_lealtad pl on pl.id = m.programa_id
         where m.estado = 'activa'
      ),
      por_negocio as (
        select v.r_negocio as r, count(distinct v.persona)::integer as n
          from vivos v where v.r_negocio is not null group by v.r_negocio
      ),
      por_cuenta as (
        select c.rancho_id as r, count(distinct v.persona)::integer as n
          from vivos v join cuentas c on c.id = v.cuenta_id
         where c.rancho_id is not null group by c.rancho_id
      )
      select coalesce(n.r, k.r), greatest(coalesce(n.n, 0), coalesce(k.n, 0))
        from por_negocio n
        full outer join por_cuenta k on k.r = n.r
    $cuerpo$, v_expr);
  else
    raise notice 'AVISO 0173: falta programa_lealtad.cuenta_id o cuentas (0134). El conteo va solo por negocio.';
    -- Con alias (`r`, `n`) y no con los nombres de las columnas de
    -- salida: en una función `language sql` con `returns table`, un
    -- nombre igual al del parámetro de salida puede volverse una
    -- referencia ambigua.
    v_cuerpo := format($cuerpo$
      select pl.rancho_id as r, count(distinct %s)::integer as n
        from miembros m
        join programa_lealtad pl on pl.id = m.programa_id
       where m.estado = 'activa' and pl.rancho_id is not null
       group by pl.rancho_id
    $cuerpo$, v_expr);
  end if;

  execute format($fn$
create or replace function public.clientes_activos_por_negocio()
returns table (rancho_id uuid, personas integer)
language sql
stable
security definer
set search_path = public
as $cuerpo_conteo$
%s
$cuerpo_conteo$;
  $fn$, v_cuerpo);

  execute 'revoke all on function public.clientes_activos_por_negocio() from public, anon, authenticated';
  execute 'grant execute on function public.clientes_activos_por_negocio() to service_role';

  execute $doc$
comment on function public.clientes_activos_por_negocio() is
  'Clientes activos de CADA negocio en una sola consulta (0173), con el '
  'mismo criterio que personas_activas_de_la_cuenta / _del_negocio (0142). '
  'La usa la pantalla de admin del modulo de Lealtad, que antes traia la '
  'tabla miembros entera —y cortada en 1.000 filas— para contar en memoria.';
  $doc$;
end
$regalias0173$;


notify pgrst, 'reload schema';
