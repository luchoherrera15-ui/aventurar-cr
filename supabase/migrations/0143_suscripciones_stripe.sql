-- ============================================================
-- BOOKEA — Suscripciones de Stripe para los planes de Lealtad (0143)
--
-- Hasta hoy los paquetes de pago se cobraban de UNA sola forma: la
-- persona deposita por SINPE, sube el comprobante, y un administrador
-- aprueba a mano desde /admin/complementos (0126 + 0128 + 0130).
--
-- ESE CAMINO SE QUEDA TAL CUAL. Muchas tarjetas costarricenses vienen
-- bloqueadas para compras internacionales y la LLC cobra desde Estados
-- Unidos: el SINPE va a seguir haciendo falta. Stripe se SUMA como
-- segunda opción, no reemplaza nada — esta migración no toca
-- `solicitudes_lealtad` ni ninguna de sus políticas.
--
-- El plan `prueba` ($0) tampoco pasa por acá: se sigue activando solo
-- (`crearGratisAlInstante` en src/app/lealtad/nuevo/actions.ts).
--
-- ------------------------------------------------------------
-- LO QUE ESTA MIGRACIÓN CREA, Y POR QUÉ SON DOS TABLAS
-- ------------------------------------------------------------
--   · `suscripciones`  — qué negocio paga qué, en qué estado y hasta
--     cuándo. Es el ESPEJO de lo que Stripe tiene; la verdad última
--     siempre es Stripe.
--   · `eventos_stripe` — un renglón por evento recibido, con el
--     `stripe_event_id` como llave primaria. Es la tabla de
--     IDEMPOTENCIA y no un log: sin ella, el reintento normal de
--     Stripe activaría (o cobraría) dos veces el mismo evento.
--
-- Misma doctrina que el canje de la 0137: la idempotencia se resuelve
-- con un ÍNDICE ÚNICO y no con un «¿ya existe? entonces no inserto».
-- El `select` de antes tiene una ventana entre la pregunta y la
-- respuesta, y dos entregas simultáneas del mismo evento la pasan las
-- dos. El índice no tiene ventana: lo resuelve el motor.
--
-- ------------------------------------------------------------
-- QUIÉN ESCRIBE ACÁ: SOLO EL SERVIDOR
-- ------------------------------------------------------------
-- `suscripciones` se lee con la sesión (el dueño ve la suya) pero NO
-- se escribe desde el navegador: no hay grant de insert/update/delete
-- para `authenticated`. La escribe el webhook con la llave de servicio
-- y nadie más. Una suscripción que el cliente pudiera escribir es un
-- plan de $89 regalado con un `curl`.
--
-- `eventos_stripe` va más lejos: RLS activa y CERO políticas, igual
-- que `registros_dispositivo` (0060). Con RLS encendida y sin ninguna
-- política, Postgres niega por defecto — la tabla no existe para el
-- navegador, ni para leer.
--
-- ------------------------------------------------------------
-- EL PLAN NO SE DEGRADA SOLO
-- ------------------------------------------------------------
-- Cuando una suscripción se cancela o cae en mora, esta base guarda el
-- ESTADO nuevo pero NO le baja el plan al negocio. Es deliberado:
-- bajar de `ilimitado` a `prueba` recorta el cupo de 1.150 clientes a
-- 25 de un segundo para otro, y el primero que se entera es el cliente
-- que no puede agregar su tarjeta en el mostrador. La baja la decide
-- una persona desde /admin/complementos, avisada por correo.
--
-- El día que se quiera automatizar, el lugar es el webhook
-- (src/app/api/stripe/webhook/route.ts), no un trigger acá.
--
-- ------------------------------------------------------------
-- Aditiva e idempotente: no borra ni cambia ninguna fila y se puede
-- correr las veces que haga falta. Si falta la 0134 (`cuentas`) no
-- revienta: avisa por NOTICE y deja `cuenta_id` sin llave foránea.
-- ============================================================


