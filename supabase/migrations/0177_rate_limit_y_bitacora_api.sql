-- ============================================================
-- BOOKEA — Límite de peticiones y bitácora de la API de Lealtad (0177)
--
-- ------------------------------------------------------------
-- DECISIONES QUE ESTA MIGRACIÓN FIJA (y por qué)
--
-- 1. EL CONTADOR VIVE EN POSTGRES, NO EN MEMORIA.
--    En Vercel cada invocación es un proceso aislado: un contador en
--    RAM cuenta una fracción arbitraria del tráfico y no limita nada.
--    Redis sería meter otro proveedor —con datos encima— por un
--    contador de enteros.
--
-- 2. ES UN CLON DE `media_rate_limit_tomar` (0113:120-155), NO UN
--    REFACTOR DE ELLA. Aquella está en producción, probada, y falla
--    cerrado. Tocarla para "compartir código" pondría el límite de las
--    subidas de fotos en el camino crítico de este cambio. Lo único
--    que se agrega es `p_ambito`, para que las claves de dos usos
--    distintos no puedan chocar.
--
-- 3. LA CLAVE NUNCA ES EL SECRETO. Es `llave:<kid>`, `rancho:<uuid>`,
--    `authfail:<ip_hmac>`. El kid no es secreto; el secreto no aparece
--    en ninguna tabla de este archivo.
--
-- 4. LA BITÁCORA NO GUARDA DATOS PERSONALES, NI LA LLAVE, NI EL CUERPO.
--    Guarda `miembro_id` —seudónimo, en una tabla que solo ve ESE
--    negocio— porque sin él no se contesta «¿quién le sacó los sellos a
--    esta persona?» ni se atiende un derecho de acceso del titular.
--    La IP va como HMAC (precedente probado en servicio.test.ts:710).
--
-- 5. LA BITÁCORA NO SE PUEDE EDITAR NI BORRAR. Ni por un admin. Es la
--    prueba legal, y una prueba que el interesado puede reescribir no
--    es prueba. La retención del DETALLE es 90 días (purga por el cron
--    que ya corre); el AGREGADO diario es permanente.
--
-- 6. `miembros_distintos` EN EL AGREGADO ES LA SEÑAL QUE DELATA UN
--    SCRAPING. Mil llamadas a un mismo miembro es un POS con un bug;
--    mil llamadas a mil miembros distintos es otra cosa.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El contador
-- ------------------------------------------------------------
create table if not exists api_rate_limit (
  ambito text not null check (char_length(ambito) between 1 and 30),
  clave text not null check (char_length(clave) between 1 and 200),
  ventana_inicio timestamptz not null,
  conteo integer not null default 0,
  primary key (ambito, clave, ventana_inicio)
);

create index if not exists api_rate_limit_ventana_idx
  on api_rate_limit (ventana_inicio);

alter table api_rate_limit enable row level security;
revoke all privileges on table api_rate_limit from public, anon, authenticated;
grant all on table api_rate_limit to service_role;

/**
 * Cuenta un intento y dice si se pasó del límite.
 *
 * `on conflict ... do update` es lo que lo hace atómico: dos peticiones
 * simultáneas no pueden leer el mismo conteo y pasar las dos. La
 * ventana se calcula por truncamiento, así que no hace falta un job que
 * la reinicie. Idéntico a media_rate_limit_tomar (0113) salvo el
 * ámbito.
 */
