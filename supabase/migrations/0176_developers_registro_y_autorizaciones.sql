-- ============================================================
-- BOOKEA — Developers de Lealtad: las DOS puertas (0176)
--
-- Una API de lealtad expone datos de gente que NO es usuaria de
-- Bookea: le dio su nombre y su teléfono a la barbería de la esquina,
-- no a nosotros ni a un integrador. En Costa Rica eso cae bajo la Ley
-- 8968, y el negocio es el RESPONSABLE del tratamiento; Bookea es el
-- ENCARGADO. De ahí sale la forma de estas tablas.
--
-- ------------------------------------------------------------
-- DECISIONES QUE ESTA MIGRACIÓN FIJA (y por qué)
--
-- 1. DOS FIRMAS, UN SOLO FLUJO, CERO OAuth.
--    `desarrolladores` = a quién ADMITE Bookea (identidad, cédula,
--    acuerdo firmado). `autorizaciones_api` = a quién DEJA ENTRAR cada
--    negocio, desde la sesión de su dueño. Si Bookea aprobara sola y
--    con eso se abrieran 300 barberías, Bookea sería la parte que cede
--    datos ajenos sin autorización del responsable — indefendible.
--    No hay `redirect_uri` ni código de intercambio: la autorización
--    NACE en la sesión del dueño, así que no hace falta el baile.
--
-- 2. LA LISTA BLANCA DE SCOPES VIVE EN UN `check` DE LA BASE.
--    Son DOS: saldo y acreditar. Un scope que el código no implementa
--    la base lo RECHAZA. `canjear`, `revertir` y `auditoria` entran en
--    su propia migración, cada uno cuando su reparación esté probada. Y
--    un scope de identidad (nombre, teléfono, correo) no cabe acá ni
--    cabrá: por eso el consentimiento apurado del dueño duele poco — lo
--    máximo que concede son sellos y saldos seudónimos.
--
--    ERAN TRES. `catalogo` («Ver el programa y sus recompensas») murió
--    con los endpoints que servía, `GET /programa` y `GET /recompensas`,
--    cuando la API se acotó a su único caso de uso: que la caja le sume
--    un sello al cliente y el pase del teléfono se actualice solo. Las
--    reglas del programa y el catálogo de premios no hacen falta para
--    eso. Esta migración TODAVÍA NO ESTÁ PEGADA en producción, así que
--    se reescribió en vez de parcharse: no hay ninguna fila con
--    'catalogo' en ninguna parte.
--
-- 3. AMPLIAR SCOPES POR `UPDATE` ES IMPOSIBLE.
--    El grant de UPDATE es POR COLUMNA y no incluye `scopes`. Para
--    cambiarlos hay que revocar y volver a autorizar — o sea, el dueño
--    vuelve a decir que sí, con fecha y usuario.
--
-- 4. LA AUTORIZACIÓN SE ATA A UNA TARJETA, NO AL NEGOCIO ENTERO.
--    Desde la 0134 un negocio puede tener varias tarjetas. Atar la
--    llave a `programa_id` hace que la llave del club de cortes no
--    toque la gift card, y le da un objetivo concreto a la
--    precondición del tope diario.
--
-- 5. EL `ref` OPACO NO ES DECORACIÓN.
--    `miembro_id` es el primer parámetro de `acreditar_lealtad` y el
--    mismo uuid que anda por el panel. Devolverlo sería regalar una
--    llave maestra seudónima. En su lugar sale `HMAC(miembro_id,
--    pepper_de_la_autorización)`: la base robada de un integrador no
--    sirve contra otra llave, ni contra el panel, ni contra una llave
--    futura. Y rotando el pepper («Romper la correlación») todo lo que
--    el atacante se llevó queda permanentemente inservible.
--
-- 6. EL PEPPER NO LO GENERA POSTGRES.
--    `gen_random_bytes` es de pgcrypto y no está garantizado en el
--    search_path de este proyecto. Lo genera Node con
--    `crypto.randomBytes` y entra por parámetro. Una dependencia menos
--    que pueda faltar el día del pegado.
--
-- 7. `revoke select (pepper_ref)` NO ALCANZA en Postgres: revocar una
--    columna cuando existe el grant de tabla no quita nada. Por eso
--    acá NO hay grant de tabla — hay un grant de SELECT por columnas,
--    y `pepper_ref` sencillamente no está en la lista. El pepper no
--    llega jamás a un navegador.
--
-- TODO aditivo: tablas nuevas, ninguna fila existente cambia.
-- ============================================================