-- ------------------------------------------------------------
-- 1. eventos_stripe — LA TABLA DE IDEMPOTENCIA
-- ------------------------------------------------------------
-- Stripe REINTENTA. Un evento entregado dos veces (o tres) es lo
-- normal, no la excepción: el reintento es cómo Stripe garantiza la
-- entrega cuando nuestra respuesta se pierde en el camino.
--
-- `stripe_event_id` es la PRIMARY KEY —o sea, único— y el webhook
-- inserta ACÁ antes de tocar nada más. El segundo intento choca contra
-- la llave y sale sin escribir.
--
-- `procesado_en` distingue dos duplicados muy distintos:
--   · el que llega después de un procesamiento COMPLETO
--     (procesado_en con fecha) → se ignora, ya está hecho;
--   · el que llega después de uno que se cayó a la mitad
--     (procesado_en en null) → se vuelve a intentar. Todas las
--     escrituras del webhook son upserts por `stripe_subscription_id`,
--     así que repetirlas no duplica nada.
--
-- `payload` guarda el evento completo. No es decoración: cuando un
-- cobro no cuadre, es la única copia de lo que Stripe dijo de verdad.
create table if not exists eventos_stripe (
  stripe_event_id text primary key,
  tipo            text not null,
  payload         jsonb,
  recibido_en     timestamptz not null default now(),
  procesado_en    timestamptz
);

create index if not exists eventos_stripe_recibido_idx
  on eventos_stripe (recibido_en desc);

-- Los que quedaron a medias: la consulta que hay que mirar cuando algo
-- no se activó.
create index if not exists eventos_stripe_pendientes_idx
  on eventos_stripe (recibido_en desc)
  where procesado_en is null;

alter table eventos_stripe enable row level security;

-- Sin políticas ni grants a propósito, igual que `registros_dispositivo`
-- (0060): esta tabla es 100% del servidor. La escribe el webhook con la
-- llave de servicio; el navegador y la app jamás la tocan.

comment on table eventos_stripe is
  'Un renglón por evento de Stripe recibido (0143). Es la tabla de '
  'IDEMPOTENCIA, no un log: stripe_event_id es la llave primaria y el '
  'webhook inserta acá ANTES de hacer nada, asi el reintento de Stripe '
  'no activa ni cobra dos veces. RLS activa y cero politicas: Postgres '
  'niega por defecto.';

comment on column eventos_stripe.procesado_en is
  'null = el evento entro pero el trabajo no termino. Un duplicado con '
  'esto en null SI se vuelve a procesar (las escrituras son upserts); '
  'con fecha, se ignora.';


-- ------------------------------------------------------------
-- 2. suscripciones — el espejo de lo que Stripe cobra
-- ------------------------------------------------------------
-- `rancho_id` Y/O `cuenta_id`: hoy el panel de Lealtad entra por
-- rancho (/lealtad/panel/[id]) pero desde la 0134 el módulo cuelga de
-- `cuentas`, y una cuenta puede no tener rancho. Se guardan los dos
-- cuando se saben, y el CHECK exige al menos uno — una suscripción sin
-- dueño es plata cobrada que nadie sabe a quién activarle.
create table if not exists suscripciones (
  id uuid primary key default gen_random_uuid(),

  rancho_id uuid references ranchos(id) on delete cascade,
  -- La llave foránea a `cuentas` se agrega más abajo, solo si la 0134
  -- está corrida: declararla acá haría fallar la migración entera en
  -- una base que todavía no tiene la tabla.
  cuenta_id uuid,

  -- Los tres identificadores de Stripe. `stripe_customer_id` es lo que
  -- abre el Customer Portal (cambiar tarjeta, cambiar de plan,
  -- cancelar) sin que nosotros construyamos ninguna de esas pantallas.
  stripe_customer_id     text not null,
  stripe_subscription_id text not null,
  -- El precio que se está cobrando. De acá sale el plan, por el mapeo
  -- price→plan que vive en variables de entorno (ver .env.example).
  stripe_price_id        text,

  -- El id del catálogo (src/lib/lealtad/planes.ts). NULLABLE a
  -- propósito: si llega un price_id que el servidor no sabe mapear, la
  -- suscripción se guarda igual con el plan en null —queda registrada
  -- y se puede arreglar— pero NO se le activa nada a nadie. Perder el
  -- registro de un cobro real sería mucho peor que no activarlo.
  plan    text,
  periodo text not null default 'mensual',

  estado  text not null default 'morosa',

  -- El período que se está pagando ahora mismo, tal como lo dice
  -- Stripe. Sirve para «tu plan está pago hasta el …».
  periodo_inicio timestamptz,
  periodo_fin    timestamptz,

  -- true = el cliente canceló desde el Portal pero el período pago
  -- sigue corriendo. NO es lo mismo que cancelada: hasta que termine,
  -- el negocio tiene lo que pagó.
  cancel_at_period_end boolean not null default false,

  creada_en      timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),

  constraint suscripciones_dueno_check
    check (rancho_id is not null or cuenta_id is not null)
);

