
-- ============================================================
-- BOOKEA — SOCIOS COMERCIALES (plan de referidos de Lealtad)
--
-- Gente de AFUERA que coloca tarjetas de Lealtad en negocios y cobra
-- una comisión mensual por los que siguen pagando.
--
-- ── TRES COSAS QUE ESTA MIGRACIÓN NO HACE, A PROPÓSITO ───────────
--
-- 1. NO toca `perfiles.rol`. El CHECK de la 0032 sigue siendo
--    ('admin','dueno_rancho','cliente'). Un socio es una FILA acá, no
--    un rol. Si fuera un rol habría que ampliar ese CHECK — y, lo
--    grave, alguien terminaría metiendo 'socio' adentro de
--    `is_admin()`, que está referenciada 168 veces en 51 migraciones.
--    Ese atajo de una línea le entregaría permisos de admin al socio
--    en TODA la base. Como fila, `proxy.ts`, `requireAdmin()` e
--    `is_admin()` ya lo rechazan sin cambiar una sola línea.
--
-- 2. NO toca `is_admin()`. Ver arriba. Si alguien abre esta migración
--    buscando dónde agregar al socio a esa función: no hay dónde, y
--    ese es el punto.
--
-- 3. NO crea políticas de insert/update/delete para `authenticated`.
--    El «ver POR ENCIMA SIN EDITAR» que pidió el dueño se cumple EN LA
--    BASE: aunque la pantalla tuviera un botón, la base lo rechaza.
--    Escriben el cierre mensual y las server actions de /admin, con la
--    llave de servicio y cada una con su propio `requireAdmin()`.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. EL SOCIO — quien cobra
-- ------------------------------------------------------------
create table if not exists public.socios_comerciales (
  id uuid primary key default gen_random_uuid(),

  -- La cuenta con la que entra al panel. UNIQUE: una persona es UN
  -- socio. FK a auth.users y no texto libre: así el admin no puede
  -- inventar un socio sin cuenta.
  usuario_id uuid not null unique references auth.users(id) on delete cascade,

  nombre text not null check (char_length(trim(nombre)) between 2 and 120),
  telefono text check (telefono is null or char_length(telefono) <= 30),

  -- A DÓNDE se le manda la plata. Texto libre a propósito: Bookea paga
  -- a mano por SINPE o transferencia, y una tabla de métodos de pago
  -- sería inventar un producto que nadie pidió.
  cobro_metodo  text check (cobro_metodo is null or cobro_metodo in ('sinpe','transferencia')),
  cobro_detalle text check (cobro_detalle is null or char_length(cobro_detalle) <= 120),
  cobro_titular text check (cobro_titular is null or char_length(cobro_titular) <= 120),

  -- false = deja de devengar y pierde la pestaña de Clientes.
  -- ⚠️ NO le tapa Finanzas: ver la política de comisiones más abajo.
  -- Se DESACTIVA, no se borra: sus clientes y su plata son historia.
  activo boolean not null default true,

  creado_por uuid references auth.users(id) on delete set null,
  creado_en  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. EL CÓDIGO — tabla aparte, no una columna
-- ------------------------------------------------------------
-- Tres cosas que una columna no podría: darle a un socio más de un
-- código (una campaña, una ciudad), RETIRAR un código sin retirar al
-- socio, y que la atribución apunte al código EXACTO que se usó aunque
-- después se desactive.
create table if not exists public.socios_codigos (
  -- EL CÓDIGO ES LA PRIMARY KEY, y eso —no un `select` previo— es lo
  -- que impide que dos socios compartan código: dos admins creando
  -- socios en el mismo segundo pasarían los dos un `select … where
  -- codigo = ?`. Con la PK, el segundo INSERT rebota con 23505 y el
  -- servidor regenera.
  --
  -- El CHECK obliga MAYÚSCULAS: sin él, 'ana7' y 'ANA7' son dos filas
  -- distintas y el mismo código apunta a dos socios.
  codigo text primary key check (codigo ~ '^[A-Z0-9]{3,16}$'),

  socio_id uuid not null references public.socios_comerciales(id) on delete cascade,
  activo   boolean not null default true,
  nota     text check (nota is null or char_length(nota) <= 200),

  creado_por uuid references auth.users(id) on delete set null,
  creado_en  timestamptz not null default now()
);
create index if not exists socios_codigos_socio_idx on public.socios_codigos (socio_id);

-- ------------------------------------------------------------
-- 3. LA ATRIBUCIÓN — un negocio, un padrino, una vez
-- ------------------------------------------------------------
create table if not exists public.socios_negocios (
  -- `rancho_id` ES la PK. La regla «un negocio tiene UN socio» la hace
  -- cumplir la base, no un `if` que alguien puede olvidar. Sin esto,
  -- dos socios reclaman el mismo negocio y el reparto lo decide el
  -- orden de lectura.
  rancho_id uuid primary key references public.ranchos(id) on delete cascade,

  socio_id uuid not null references public.socios_comerciales(id) on delete restrict,

  -- El código EXACTO que se usó. `restrict`: un código con negocios
  -- atribuidos no se borra, solo se desactiva — borrarlo reescribiría
  -- el pasado.
  codigo text not null references public.socios_codigos(codigo) on delete restrict,

  -- La cuenta (0134) si existe. SIN FK, por la misma razón que
  -- `historial_plan_lealtad.cuenta_id`: la 0134 puede no estar corrida
  -- donde se pegue esto, y una FK a una tabla ausente aborta la
  -- migración entera.
  cuenta_id uuid,

  -- 'alta'  = lo escribió el flujo público (la persona puso el código)
  -- 'admin' = lo asignó Bookea a mano (rescate de un código mal
  --           tecleado). Se distinguen porque el segundo hay que poder
  --           auditarlo.
  origen text not null default 'alta' check (origen in ('alta','admin')),
  asignado_por uuid references auth.users(id) on delete set null,

  creado_en timestamptz not null default now()
);
create index if not exists socios_negocios_socio_idx
  on public.socios_negocios (socio_id, creado_en desc);

-- ── NADIE SE REFIERE A SÍ MISMO ────────────────────────────────────
-- Cobrar por dar de alta tu propio negocio es lo primero que alguien va
-- a intentar. Va en la BASE y no en TypeScript porque toda la escritura
-- pasa por la llave de servicio, que se salta RLS: un `if` en el
-- servidor sería la única defensa, y un `if` se olvida.
--
-- ⚠️ LO QUE ESTE TRIGGER **NO** ATRAPA, y hay que decirlo en vez de
-- fingir que es un candado: compara `owner_id` contra `usuario_id` EN
-- EL INSERT. El socio que da de alta su propio negocio con la cuenta de
-- otra persona, o que se transfiere el negocio después, pasa de largo.
-- Es defensa en profundidad, no una garantía.
create or replace function public.socios_no_autoreferido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1
      from public.ranchos r
      join public.socios_comerciales s on s.id = new.socio_id
     where r.id = new.rancho_id and r.owner_id = s.usuario_id
  ) then
    raise exception 'Un socio no puede referirse su propio negocio.';
  end if;
  return new;