-- ------------------------------------------------------------
-- 1. desarrolladores — PUERTA 1: a quién admite Bookea
-- ------------------------------------------------------------
create table if not exists desarrolladores (
  id uuid primary key default gen_random_uuid(),

  -- Identidad real y verificable. La cédula (jurídica o física) es lo
  -- que convierte "Fulano POS" en alguien a quien se le puede reclamar.
  razon_social text not null
    check (char_length(trim(razon_social)) between 2 and 120),
  cedula text not null
    check (char_length(trim(cedula)) between 5 and 30),

  -- DOS correos, y el de seguridad es OBLIGATORIO y aparte: el día del
  -- incidente el correo técnico puede estar justamente en manos del
  -- atacante, o simplemente sin leer por vacaciones.
  correo_tecnico text not null
    check (char_length(correo_tecnico) between 5 and 160 and correo_tecnico like '%@%'),
  correo_seguridad text not null
    check (char_length(correo_seguridad) between 5 and 160 and correo_seguridad like '%@%'),

  sitio_web text check (sitio_web is null or sitio_web ~ '^https://'),
  sistema text not null check (sistema in ('pos', 'totem', 'crm', 'ecommerce', 'otro')),

  -- EL INSUMO LEGAL. Sin esto no hay cómo contestarle a la PRODHAB
  -- para qué se cedieron datos ni qué se guarda del otro lado.
  uso_declarado text not null
    check (char_length(trim(uso_declarado)) between 20 and 1000),
  datos_que_almacena text not null
    check (char_length(trim(datos_que_almacena)) between 10 and 1000),

  -- Qué pide, y por qué pide cada cosa. La justificación es un jsonb
  -- {scope: texto} para poder leerla scope por scope en la cola.
  scopes_solicitados text[] not null default '{}'::text[]
    check (scopes_solicitados <@ array['saldo', 'acreditar']::text[]),
  justificacion jsonb not null default '{}'::jsonb,

  -- Opcional: sube la nota en la cola y activa la lista blanca de IPs.
  ips_permitidas inet[],

  -- Control real del dominio, por /.well-known/bookea-developer.txt.
  dominio_verificado_en timestamptz,

  -- El Acuerdo de Tratamiento de Datos, con su versión y su hash: es
  -- la prueba documental de QUÉ texto aceptó, no de que aceptó algo.
  acuerdo_version text not null check (char_length(acuerdo_version) <= 20),
  acuerdo_hash text not null check (acuerdo_hash ~ '^[0-9a-f]{64}$'),
  acuerdo_aceptado_en timestamptz not null default now(),

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'rechazado', 'suspendido')),
  motivo_rechazo text check (motivo_rechazo is null or char_length(motivo_rechazo) <= 300),

  solicitante_id uuid not null references auth.users(id) on delete cascade,
  atendido_por uuid references auth.users(id) on delete set null,
  atendido_en timestamptz,

  created_at timestamptz not null default now()
);

comment on table desarrolladores is
  'PUERTA 1 (0176): identidad admitida por Bookea UNA vez. Admitir acá '
  'no abre ningún dato — eso lo hace la puerta 2 (autorizaciones_api), '
  'y la decide el negocio.';

create index if not exists desarrolladores_estado_idx
  on desarrolladores (estado, created_at desc);

-- Una pendiente por solicitante: el doble clic no llena la cola ni la
-- casilla de correo de los admins (molde de solicitudes_lealtad, 0126).
create unique index if not exists desarrolladores_pendiente_unq
  on desarrolladores (solicitante_id)
  where estado = 'pendiente';

alter table desarrolladores enable row level security;

drop policy if exists "Ver la propia solicitud de developer" on desarrolladores;
create policy "Ver la propia solicitud de developer" on desarrolladores
  for select to authenticated
  using (solicitante_id = auth.uid() or is_admin());

-- Se pide a nombre propio y SIEMPRE naciendo pendiente: el estado lo
-- mueve solo Bookea.
drop policy if exists "Pedir acceso de developer" on desarrolladores;
create policy "Pedir acceso de developer" on desarrolladores
  for insert to authenticated
  with check (solicitante_id = auth.uid() and estado = 'pendiente');