-- Aditivo: si una versión anterior de la tabla ya existe, estas
-- columnas se suman sin tocar lo que hubiera.
alter table suscripciones add column if not exists rancho_id uuid;
alter table suscripciones add column if not exists cuenta_id uuid;
alter table suscripciones add column if not exists stripe_customer_id text;
alter table suscripciones add column if not exists stripe_subscription_id text;
alter table suscripciones add column if not exists stripe_price_id text;
alter table suscripciones add column if not exists plan text;
alter table suscripciones add column if not exists periodo text not null default 'mensual';
alter table suscripciones add column if not exists estado text not null default 'morosa';
alter table suscripciones add column if not exists periodo_inicio timestamptz;
alter table suscripciones add column if not exists periodo_fin timestamptz;
alter table suscripciones add column if not exists cancel_at_period_end boolean not null default false;
alter table suscripciones add column if not exists creada_en timestamptz not null default now();
alter table suscripciones add column if not exists actualizada_en timestamptz not null default now();

-- UNA fila por suscripción de Stripe. Es la llave del upsert del
-- webhook: sin este índice, cada `customer.subscription.updated`
-- agregaría una fila nueva y el negocio terminaría con veinte
-- suscripciones que dicen cosas distintas.
create unique index if not exists suscripciones_stripe_sub_unq
  on suscripciones (stripe_subscription_id);

create index if not exists suscripciones_rancho_idx  on suscripciones (rancho_id);
create index if not exists suscripciones_cuenta_idx  on suscripciones (cuenta_id);
create index if not exists suscripciones_cliente_idx on suscripciones (stripe_customer_id);

-- Los CHECK como drop/add, igual que la 0141: ampliarlos mañana es
-- volver a correr este bloque y nada más.
--
-- La lista de planes es LA MISMA de la 0141 (ranchos.plan_lealtad,
-- solicitudes_lealtad.plan, cuentas.plan) y tiene que seguir siéndolo:
-- si acá entrara un id que allá no existe, el webhook guardaría la
-- suscripción bien y después reventaría al escribir el plan en el
-- negocio — cobrado y sin activar, el peor de los dos mundos.
alter table suscripciones drop constraint if exists suscripciones_plan_check;
alter table suscripciones add constraint suscripciones_plan_check
  check (
    plan is null
    or plan in (
      -- Ofrecidos (0141)
      'prueba', 'arranque', 'impulso', 'ilimitado',
      -- Retirados, conservados por las filas que ya existen
      'esencial', 'crece', 'pro', 'empresa',
      'gratis', 'basico', 'estandar', 'enterprise'
    )
  );

alter table suscripciones drop constraint if exists suscripciones_periodo_check;
alter table suscripciones add constraint suscripciones_periodo_check
  check (periodo in ('mensual', 'anual'));

-- Los cuatro estados, y lo que significa cada uno para el negocio:
--   activa     — paga y al día.
--   en_prueba  — Stripe dice `trialing`: todavía no cobró nada.
--   morosa     — el cobro falló o quedó incompleto. NO da derecho al
--                plan, pero tampoco se lo quita: el negocio sigue
--                como estaba hasta que una persona decida.
--   cancelada  — se terminó.
alter table suscripciones drop constraint if exists suscripciones_estado_check;
alter table suscripciones add constraint suscripciones_estado_check
  check (estado in ('activa', 'en_prueba', 'morosa', 'cancelada'));

