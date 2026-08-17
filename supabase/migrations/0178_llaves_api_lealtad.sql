-- ============================================================
-- BOOKEA — Las llaves de la API de Lealtad (0178)
--
-- Formato de la llave, tal como la ve el integrador UNA sola vez:
--
--   blk_live_7f3kq9x2m4dp.k3Jd9_xQ2pLmN8vRtY4wZbC6hF1sA5gE0nU7iO
--            └── kid (12) ──┘ └─── 32 bytes randomBytes b64url ───┘
--
-- ------------------------------------------------------------
-- DECISIONES QUE ESTA MIGRACIÓN FIJA (y por qué)
--
-- 1. LA LLAVE SE GUARDA HASHEADA, COMO UNA CONTRASEÑA.
--    `HMAC-SHA256(secreto, LEALTAD_API_PEPPER)` en hex, con el mismo
--    `check (~'^[0-9a-f]{64}$')` que la 0113. SHA-256 y no un KDF
--    lento a propósito: son 256 bits de `crypto.randomBytes`, no hay
--    diccionario que probar, y un argon2 cobraría ~100 ms en CADA
--    cobro en caja. El pepper en variable de entorno hace que un
--    volcado de esta tabla no permita ni siquiera verificar candidatos.
--    Si `LEALTAD_API_PEPPER` no está configurada, la API entera
--    devuelve 503 — falla CERRADO, como `cron-auth.ts`.
--
-- 2. EL `kid` VA EN CLARO Y NO ES UN SECRETO. Sirve para una búsqueda
--    por índice único y UNA sola comparación del hash. Sin él habría
--    que traer todas las llaves y comparar en bucle.
--
-- 3. NADIE LEE ESTA TABLA DESDE UN NAVEGADOR, NI EL DUEÑO.
--    `revoke all from public, anon, authenticated`. El panel lee la
--    VISTA `llaves_api_lealtad_visibles`, que expone kid, sufijo,
--    estado y fechas — nunca el hash. Efecto buscado: un `select("*")`
--    desde el cliente falla RUIDOSAMENTE en vez de devolver el hash.
--    Este repo ya filtró SINPE y cuenta bancaria dos veces por un
--    `select("*")` (src/lib/ranchos-publicos.ts:36-52).
--
-- 4. TODA LLAVE CUELGA DE UNA AUTORIZACIÓN (`on delete cascade`). No
--    existe llave global de developer: si no hay negocio que haya
--    dicho que sí, no hay llave.
--
-- 5. MÁXIMO DOS VIVAS POR AUTORIZACIÓN (trigger). La rotación deja la
--    vieja `en_gracia` 24 h y después se apaga sola. Tres llaves vivas
--    es alguien que perdió la cuenta de dónde están.
--
-- 6. NO HAY CACHÉ DE CREDENCIALES, A PROPÓSITO. Cuesta una consulta
--    indexada por llamada, que con el volumen de un POS tico es ruido.
--    A cambio se borra la peor frase de un incidente: «la revocación
--    tarda hasta 5 minutos».
--
-- 7. LA COMPARACIÓN DEL HASH SE HACE EN SQL, NO EN JS.
--    Un `=` de Postgres corta en el primer byte distinto. No importa:
--    lo que se compara es un HMAC, y para aprovechar una fuga de
--    tiempo habría que fabricar un SECRETO cuyo HMAC empiece con los
--    bytes correctos — o sea, invertir HMAC-SHA256. El ataque de
--    oráculo por tiempo aplica cuando el atacante controla el valor
--    comparado (el `auth_token` de Wallet, servicio.ts:33); acá no lo
--    controla. A cambio se gana un único round trip que autentica,
--    valida estado/vigencia y toma el rate limit de una sola vez.
-- ============================================================