drop policy if exists "Solo Bookea atiende developers" on desarrolladores;
create policy "Solo Bookea atiende developers" on desarrolladores
  for update to authenticated
  using (is_admin()) with check (is_admin());

-- Sin grants la RLS más perfecta da "permission denied" (lección 0119).
-- El UPDATE es SOLO de las columnas de atención: ni un admin reescribe
-- por esta vía qué declaró el desarrollador ni qué acuerdo aceptó —
-- eso ES el registro, y es la prueba ante la PRODHAB.
grant select, insert on desarrolladores to authenticated;
grant update (estado, motivo_rechazo, atendido_por, atendido_en, dominio_verificado_en)
  on desarrolladores to authenticated;
grant all on desarrolladores to service_role;

-- El desarrollador APROBADO tiene que poder aparecer en la lista que
-- ve el dueño de un negocio para autorizarlo. Se expone por VISTA (con
-- security_invoker) y no aflojando la política: así el dueño ve el
-- nombre y el sistema, y no el correo de seguridad ni la cédula de un
-- tercero.
create or replace view desarrolladores_admitidos
with (security_invoker = false) as
  select id, razon_social, sistema, sitio_web,
         dominio_verificado_en is not null as dominio_verificado,
         scopes_solicitados, created_at
    from desarrolladores
   where estado = 'aprobado';

comment on view desarrolladores_admitidos is
  'Lo MÍNIMO de un developer aprobado para que el dueño de un negocio '
  'pueda elegirlo. Sin cédula, sin correos, sin lo declarado.';

revoke all on desarrolladores_admitidos from public, anon;
grant select on desarrolladores_admitidos to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. autorizaciones_api — PUERTA 2: a quién deja entrar el negocio
-- ------------------------------------------------------------
create table if not exists autorizaciones_api (
  id uuid primary key default gen_random_uuid(),
  desarrollador_id uuid not null references desarrolladores(id) on delete cascade,
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- Una llave abre UNA tarjeta, no el negocio entero.
  programa_id uuid not null references programa_lealtad(id) on delete cascade,

  entorno text not null default 'live' check (entorno in ('live', 'test')),

  -- DOS scopes, no tres: ver la decisión 2 del encabezado. Y al menos
  -- uno, porque una autorización sin permisos es una puerta abierta que
  -- no sirve para nada y que alguien va a creer que sí.
  scopes text[] not null
    check (
      scopes <@ array['saldo', 'acreditar']::text[]
      and coalesce(array_length(scopes, 1), 0) >= 1
    ),

  -- 32 bytes de crypto.randomBytes. NO sale por ningún grant.
  pepper_ref bytea not null check (octet_length(pepper_ref) = 32),

  estado text not null default 'activa'
    check (estado in ('activa', 'revocada', 'suspendida')),

  autorizada_por uuid not null references auth.users(id) on delete restrict,
  autorizada_en timestamptz not null default now(),
  revocada_por uuid references auth.users(id) on delete set null,
  revocada_en timestamptz,
  motivo_revocacion text check (motivo_revocacion is null or char_length(motivo_revocacion) <= 300),

  contrato_version text not null check (char_length(contrato_version) <= 20),

  -- Las dos letras del nombre ("M.R.") sirven para no sellar la
  -- tarjeta equivocada, o sea que protegen al cliente. Aun así es
  -- decisión del dueño, y se puede apagar.
  mostrar_iniciales boolean not null default true,

  limite_min integer not null default 60 check (limite_min between 1 and 600),
  limite_hora integer not null default 1000 check (limite_hora between 1 and 20000),
  vence_en timestamptz,

  created_at timestamptz not null default now()
);

comment on table autorizaciones_api is
  'PUERTA 2 (0176): el negocio deja entrar a un developer YA admitido, '
  'desde la sesión de su dueño, a UNA de sus tarjetas y con scopes '
  'explícitos. Se revoca de un botón y el efecto es en la petición '
  'siguiente (no hay caché de credenciales, a propósito).';

comment on column autorizaciones_api.pepper_ref is
  'La sal del seudónimo `ref` de esta autorización. Rotarla es "Romper '
  'la correlación": deja inservibles TODOS los refs que un atacante se '
  'haya llevado, sin tocar un solo dato del cliente.';