create or replace function public.api_rate_limit_tomar(
  p_ambito           text,
  p_clave            text,
  p_limite           integer,
  p_ventana_segundos integer
)
returns table (permitido boolean, conteo integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz;
  v_conteo integer;
begin
  if p_ambito is null or btrim(p_ambito) = ''
     or p_clave is null or btrim(p_clave) = ''
     or p_limite is null or p_limite <= 0
     or p_ventana_segundos is null or p_ventana_segundos <= 0 then
    raise exception 'api_rate_limit_tomar: parámetros inválidos.' using errcode = '22023';
  end if;

  v_inicio := to_timestamp(
    floor(extract(epoch from now()) / p_ventana_segundos) * p_ventana_segundos
  );

  insert into public.api_rate_limit (ambito, clave, ventana_inicio, conteo)
  values (p_ambito, p_clave, v_inicio, 1)
  on conflict (ambito, clave, ventana_inicio)
  do update set conteo = public.api_rate_limit.conteo + 1
  returning public.api_rate_limit.conteo into v_conteo;

  return query select v_conteo <= p_limite, v_conteo;
end;
$$;

revoke all on function public.api_rate_limit_tomar(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.api_rate_limit_tomar(text, text, integer, integer)
  to service_role;

/**
 * MIRAR sin contar.
 *
 * El pre-chequeo de fallos de credencial tiene que poder preguntar
 * "¿esta IP ya se pasó?" SIN sumar uno: si mirara contando, cada
 * petición legítima gastaría el presupuesto de fallos y la primera
 * equivocación real bloquearía a un integrador que estaba trabajando
 * bien.
 */
create or replace function public.api_rate_limit_ver(
  p_ambito           text,
  p_clave            text,
  p_ventana_segundos integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.conteo from public.api_rate_limit r
      where r.ambito = p_ambito
        and r.clave = p_clave
        and r.ventana_inicio = to_timestamp(
              floor(extract(epoch from now()) / greatest(p_ventana_segundos, 1))
              * greatest(p_ventana_segundos, 1))),
    0);
$$;

revoke all on function public.api_rate_limit_ver(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.api_rate_limit_ver(text, text, integer) to service_role;

-- ------------------------------------------------------------
-- 2. La bitácora: UNA fila por llamada, exitosa o no
-- ------------------------------------------------------------
create table if not exists bitacora_api_lealtad (
  id uuid primary key default gen_random_uuid(),

  -- También viaja en la cabecera X-Bookea-Request-Id, para que el
  -- soporte encuentre la llamada sin que nadie tenga que mandar el
  -- cuerpo de la petición.
  request_id uuid not null,

  autorizacion_id uuid,
  llave_id uuid,
  kid text check (kid is null or kid ~ '^[a-z0-9]{12}$'),
  rancho_id uuid,

  metodo text not null check (metodo in ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  -- El PATRÓN, no la URL real: `/saldo`, nunca `/saldo?serial=…`.
  ruta_patron text not null check (char_length(ruta_patron) <= 60),

  miembro_id uuid,
  estado_http integer not null check (estado_http between 100 and 599),
  codigo_error text check (codigo_error is null or char_length(codigo_error) <= 40),
  puntos_delta integer,
  referencia text check (referencia is null or char_length(referencia) <= 120),
  duracion_ms integer check (duracion_ms is null or duracion_ms between 0 and 600000),

  ip_hmac text check (ip_hmac is null or ip_hmac ~ '^[0-9a-f]{64}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 120),

  created_at timestamptz not null default now()
);

comment on table bitacora_api_lealtad is
  'Una fila por llamada a la API de Lealtad (0177). NO guarda: la llave '
  'ni su hash (solo el kid), el cuerpo de la petición o la respuesta, la '
  'cabecera Authorization, ni nombre/correo/teléfono/IP en claro.';

create index if not exists bitacora_api_lealtad_rancho_idx
  on bitacora_api_lealtad (rancho_id, created_at desc);
create index if not exists bitacora_api_lealtad_llave_idx
  on bitacora_api_lealtad (kid, created_at desc);
create index if not exists bitacora_api_lealtad_purga_idx
  on bitacora_api_lealtad (created_at);

alter table bitacora_api_lealtad enable row level security;

drop policy if exists "El negocio ve su bitácora de API" on bitacora_api_lealtad;
create policy "El negocio ve su bitácora de API" on bitacora_api_lealtad
  for select to authenticated
  using (rancho_id is not null and (gestiona_rancho(rancho_id) or is_admin()));

-- Grant POR COLUMNA: `ip_hmac` no está en la lista. Al dueño le sirve
-- saber QUÉ pasó, no desde qué huella de IP — y con la huella y un poco
-- de paciencia se distinguen sucursales y personas.
grant select (
  id, request_id, autorizacion_id, llave_id, kid, rancho_id, metodo, ruta_patron,
  miembro_id, estado_http, codigo_error, puntos_delta, referencia, duracion_ms,
  user_agent, created_at
) on bitacora_api_lealtad to authenticated;
grant all on bitacora_api_lealtad to service_role;

-- Sin update ni delete PARA NADIE que no sea el servidor: la bitácora
-- no se corrige, se lee.

-- ------------------------------------------------------------
-- 3. El agregado diario — permanente
-- ------------------------------------------------------------
create table if not exists bitacora_api_lealtad_dia (
  dia date not null,
  kid text not null,
  rancho_id uuid,
  ruta_patron text not null,
  estado_http integer not null,
  llamadas integer not null default 0,
  -- La señal que delata un scraping.
  miembros_distintos integer not null default 0,
  puntos_delta integer not null default 0,
  primary key (dia, kid, ruta_patron, estado_http)
);

alter table bitacora_api_lealtad_dia enable row level security;

drop policy if exists "El negocio ve su agregado de API" on bitacora_api_lealtad_dia;
create policy "El negocio ve su agregado de API" on bitacora_api_lealtad_dia
  for select to authenticated
  using (rancho_id is not null and (gestiona_rancho(rancho_id) or is_admin()));

grant select on bitacora_api_lealtad_dia to authenticated;
grant all on bitacora_api_lealtad_dia to service_role;

/**
 * Consolida un día y borra su detalle si ya pasó la retención.
 *
 * Lo llama el cron que ya corre en GitHub Actions. Se puede correr dos
 * veces sobre el mismo día sin duplicar: el agregado se recalcula.
 */
create or replace function public.api_lealtad_consolidar_dia(p_dia date, p_retencion_dias integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas integer := 0;
begin
  insert into bitacora_api_lealtad_dia
    (dia, kid, rancho_id, ruta_patron, estado_http, llamadas, miembros_distintos, puntos_delta)
  select p_dia, b.kid, min(b.rancho_id), b.ruta_patron, b.estado_http,
         count(*)::int, count(distinct b.miembro_id)::int, coalesce(sum(b.puntos_delta), 0)::int
    from bitacora_api_lealtad b
   where b.kid is not null
     and (b.created_at at time zone 'America/Costa_Rica')::date = p_dia
   group by b.kid, b.ruta_patron, b.estado_http
  on conflict (dia, kid, ruta_patron, estado_http) do update
    set llamadas = excluded.llamadas,
        miembros_distintos = excluded.miembros_distintos,
        puntos_delta = excluded.puntos_delta,
        rancho_id = excluded.rancho_id;

  delete from bitacora_api_lealtad
   where created_at < now() - (greatest(coalesce(p_retencion_dias, 90), 30) || ' days')::interval;
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke all on function public.api_lealtad_consolidar_dia(date, integer)
  from public, anon, authenticated;
grant execute on function public.api_lealtad_consolidar_dia(date, integer) to service_role;