create table if not exists llaves_api_lealtad (
  id uuid primary key default gen_random_uuid(),
  autorizacion_id uuid not null references autorizaciones_api(id) on delete cascade,
  -- Denormalizado a propósito: el camino caliente (cada cobro en caja)
  -- no debería pagar un join para saber de qué negocio es la llave.
  rancho_id uuid not null references ranchos(id) on delete cascade,

  kid text not null unique check (kid ~ '^[a-z0-9]{12}$'),
  secreto_hash text not null check (secreto_hash ~ '^[0-9a-f]{64}$'),
  -- Los últimos 4 del secreto, para que el dueño reconozca CUÁL llave
  -- está revocando. Cuatro caracteres de 43 no ayudan a adivinar nada.
  sufijo_visible text not null check (sufijo_visible ~ '^[A-Za-z0-9_-]{4}$'),

  entorno text not null default 'live' check (entorno in ('live', 'test')),
  etiqueta text check (etiqueta is null or char_length(etiqueta) <= 60),

  estado text not null default 'activa'
    check (estado in ('activa', 'en_gracia', 'revocada')),

  -- Vencimiento OBLIGATORIO. Una llave eterna es una llave que nadie
  -- vuelve a mirar.
  expira_en timestamptz not null,

  ultima_usada_en timestamptz,
  ultima_ip_hmac text check (ultima_ip_hmac is null or ultima_ip_hmac ~ '^[0-9a-f]{64}$'),

  creada_por uuid references auth.users(id) on delete set null,
  revocada_en timestamptz,
  revocada_por uuid references auth.users(id) on delete set null,
  motivo_revocacion text check (motivo_revocacion is null or char_length(motivo_revocacion) <= 300),

  created_at timestamptz not null default now()
);

comment on table llaves_api_lealtad is
  'Las llaves de la API de Lealtad (0178). El secreto NO está acá: solo '
  'su HMAC con el pepper del servidor. Tabla de service_role — el panel '
  'lee la vista llaves_api_lealtad_visibles.';

create index if not exists llaves_api_lealtad_autorizacion_idx
  on llaves_api_lealtad (autorizacion_id, estado);
create index if not exists llaves_api_lealtad_rancho_idx
  on llaves_api_lealtad (rancho_id, estado);

alter table llaves_api_lealtad enable row level security;
revoke all privileges on table llaves_api_lealtad from public, anon, authenticated;
grant all on table llaves_api_lealtad to service_role;

-- La ventana por la que el dueño mira sus llaves. `security_invoker`
-- para que la RLS de `autorizaciones_api` decida quién ve qué: la vista
-- no inventa permisos, los hereda.
create or replace view llaves_api_lealtad_visibles
with (security_invoker = true) as
  select l.id, l.autorizacion_id, l.rancho_id, l.kid, l.sufijo_visible,
         l.entorno, l.etiqueta, l.estado, l.expira_en, l.ultima_usada_en,
         l.revocada_en, l.created_at
    from llaves_api_lealtad l
   where exists (
     select 1 from autorizaciones_api a
      where a.id = l.autorizacion_id
        and (gestiona_rancho(a.rancho_id) or is_admin())
   );

comment on view llaves_api_lealtad_visibles is
  'Lo que el dueño puede ver de sus llaves: cuál es, cómo termina, en '
  'qué estado está y cuándo se usó. NUNCA el hash.';

revoke all on llaves_api_lealtad_visibles from public, anon;
grant select on llaves_api_lealtad_visibles to authenticated, service_role;

-- ------------------------------------------------------------
-- Tope de llaves vivas por autorización
-- ------------------------------------------------------------
create or replace function public.llaves_api_tope_vivas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vivas integer;
begin
  select count(*) into v_vivas
    from llaves_api_lealtad
   where autorizacion_id = new.autorizacion_id
     and estado in ('activa', 'en_gracia');
  if v_vivas >= 2 then
    raise exception 'Esta autorización ya tiene dos llaves vivas: revocá una antes de emitir otra.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists llaves_api_tope_vivas_trg on llaves_api_lealtad;
create trigger llaves_api_tope_vivas_trg
  before insert on llaves_api_lealtad
  for each row execute function public.llaves_api_tope_vivas();