create index if not exists autorizaciones_api_rancho_idx
  on autorizaciones_api (rancho_id, estado);
create index if not exists autorizaciones_api_dev_idx
  on autorizaciones_api (desarrollador_id, estado);

-- UNA activa por (developer, negocio, entorno). Autorizar dos veces no
-- deja dos puertas abiertas de las que después hay que acordarse.
create unique index if not exists autorizaciones_api_activa_unq
  on autorizaciones_api (desarrollador_id, rancho_id, entorno)
  where estado = 'activa';

alter table autorizaciones_api enable row level security;

drop policy if exists "El negocio ve sus autorizaciones" on autorizaciones_api;
create policy "El negocio ve sus autorizaciones" on autorizaciones_api
  for select to authenticated
  using (gestiona_rancho(rancho_id) or is_admin());

-- Revocar (y solo revocar) desde el panel del dueño.
drop policy if exists "El negocio revoca su autorización" on autorizaciones_api;
create policy "El negocio revoca su autorización" on autorizaciones_api
  for update to authenticated
  using (gestiona_rancho(rancho_id) or is_admin())
  with check (gestiona_rancho(rancho_id) or is_admin());

-- OJO CON LOS GRANTS: acá NO hay `grant select` de tabla. Es una lista
-- de columnas, y `pepper_ref` no está en ella. Revocar la columna
-- después de un grant de tabla no habría quitado nada (así funciona
-- Postgres), y el pepper es justo lo que no puede llegar al navegador.
grant select (
  id, desarrollador_id, rancho_id, programa_id, entorno, scopes, estado,
  autorizada_por, autorizada_en, revocada_por, revocada_en, motivo_revocacion,
  contrato_version, mostrar_iniciales, limite_min, limite_hora, vence_en, created_at
) on autorizaciones_api to authenticated;

-- Ampliar scopes por UPDATE es imposible: `scopes` no está acá.
grant update (estado, revocada_por, revocada_en, motivo_revocacion)
  on autorizaciones_api to authenticated;
grant all on autorizaciones_api to service_role;

-- El INSERT no se le da a `authenticated` a propósito: la fila lleva el
-- `pepper_ref`, y una fila insertada desde el navegador significaría un
-- navegador que conoce el pepper. Autorizar entra por
-- `api_lealtad_autorizar` (service_role), que revalida con
-- `gestiona_rancho_como`.