comment on table suscripciones is
  'El espejo de lo que Stripe cobra por el modulo de Lealtad (0143). '
  'La verdad ultima siempre es Stripe: esta tabla se escribe SOLO desde '
  'el webhook con la llave de servicio, nunca desde el navegador. El '
  'camino del SINPE con comprobante (solicitudes_lealtad) sigue intacto '
  'y es independiente de esta tabla.';

comment on column suscripciones.plan is
  'Id del catalogo de src/lib/lealtad/planes.ts. null = llego un '
  'price_id que el servidor no supo mapear: la suscripcion queda '
  'REGISTRADA pero no activa nada. El mapeo price_id -> plan vive en '
  'variables de entorno (STRIPE_PRICE_<PLAN>_<MENSUAL|ANUAL>), nunca '
  'escrito a mano en el codigo.';

comment on column suscripciones.cancel_at_period_end is
  'El cliente cancelo desde el Customer Portal pero el periodo pago '
  'sigue corriendo. Hasta `periodo_fin` el negocio tiene lo que pago.';


-- ------------------------------------------------------------
-- 3. La costura con `cuentas` (0134), si está
-- ------------------------------------------------------------
do $fk0143$
begin
  if to_regclass('public.cuentas') is null then
    raise notice 'AVISO 0143: falta la tabla cuentas (0134). suscripciones.cuenta_id queda sin llave foranea.';
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'suscripciones_cuenta_fk'
       and conrelid = 'public.suscripciones'::regclass
  ) then
    alter table suscripciones
      add constraint suscripciones_cuenta_fk
      foreign key (cuenta_id) references cuentas(id) on delete cascade;
  end if;
end
$fk0143$;


-- ------------------------------------------------------------
-- 4. RLS — el dueño LEE la suya; nadie escribe desde el navegador
-- ------------------------------------------------------------
-- La política se arma en un bloque porque la parte de `cuentas` solo
-- se puede nombrar si la 0134 está corrida: una política que menciona
-- una función inexistente no se crea, y sin política la tabla queda
-- ilegible hasta para el dueño.
alter table suscripciones enable row level security;

do $rls0143$
declare
  v_por_cuenta text := '';
  v_sql        text;
begin
  if to_regclass('public.cuentas') is not null
     and exists (
       select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'gestiona_cuenta'
     ) then
    -- `gestiona_cuenta` y no `pertenece_a_cuenta` a propósito: la
    -- segunda incluye al colaborador de mostrador, y lo que se cobra
    -- no es asunto de quien sella tarjetas.
    v_por_cuenta := ' or (suscripciones.cuenta_id is not null and public.gestiona_cuenta(suscripciones.cuenta_id))';
  else
    raise notice 'AVISO 0143: sin gestiona_cuenta (0134). La suscripcion se lee solo por rancho.';
  end if;

  v_sql :=
    'create policy "El dueno ve su suscripcion" on suscripciones '
    || 'for select to authenticated using ('
    -- Por rancho se pregunta por el OWNER, no por `gestiona_rancho`:
    -- esa incluye colaboradores, y la facturación es del dueño (mismo
    -- criterio que la 0116 usó para separar las 43 acciones del panel).
    || '(suscripciones.rancho_id is not null and exists ('
    || '  select 1 from ranchos r'
    || '   where r.id = suscripciones.rancho_id'
    || '     and (r.owner_id = auth.uid() or public.is_admin())))'
    || v_por_cuenta
    || ')';

  execute 'drop policy if exists "El dueno ve su suscripcion" on suscripciones';
  execute v_sql;
end
$rls0143$;

-- Sin grants, la RLS más perfecta da "permission denied" (lección
-- 0119). SOLO select: no hay insert, update ni delete para
-- `authenticated` a propósito — la suscripción la escribe el webhook
-- con la llave de servicio y nadie más.
grant select on suscripciones to authenticated;
grant all on suscripciones to service_role;
grant all on eventos_stripe to service_role;