-- ------------------------------------------------------------
-- RPC: emitir
-- ------------------------------------------------------------
create or replace function public.api_lealtad_emitir_llave(
  p_actor uuid,
  p_autorizacion_id uuid,
  p_kid text,
  p_secreto_hash text,
  p_sufijo text,
  p_etiqueta text,
  p_meses integer
)
returns table (id uuid, expira_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aut record;
  v_meses integer;
  v_id uuid;
  v_expira timestamptz;
begin
  select a.id, a.rancho_id, a.entorno, a.estado
    into v_aut
    from autorizaciones_api a where a.id = p_autorizacion_id;

  if v_aut.id is null then
    raise exception 'Esa autorización no existe.' using errcode = '22023';
  end if;
  if v_aut.estado <> 'activa' then
    raise exception 'Esa autorización no está activa.' using errcode = '22023';
  end if;
  if not public.gestiona_rancho_como(p_actor, v_aut.rancho_id) then
    raise exception 'No administrás ese negocio.' using errcode = '42501';
  end if;

  -- Default 12 meses, techo 24. Una llave a 5 años es una llave que
  -- nadie vuelve a revisar.
  v_meses := least(greatest(coalesce(p_meses, 12), 1), 24);

  -- `insert … returning … into` y NO `return query insert …`: plpgsql
  -- no acepta una sentencia que escribe dentro de RETURN QUERY, y de
  -- paso las variables locales evitan que los nombres de salida
  -- (`id`, `expira_en`) choquen con las columnas de la tabla.
  insert into llaves_api_lealtad
    (autorizacion_id, rancho_id, kid, secreto_hash, sufijo_visible,
     entorno, etiqueta, expira_en, creada_por)
  values
    (p_autorizacion_id, v_aut.rancho_id, p_kid, p_secreto_hash, p_sufijo,
     v_aut.entorno, nullif(btrim(coalesce(p_etiqueta, '')), ''),
     now() + (v_meses || ' months')::interval, p_actor)
  returning llaves_api_lealtad.id, llaves_api_lealtad.expira_en
  into v_id, v_expira;

  return query select v_id, v_expira;
end;
$$;

revoke all on function public.api_lealtad_emitir_llave(uuid, uuid, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.api_lealtad_emitir_llave(uuid, uuid, text, text, text, text, integer)
  to service_role;

-- ------------------------------------------------------------
-- RPC: revocar una llave
--
-- `p_actor` null = Bookea (pánico). Con actor, tiene que gestionar el
-- negocio de la llave.
-- ------------------------------------------------------------
create or replace function public.api_lealtad_revocar_llave(
  p_actor uuid,
  p_llave_id uuid,
  p_motivo text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho uuid;
begin
  select rancho_id into v_rancho from llaves_api_lealtad where id = p_llave_id;
  if v_rancho is null then return false; end if;
  if p_actor is not null and not public.gestiona_rancho_como(p_actor, v_rancho) then
    raise exception 'No administrás ese negocio.' using errcode = '42501';
  end if;

  update llaves_api_lealtad
     set estado = 'revocada', revocada_en = now(), revocada_por = p_actor,
         motivo_revocacion = left(coalesce(p_motivo, 'Revocada'), 300)
   where id = p_llave_id and estado <> 'revocada';
  return true;
end;
$$;

revoke all on function public.api_lealtad_revocar_llave(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.api_lealtad_revocar_llave(uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- RPC: revocar la autorización entera (y sus llaves)
--
-- Vive acá y no en la 0176 porque toca las dos tablas.
-- ------------------------------------------------------------
create or replace function public.api_lealtad_revocar_autorizacion(
  p_actor uuid,
  p_autorizacion_id uuid,
  p_motivo text
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

  update autorizaciones_api
     set estado = 'revocada', revocada_por = p_actor, revocada_en = now(),
         motivo_revocacion = left(coalesce(p_motivo, 'Revocada'), 300)
   where id = p_autorizacion_id and estado <> 'revocada';

  update llaves_api_lealtad
     set estado = 'revocada', revocada_en = now(), revocada_por = p_actor,
         motivo_revocacion = 'La autorización fue revocada'
   where autorizacion_id = p_autorizacion_id and estado <> 'revocada';

  return true;
end;
$$;

revoke all on function public.api_lealtad_revocar_autorizacion(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.api_lealtad_revocar_autorizacion(uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- RPC: el botón de PÁNICO de Bookea
--
-- Todas las llaves de un developer, en TODOS los negocios, en una
-- transacción. Es lo que se aprieta cuando el `.env` del integrador
-- apareció en un repo público.
-- ------------------------------------------------------------
create or replace function public.api_lealtad_panico(
  p_desarrollador_id uuid,
  p_motivo text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update llaves_api_lealtad l
     set estado = 'revocada', revocada_en = now(),
         motivo_revocacion = left(coalesce(p_motivo, 'Pánico de Bookea'), 300)
    from autorizaciones_api a
   where a.id = l.autorizacion_id
     and a.desarrollador_id = p_desarrollador_id
     and l.estado <> 'revocada';
  get diagnostics v_n = row_count;

  update autorizaciones_api
     set estado = 'suspendida'
   where desarrollador_id = p_desarrollador_id and estado = 'activa';

  update desarrolladores set estado = 'suspendido' where id = p_desarrollador_id;
  return v_n;
end;
$$;

revoke all on function public.api_lealtad_panico(uuid, text) from public, anon, authenticated;
grant execute on function public.api_lealtad_panico(uuid, text) to service_role;

-- ------------------------------------------------------------
-- RPC: autenticar — el ÚNICO round trip del camino caliente
--
-- Autentica por (kid, hash), valida estado/vigencia de la llave, de la
-- autorización, del developer y del PROGRAMA, y toma el rate limit
-- general de la llave. Todo junto: cada viaje extra a la base es
-- latencia con un cliente esperando en la caja.
--
-- Devuelve una sola fila SIEMPRE, con `motivo` cuando no autentica —
-- la RUTA es la que convierte todos los motivos de credencial en el
-- mismo 401 sin distinguir. Acá se distingue para la bitácora, no para
-- el que llama.
-- ------------------------------------------------------------
create or replace function public.api_lealtad_autenticar(
  p_kid text,
  p_secreto_hash text,
  p_limite_min integer,
  p_ventana_segundos integer
)
returns table (
  ok boolean,
  motivo text,
  llave_id uuid,
  autorizacion_id uuid,
  desarrollador_id uuid,
  desarrollador text,
  rancho_id uuid,
  programa_id uuid,
  entorno text,
  scopes text[],
  mostrar_iniciales boolean,
  pepper_ref bytea,
  ips_permitidas inet[],
  limite_min integer,
  limite_hora integer,
  permitido boolean,
  conteo integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_estado_programa text;
  v_permitido boolean;
  v_conteo integer;
begin
  select l.id as llave_id, l.estado as estado_llave, l.expira_en, l.secreto_hash,
         a.id as autorizacion_id, a.estado as estado_aut, a.rancho_id, a.programa_id,
         a.scopes, a.mostrar_iniciales, a.pepper_ref, a.entorno, a.vence_en,
         a.limite_min, a.limite_hora,
         d.id as desarrollador_id, d.razon_social, d.estado as estado_dev, d.ips_permitidas,
         p.activo as programa_activo, p.estado as programa_estado
    into v
    from llaves_api_lealtad l
    join autorizaciones_api a on a.id = l.autorizacion_id
    join desarrolladores d on d.id = a.desarrollador_id
    join programa_lealtad p on p.id = a.programa_id
   where l.kid = p_kid;

  -- Ni existe el kid, ni coincide el hash: exactamente el mismo camino.
  if v.llave_id is null or v.secreto_hash is distinct from p_secreto_hash then
    return query select false, 'credencial'::text, null::uuid, null::uuid, null::uuid,
      null::text, null::uuid, null::uuid, null::text, null::text[], null::boolean,
      null::bytea, null::inet[], null::integer, null::integer, false, 0;
    return;
  end if;

  if v.estado_llave = 'revocada' or v.expira_en <= now() then
    return query select false, 'llave_inactiva'::text, v.llave_id, v.autorizacion_id,
      v.desarrollador_id, v.razon_social, v.rancho_id, v.programa_id, v.entorno,
      v.scopes, v.mostrar_iniciales, null::bytea, v.ips_permitidas,
      v.limite_min, v.limite_hora, false, 0;
    return;
  end if;

  if v.estado_aut <> 'activa' or v.estado_dev <> 'aprobado'
     or (v.vence_en is not null and v.vence_en <= now()) then
    return query select false, 'acceso_revocado'::text, v.llave_id, v.autorizacion_id,
      v.desarrollador_id, v.razon_social, v.rancho_id, v.programa_id, v.entorno,
      v.scopes, v.mostrar_iniciales, null::bytea, v.ips_permitidas,
      v.limite_min, v.limite_hora, false, 0;
    return;
  end if;

  -- Apagado automático SIN revocar: el mismo criterio de la 0125/0146.
  -- Si el negocio deja de pagar, el webhook pausa el programa y la
  -- llave deja de servir en el acto; cuando se pone al día, vuelve
  -- sola, sin re-trámite.
  v_estado_programa := coalesce(v.programa_estado,
                                case when v.programa_activo then 'activo' else 'pausado' end);
  if v_estado_programa <> 'activo' then
    return query select false, 'programa_inactivo'::text, v.llave_id, v.autorizacion_id,
      v.desarrollador_id, v.razon_social, v.rancho_id, v.programa_id, v.entorno,
      v.scopes, v.mostrar_iniciales, null::bytea, v.ips_permitidas,
      v.limite_min, v.limite_hora, false, 0;
    return;
  end if;

  select r.permitido, r.conteo into v_permitido, v_conteo
    from public.api_rate_limit_tomar('llave', p_kid, p_limite_min, p_ventana_segundos) r;

  update llaves_api_lealtad set ultima_usada_en = now() where id = v.llave_id;

  return query select true, null::text, v.llave_id, v.autorizacion_id, v.desarrollador_id,
    v.razon_social, v.rancho_id, v.programa_id, v.entorno, v.scopes, v.mostrar_iniciales,
    v.pepper_ref, v.ips_permitidas, v.limite_min, v.limite_hora, v_permitido, v_conteo;
end;
$$;

revoke all on function public.api_lealtad_autenticar(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.api_lealtad_autenticar(text, text, integer, integer)
  to service_role;

-- ------------------------------------------------------------
-- bitacora_llaves — el registro que NO se borra
--
-- Admisión, aprobación, autorización, emisión, rotación, revocación y
-- pánico. Quién, cuándo, desde dónde. Sin update ni delete PARA NADIE,
-- ni admin: es la prueba documental ante la PRODHAB y ante el negocio,
-- y una prueba que el interesado puede reescribir no es prueba.
-- Retención LARGA a propósito: no entra en la purga de los 90 días.
-- ------------------------------------------------------------
create table if not exists bitacora_llaves (
  id uuid primary key default gen_random_uuid(),
  evento text not null check (evento in (
    'developer_solicitado', 'developer_aprobado', 'developer_rechazado',
    'developer_suspendido', 'dominio_verificado',
    'autorizacion_creada', 'autorizacion_revocada', 'correlacion_rota',
    'llave_emitida', 'llave_rotada', 'llave_revocada', 'panico'
  )),
  desarrollador_id uuid references desarrolladores(id) on delete set null,
  autorizacion_id uuid references autorizaciones_api(id) on delete set null,
  llave_id uuid references llaves_api_lealtad(id) on delete set null,
  rancho_id uuid references ranchos(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  -- Contexto NO sensible: scopes, etiqueta, motivo. Nunca un secreto.
  detalle jsonb not null default '{}'::jsonb,
  ip_hmac text check (ip_hmac is null or ip_hmac ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists bitacora_llaves_rancho_idx
  on bitacora_llaves (rancho_id, created_at desc);
create index if not exists bitacora_llaves_dev_idx
  on bitacora_llaves (desarrollador_id, created_at desc);

alter table bitacora_llaves enable row level security;

drop policy if exists "El negocio ve el registro de sus llaves" on bitacora_llaves;
create policy "El negocio ve el registro de sus llaves" on bitacora_llaves
  for select to authenticated
  using (rancho_id is not null and (gestiona_rancho(rancho_id) or is_admin()));

grant select (id, evento, desarrollador_id, autorizacion_id, llave_id, rancho_id,
              actor_id, detalle, created_at)
  on bitacora_llaves to authenticated;
grant all on bitacora_llaves to service_role;

-- ------------------------------------------------------------
-- El hilo que hace REVERSIBLE un incidente
--
-- Sin esto, deshacer lo que hizo una llave filtrada es buscar texto en
-- `motivo`. Con esto es
--   where llave_id = … and created_at > …
-- o sea, un clic desde el admin en la entrega 2.
-- ------------------------------------------------------------
alter table transacciones_puntos
  add column if not exists llave_id uuid references llaves_api_lealtad(id) on delete set null;

create index if not exists transacciones_puntos_llave_idx
  on transacciones_puntos (llave_id, created_at desc)
  where llave_id is not null;

comment on column transacciones_puntos.llave_id is
  'Qué llave de API originó este movimiento (0178). null = lo hizo una '
  'persona desde el panel o el mostrador. Es el hilo por el que se '
  'revierte en bloque lo que hizo una llave filtrada.';