end; $$;

drop trigger if exists socios_negocios_no_autoreferido on public.socios_negocios;
create trigger socios_negocios_no_autoreferido
  before insert or update on public.socios_negocios
  for each row execute function public.socios_no_autoreferido();

-- ------------------------------------------------------------
-- 4. EL LIBRO DE COMISIONES — la plata que se le debe
-- ------------------------------------------------------------
-- Es un LIBRO, no un cálculo al vuelo. La doctrina ya está escrita dos
-- veces en este repo:
--   0106: «si mañana cambiaba la tarifa, cambiaba también lo que se
--          había ganado el mes pasado. Eso no es una cuenta por cobrar,
--          es una simulación.»
--   0172: «Auditar con eso sería reconstruir la historia con el
--          catálogo de HOY … una estimación disfrazada de auditoría.»
--
-- ── LOS CUATRO CONCEPTOS, Y POR QUÉ STARTER SON DOS ────────────────
--
-- La escala que confirmó el dueño (26 ago 2026) NO es un simple tramo:
--
--     cada grupo de 3 negocios Starter ──── $6   ('starter_escalon')
--     cada Starter que sobra ────────────── $1   ('starter_suelto')
--
-- Que da: 1→$1, 2→$2, 3→$6, 4→$7, 5→$8, 6→$12. El salto de $2 a $6 al
-- llegar a 3 es intencional: es lo que premia completar el trío.
--
-- Van como DOS conceptos y no como uno con dos tarifas porque el socio
-- tiene que poder leer su liquidación y entenderla: «2 tríos = $12» y
-- «1 suelto = $1» son dos renglones distintos en su panel.
create table if not exists public.comisiones_socio (
  id uuid primary key default gen_random_uuid(),

  -- `restrict`: borrar un socio con comisiones tiene que doler.
  socio_id uuid not null references public.socios_comerciales(id) on delete restrict,

  -- El mes cerrado, SIEMPRE día 1 (hora de Costa Rica). Es la unidad de
  -- pago: al socio se le paga el mes completo, no renglón por renglón.
  mes date not null,

  concepto text not null
    check (concepto in ('starter_escalon','starter_suelto','impulso','ilimitado','ajuste')),

  -- ⚠️ `set null`, NUNCA cascade, y con el nombre congelado al lado.
  -- Es la misma línea que `cobros_modulo`: si el negocio se da de baja,
  -- la plata que entró NO desaparece del libro. Con `cascade`, borrar
  -- un negocio desde /admin/ranchos borraría comisiones YA PAGADAS y el
  -- panel del socio diría que nunca ganó nada.
  --
  -- null también en toda fila de Starter: el trío y los sueltos son un
  -- hecho DEL MES del socio, no de un negocio puntual.
  rancho_id uuid references public.ranchos(id) on delete set null,
  negocio_nombre text,

  -- El plan que se COBRÓ, congelado. Sin CHECK contra el catálogo a
  -- propósito: si mañana se retira un paquete, estas filas tienen que
  -- seguir diciendo lo que decían.
  plan text,

  -- CÓMO SALIÓ EL NÚMERO. Sin esto, seis meses después nadie puede
  -- explicarle el monto al socio.
  unidades   integer not null default 1 check (unidades  >= 0),
  escalones  integer not null default 0 check (escalones >= 0),
  tarifa_usd numeric(10,2) not null check (tarifa_usd >= 0),
  monto_usd  numeric(10,2) not null,

  estado text not null default 'pendiente'
    check (estado in ('pendiente','pagada','anulada')),

  devengado_en timestamptz not null default now(),
  pagado_en    timestamptz,
  pagado_por   uuid references auth.users(id) on delete set null,

  -- El PAGO puede salir en colones aunque la comisión se devengue en
  -- dólares. Se guarda como salió; el tipo de cambio es INFORMATIVO y
  -- la pantalla NUNCA suma las dos monedas.
  pago_referencia  text,
  pago_monto       numeric(12,2) check (pago_monto is null or pago_monto >= 0),
  pago_moneda      text check (pago_moneda is null or pago_moneda in ('CRC','USD')),
  pago_tipo_cambio numeric(10,4) check (pago_tipo_cambio is null or pago_tipo_cambio > 0),

  anulada_motivo text check (anulada_motivo is null or char_length(anulada_motivo) between 1 and 300),
  notas text check (notas is null or char_length(notas) <= 300),

  -- Solo un 'ajuste' puede ser negativo (devolver una comisión
  -- devengada sobre un cobro que después se anuló). Todo lo demás es
  -- plata que se suma.
  constraint comisiones_socio_signo_check
    check (monto_usd >= 0 or concepto = 'ajuste'),
  constraint comisiones_socio_anulada_check
    check (estado <> 'anulada' or anulada_motivo is not null),
  -- Los dos conceptos de Starter son del MES del socio, no de un
  -- negocio: llevar un rancho_id ahí haría creer que ese trío salió de
  -- ese negocio en particular.
  constraint comisiones_socio_starter_sin_negocio_check
    check (concepto not in ('starter_escalon','starter_suelto') or rancho_id is null),
  constraint comisiones_socio_mes_dia1_check
    check (date_trunc('month', mes)::date = mes)
);