-- ------------------------------------------------------------
-- 3. refs_api_lealtad — el índice del seudónimo
--
-- `ref` = HMAC(miembro_id, pepper_ref) truncado. Es determinístico, así
-- que esta tabla no guarda un secreto nuevo: es el índice que permite
-- ir de vuelta (ref → miembro) sin recorrer el programa entero.
--
-- Se llena sola, la primera vez que una tarjeta se consulta.
-- ------------------------------------------------------------
create table if not exists refs_api_lealtad (
  autorizacion_id uuid not null references autorizaciones_api(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  ref text not null check (ref ~ '^mb_[0-9A-HJKMNP-TV-Z]{16}$'),
  created_at timestamptz not null default now(),
  primary key (autorizacion_id, miembro_id)
);

create unique index if not exists refs_api_lealtad_ref_unq
  on refs_api_lealtad (autorizacion_id, ref);

comment on table refs_api_lealtad is
  'El seudónimo por autorización (0176). NO es dato personal por sí '
  'solo, pero SÍ es reidentificable con la llave que vive acá — por eso '
  'la tabla es de service_role y nada más.';

alter table refs_api_lealtad enable row level security;
revoke all privileges on table refs_api_lealtad from public, anon, authenticated;
grant all on table refs_api_lealtad to service_role;

-- ------------------------------------------------------------
-- 4. RPCs de autorización (solo service_role)
-- ------------------------------------------------------------

/**
 * Autorizar a un developer en una tarjeta.
 *
 * Revalida TODO acá adentro aunque el server action ya lo haya hecho:
 * que el actor gestione el negocio, que el developer esté aprobado, que
 * la tarjeta sea de ese negocio, y —la precondición dura— que el
 * programa tenga `max_diario_cliente` configurado si se pide
 * `acreditar`. Sin ese tope, una llave filtrada imprime premios.
 */
create or replace function public.api_lealtad_autorizar(
  p_actor uuid,
  p_desarrollador_id uuid,
  p_rancho_id uuid,
  p_programa_id uuid,
  p_scopes text[],
  p_pepper bytea,
  p_entorno text,
  p_contrato_version text,
  p_mostrar_iniciales boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tope integer;
  v_rancho uuid;
  v_scopes text[];
begin
  if not public.gestiona_rancho_como(p_actor, p_rancho_id) then
    raise exception 'No administrás ese negocio.' using errcode = '42501';
  end if;

  -- ------------------------------------------------------------
  -- SE FILTRA LO QUE YA NO EXISTE, NO SE REVIENTA.
  --
  -- `catalogo` fue un scope de verdad hasta que se borraron los
  -- endpoints que servía. Alguna pantalla vieja puede seguir
  -- mandándolo en su estado inicial, y reventar ahí dejaría al dueño
  -- sin poder autorizar a nadie por un permiso que de todos modos no
  -- concede nada.
  --
  -- Filtrar solo es seguro porque va en LA DIRECCIÓN DE MENOS
  -- PERMISO: lo que no está en la lista blanca se descarta, nunca se
  -- concede. Si de filtrar queda vacío, el `check` de la tabla rebota
  -- el insert y el dueño ve un error en vez de una puerta abierta que
  -- no abre nada.
  -- ------------------------------------------------------------
  select coalesce(array_agg(s), '{}'::text[]) into v_scopes
    from unnest(coalesce(p_scopes, '{}'::text[])) as s
   where s in ('saldo', 'acreditar');

  if not exists (
    select 1 from desarrolladores d
     where d.id = p_desarrollador_id and d.estado = 'aprobado'
  ) then
    raise exception 'Ese desarrollador no está aprobado.' using errcode = '22023';
  end if;

  select p.rancho_id, p.max_diario_cliente into v_rancho, v_tope
    from programa_lealtad p where p.id = p_programa_id;

  if v_rancho is null or v_rancho <> p_rancho_id then
    raise exception 'Esa tarjeta no es de ese negocio.' using errcode = '22023';
  end if;

  -- La precondición del diseño, verificada donde no se puede saltar.
  if 'acreditar' = any(v_scopes) and v_tope is null then
    raise exception
      'Configurá el tope diario por cliente antes de dejar que alguien acredite por API.'
      using errcode = '22023';
  end if;

  insert into autorizaciones_api
    (desarrollador_id, rancho_id, programa_id, entorno, scopes, pepper_ref,
     autorizada_por, contrato_version, mostrar_iniciales)
  values
    (p_desarrollador_id, p_rancho_id, p_programa_id, coalesce(p_entorno, 'live'),
     v_scopes, p_pepper, p_actor, p_contrato_version, coalesce(p_mostrar_iniciales, true))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.api_lealtad_autorizar(
  uuid, uuid, uuid, uuid, text[], bytea, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.api_lealtad_autorizar(
  uuid, uuid, uuid, uuid, text[], bytea, text, text, boolean) to service_role;

-- `api_lealtad_revocar_autorizacion` NO vive acá: apaga también las
-- llaves, y la tabla de llaves nace en la 0177. Está al final de esa
-- migración, donde las dos tablas ya existen.

/**
 * «Romper la correlación»: pepper nuevo, refs viejos a la basura.
 *
 * Después de esto, la base de refs que un atacante se haya llevado del
 * integrador no vuelve a apuntar a nadie — ni con esta llave ni con
 * ninguna futura. No toca un solo dato del cliente.
 */
create or replace function public.api_lealtad_romper_correlacion(
  p_actor uuid,
  p_autorizacion_id uuid,
  p_pepper bytea
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho uuid;
begin
  select rancho_id into v_rancho from autorizaciones_api where id = p_autorizacion_id;
  if v_rancho is null then return false; end if;
  if p_actor is not null and not public.gestiona_rancho_como(p_actor, v_rancho) then
    raise exception 'No administrás ese negocio.' using errcode = '42501';
  end if;

  delete from refs_api_lealtad where autorizacion_id = p_autorizacion_id;
  update autorizaciones_api set pepper_ref = p_pepper where id = p_autorizacion_id;
  return true;
end;
$$;

revoke all on function public.api_lealtad_romper_correlacion(uuid, uuid, bytea)
  from public, anon, authenticated;
grant execute on function public.api_lealtad_romper_correlacion(uuid, uuid, bytea)
  to service_role;