-- ── IDEMPOTENCIA DEL CIERRE ────────────────────────────────────────
-- Correr el cierre dos veces (reintento del cron, dedo del admin) no
-- puede costar plata.
--
-- ⚠️ EL ÍNDICE DEL NEGOCIO **NO LLEVA socio_id**, y es deliberado. Con
-- socio_id adentro, reasignar un rancho de Ana a Beto y volver a correr
-- el cierre de agosto insertaría la fila de Beto mientras la de Ana
-- sigue viva: Bookea pagaría dos veces por el mismo cliente. La unidad
-- de unicidad es EL NEGOCIO, no el par socio-negocio.
create unique index if not exists comisiones_socio_negocio_unq
  on public.comisiones_socio (rancho_id, mes, concepto)
  where rancho_id is not null and estado <> 'anulada';

-- Los de Starter sí son por socio: son una propiedad de SU mes. Una
-- fila de tríos y una de sueltos por socio y mes, no más.
create unique index if not exists comisiones_socio_starter_unq
  on public.comisiones_socio (socio_id, mes, concepto)
  where concepto in ('starter_escalon','starter_suelto') and estado <> 'anulada';

create index if not exists comisiones_socio_mes_idx  on public.comisiones_socio (socio_id, mes desc);
create index if not exists comisiones_socio_pago_idx on public.comisiones_socio (estado, mes);

-- ── El cobro de origen, para poder revertir ────────────────────────
-- `cobros_modulo` tiene anulado_en/anulado_motivo (0172) justamente
-- para corregir un monto mal tecleado sin borrar. Sin guardar de qué
-- cobro salió cada comisión, anular un cobro deja viva —y pagable— la
-- comisión que salió de él. La FK va dentro de un guard porque la 0172
-- podría no estar corrida donde se pegue esto.
alter table public.comisiones_socio add column if not exists cobro_id uuid;

do $cobro0213$
begin
  if to_regclass('public.cobros_modulo') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'comisiones_socio_cobro_fk'
     ) then
    alter table public.comisiones_socio
      add constraint comisiones_socio_cobro_fk
      foreign key (cobro_id) references public.cobros_modulo(id) on delete set null;
  end if;
end
$cobro0213$;

-- ------------------------------------------------------------
-- 5. EL CÓDIGO EN LA SOLICITUD
-- ------------------------------------------------------------
-- El rancho todavía no existe cuando alguien pide un paquete pago: el
-- código viaja en la solicitud y se resuelve al aprobarla.
alter table public.solicitudes_lealtad
  add column if not exists codigo_referido text
  check (codigo_referido is null or char_length(codigo_referido) <= 16);

-- ============================================================
-- RLS
-- ============================================================
alter table public.socios_comerciales enable row level security;
alter table public.socios_codigos     enable row level security;
alter table public.socios_negocios    enable row level security;
alter table public.comisiones_socio   enable row level security;

-- ¿Quién es el socio que está mirando? SECURITY DEFINER por la misma
-- lección que `es_colaborador_rancho` (0116): la usan las políticas de
-- OTRAS tablas, y leer socios_comerciales bajo su propia RLS hace que
-- Postgres corte por recursión.
--
-- Devuelve NULL si `activo = false`: desactivar un socio le apaga los
-- datos vivos EN LA BASE, no solo en la pantalla. Y `socio_id = NULL`
-- es NULL, nunca TRUE: falla cerrada.
create or replace function public.socio_actual()
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.socios_comerciales s
   where s.usuario_id = auth.uid() and s.activo
$$;
revoke all on function public.socio_actual() from public, anon;
grant execute on function public.socio_actual() to authenticated;

drop policy if exists "El socio se ve a si mismo" on public.socios_comerciales;
create policy "El socio se ve a si mismo" on public.socios_comerciales
  for select to authenticated using (public.is_admin() or usuario_id = auth.uid());

drop policy if exists "El socio ve sus codigos" on public.socios_codigos;
create policy "El socio ve sus codigos" on public.socios_codigos
  for select to authenticated using (public.is_admin() or socio_id = public.socio_actual());

drop policy if exists "El socio ve sus negocios" on public.socios_negocios;
create policy "El socio ve sus negocios" on public.socios_negocios
  for select to authenticated using (public.is_admin() or socio_id = public.socio_actual());

-- ⚠️ ESTA POLÍTICA **NO** USA socio_actual(), Y ES A PROPÓSITO.
-- `socio_actual()` exige `activo`. Cortarle el panel a un socio dado de
-- baja está bien; taparle lo que TODAVÍA SE LE DEBE es un reclamo
-- garantizado — la persona que acabás de desactivar es justamente la
-- que va a preguntar cuánto le debés. Los datos VIVOS del negocio se le
-- cortan; su propio libro de plata, no.
drop policy if exists "El socio ve sus comisiones" on public.comisiones_socio;
create policy "El socio ve sus comisiones" on public.comisiones_socio
  for select to authenticated
  using (
    public.is_admin()
    or socio_id in (
      select s.id from public.socios_comerciales s where s.usuario_id = auth.uid()
    )
  );

comment on table public.socios_comerciales is
  'Socios comerciales: gente de afuera que coloca Lealtad en negocios y cobra comision mensual. NO es un perfiles.rol — ver la cabecera de la 0213.';
comment on table public.comisiones_socio is
  'El LIBRO de comisiones. Cada fila congela tarifa, unidades y plan: recalcular al vuelo haria que cambiara el pasado.';
