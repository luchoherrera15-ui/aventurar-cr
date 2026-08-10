-- ============================================================
-- BOOKEA MEDIA — 3.1B: subidas anónimas seguras (0113)
--
-- Álbumes y comprobantes son los dos casos que NO tienen sesión: el
-- invitado que escanea el QR de la mesa no tiene cuenta y nunca va a
-- tenerla, y quien sube un comprobante de SINPE tampoco. Son, además,
-- el mayor volumen medido (118,5 MB en un solo álbum).
--
-- El flujo autenticado (0112) exige `auth.uid()`, así que estos dos
-- necesitan otra llave. La llave es una CAPACIDAD: un secreto de vida
-- corta, emitido por el servidor, atado a UNA entidad concreta y con un
-- número finito de usos.
--
-- ── LO QUE UNA CAPACIDAD NO ES ───────────────────────────────────────
--
-- No es una sesión ni una identidad. No dice quién sos: dice que el
-- servidor ya comprobó que este álbum existe y está activo, que quien
-- pide pasó Turnstile, y que puede subir N archivos a ESA entidad y a
-- ninguna otra. Es lo mínimo que hace falta para que una URL prefirmada
-- de escritura a R2 no sea un cheque en blanco.
--
-- ── EL TOKEN NUNCA SE GUARDA ─────────────────────────────────────────
--
-- Acá vive solo el SHA-256. El token en claro existe una vez, viaja al
-- navegador y se olvida. Un volcado de esta tabla no le sirve a nadie
-- para subir nada — es el mismo criterio que ya usa
-- `album_foto_llaves` (0089) para las llaves de borrado.
--
-- ── LA IP TAMPOCO ────────────────────────────────────────────────────
--
-- Se guarda un HMAC, nunca la IP en claro, y SOLO para rate limiting.
-- La IP no autoriza nada: detrás de un NAT móvil hay una boda entera
-- compartiendo dirección, y una IP no prueba quién es nadie.
--
-- Aditiva. Segura de volver a aplicar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Capacidades
-- ------------------------------------------------------------

create table if not exists public.media_capacidades (
  id uuid primary key default gen_random_uuid(),

  -- SHA-256 hex del token. NUNCA el token.
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),

  -- Para qué sirve. Cada propósito tiene su propia validación de
  -- entidad en `media_emitir_capacidad`.
  proposito text not null check (proposito in ('album_subida', 'comprobante_subida')),

  -- A QUÉ entidad. El cliente anónimo nunca la elige: la fija el
  -- servidor al emitir, y la confirmación la lee de acá.
  entity_type text not null check (entity_type in ('album', 'comprobante')),
  entity_id uuid not null,

  -- Cuántas subidas quedan. Un álbum emite 10 (el tope por tanda que ya
  -- tiene la pantalla); un comprobante, 1.
  usos_restantes integer not null check (usos_restantes >= 0),
  usos_emitidos integer not null check (usos_emitidos > 0),

  -- Tope de tamaño de ESTA capacidad, por si se quiere emitir una más
  -- estricta que el límite global.
  max_bytes bigint check (max_bytes is null or max_bytes > 0),

  -- HMAC de la IP. Nunca la IP.
  ip_hmac text check (ip_hmac is null or ip_hmac ~ '^[0-9a-f]{64}$'),

  creada_en timestamptz not null default now(),
  -- Vida corta: minutos, no horas.
  expira_en timestamptz not null,
  revocada boolean not null default false
);

create index if not exists media_capacidades_entidad_idx
  on public.media_capacidades (entity_type, entity_id);

-- La cola de limpieza de capacidades vencidas.
create index if not exists media_capacidades_expira_idx
  on public.media_capacidades (expira_en)
  where not revocada;

alter table public.media_capacidades enable row level security;

-- Sin políticas: nadie más que `service_role` la toca. El cliente
-- anónimo NUNCA habla con esta tabla — habla con el endpoint.
revoke all privileges on table public.media_capacidades from public, anon, authenticated;
grant all on table public.media_capacidades to service_role;

-- ------------------------------------------------------------
-- 2. Rate limiting
--
-- Contador por clave y ventana. La clave la arma el servidor (HMAC de
-- IP, o el hash de la capacidad); acá solo se cuenta.
-- ------------------------------------------------------------

create table if not exists public.media_rate_limit (
  clave text not null,
  ventana_inicio timestamptz not null,
  conteo integer not null default 0,
  primary key (clave, ventana_inicio)
);

create index if not exists media_rate_limit_ventana_idx
  on public.media_rate_limit (ventana_inicio);

alter table public.media_rate_limit enable row level security;
revoke all privileges on table public.media_rate_limit from public, anon, authenticated;
grant all on table public.media_rate_limit to service_role;

/**
 * Cuenta un intento y dice si se pasó del límite.
 *
 * `on conflict ... do update` es lo que lo hace atómico: dos peticiones
 * simultáneas no pueden leer el mismo conteo y pasar las dos. La
 * ventana se calcula por truncamiento, así que no hace falta un job que
 * la reinicie.
 */
create or replace function public.media_rate_limit_tomar(
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
  if p_clave is null or btrim(p_clave) = '' or p_limite is null or p_limite <= 0
     or p_ventana_segundos is null or p_ventana_segundos <= 0 then
    raise exception 'media_rate_limit_tomar: parámetros inválidos.' using errcode = '22023';
  end if;

  v_inicio := to_timestamp(
    floor(extract(epoch from now()) / p_ventana_segundos) * p_ventana_segundos
  );

  insert into public.media_rate_limit (clave, ventana_inicio, conteo)
  values (p_clave, v_inicio, 1)
  on conflict (clave, ventana_inicio)
  do update set conteo = public.media_rate_limit.conteo + 1
  returning public.media_rate_limit.conteo into v_conteo;

  return query select v_conteo <= p_limite, v_conteo;
end;
$$;

revoke all on function public.media_rate_limit_tomar(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.media_rate_limit_tomar(text, integer, integer) to service_role;

-- ------------------------------------------------------------
-- 3. Emitir una capacidad
--
-- Solo `service_role`, y solo después de que el endpoint haya validado
-- Origin, Turnstile y el rate limit. Acá se valida lo que solo la base
-- puede saber: que la entidad EXISTA y ADMITA la operación.
-- ------------------------------------------------------------

create or replace function public.media_emitir_capacidad(
  p_token_hash text,
  p_proposito  text,
  p_entity_id  uuid,
  p_usos       integer,
  p_ttl_segundos integer,
  p_max_bytes  bigint default null,
  p_ip_hmac    text default null
)
returns table (codigo text, capacidad_id uuid, expira_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expira timestamptz;
  v_tipo   text;
  v_id     uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'media_emitir_capacidad: hash inválido.' using errcode = '22023';
  end if;
  if p_usos is null or p_usos < 1 or p_usos > 10 then
    raise exception 'media_emitir_capacidad: usos fuera de rango.' using errcode = '22023';
  end if;
  -- Vida corta de verdad: entre 1 y 30 minutos.
  if p_ttl_segundos is null or p_ttl_segundos < 60 or p_ttl_segundos > 1800 then
    raise exception 'media_emitir_capacidad: ttl fuera de rango.' using errcode = '22023';
  end if;

  case p_proposito
    -- El álbum tiene que existir y estar ACTIVO. Es la misma condición
    -- que ya usa la política pública de la 0068: un álbum archivado
    -- deja de aceptar fotos sin que nadie tenga que acordarse.
    when 'album_subida' then
      if not exists (
        select 1 from public.albumes a where a.id = p_entity_id and a.estado = 'activo'
      ) then
        return query select 'entidad_no_disponible'::text, null::uuid, null::timestamptz;
        return;
      end if;
      v_tipo := 'album';

    -- El comprobante cuelga de una reserva REAL. Un uuid suelto no
    -- alcanza: se comprueba que la reserva exista y no esté rechazada.
    when 'comprobante_subida' then
      if not exists (
        select 1 from public.reservas s
         where s.id = p_entity_id and s.estado <> 'rechazada'
      ) then
        return query select 'entidad_no_disponible'::text, null::uuid, null::timestamptz;
        return;
      end if;
      v_tipo := 'comprobante';

    else
      raise exception 'media_emitir_capacidad: propósito desconocido.' using errcode = '22023';
  end case;

  v_expira := now() + make_interval(secs => p_ttl_segundos);

  insert into public.media_capacidades
    (token_hash, proposito, entity_type, entity_id,
     usos_restantes, usos_emitidos, max_bytes, ip_hmac, expira_en)
  values
    (p_token_hash, p_proposito, v_tipo, p_entity_id,
     p_usos, p_usos, p_max_bytes, p_ip_hmac, v_expira)
  returning id into v_id;

  return query select 'emitida'::text, v_id, v_expira;
end;
$$;

revoke all on function public.media_emitir_capacidad(text, text, uuid, integer, integer, bigint, text)
  from public, anon, authenticated;
grant execute on function public.media_emitir_capacidad(text, text, uuid, integer, integer, bigint, text)
  to service_role;

-- ------------------------------------------------------------
-- 4. Reservar CONSUMIENDO una capacidad
--
-- El equivalente anónimo de `media_reservar` (0112). Diferencias que
-- importan:
--
--   · No hay `auth.uid()`: la autorización ES la capacidad.
--   · `entity_type`, `entity_id`, visibilidad y propietario NO son
--     parámetros — salen de la capacidad o se derivan. El cliente
--     anónimo no puede elegir ninguno.
--   · El consumo del uso y la reserva ocurren en la MISMA transacción,
--     con la fila de la capacidad bloqueada: una capacidad de 10 usos
--     no puede rendir 11 aunque se disparen 20 peticiones a la vez.
-- ------------------------------------------------------------

create or replace function public.media_reservar_con_capacidad(
  p_token_hash      text,
  p_solicitud_id    uuid,
  p_mime            text,
  p_bytes           bigint,
  p_nombre_original text
)
returns table (
  codigo            text,
  asset_id          uuid,
  posicion          integer,
  estado            text,
  reserva_expira_en timestamptz,
  usos_restantes    integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap       public.media_capacidades%rowtype;
  v_nombre    text := btrim(coalesce(p_nombre_original, ''));
  v_expira    timestamptz := now() + interval '30 minutes';
  v_posicion  integer;
  v_usados    integer;
  v_nuevo_id  uuid;
  v_vis       text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'media_reservar_con_capacidad: hash inválido.' using errcode = '22023';
  end if;
  if p_solicitud_id is null then
    raise exception 'media_reservar_con_capacidad: falta la solicitud.' using errcode = '22023';
  end if;
  if v_nombre = '' or char_length(v_nombre) > 300 then
    raise exception 'media_reservar_con_capacidad: nombre inválido.' using errcode = '22023';
  end if;

  -- FOR UPDATE: el consumo del uso tiene que ser atómico.
  select * into v_cap
    from public.media_capacidades c
   where c.token_hash = p_token_hash
   for update;

  if not found then
    return query select 'capacidad_invalida'::text, null::uuid, null::integer,
                        null::text, null::timestamptz, null::integer;
    return;
  end if;
  if v_cap.revocada or v_cap.expira_en <= now() then
    return query select 'capacidad_vencida'::text, null::uuid, null::integer,
                        null::text, null::timestamptz, 0;
    return;
  end if;
  if v_cap.usos_restantes <= 0 then
    return query select 'capacidad_agotada'::text, null::uuid, null::integer,
                        null::text, null::timestamptz, 0;
    return;
  end if;

  -- MIME y tamaño según el propósito.
  if v_cap.entity_type = 'album' then
    -- Los álbumes son fotos. Video y audio no pasan por acá.
    if p_mime not in ('image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif') then
      raise exception 'media_reservar_con_capacidad: formato no admitido.' using errcode = '0A000';
    end if;
    v_vis := 'compartida';
  else
    -- Un comprobante puede ser una foto o un PDF escaneado como imagen.
    if p_mime not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then
      raise exception 'media_reservar_con_capacidad: formato no admitido.' using errcode = '0A000';
    end if;
    v_vis := 'privada';
  end if;

  if p_bytes is null or p_bytes <= 0 or p_bytes > coalesce(v_cap.max_bytes, 10485760) then
    raise exception 'media_reservar_con_capacidad: tamaño inválido.' using errcode = '22023';
  end if;

  -- Idempotencia, igual que en la 0112.
  perform pg_advisory_xact_lock(
    hashtextextended('media:entidad:' || v_cap.entity_type || ':' || v_cap.entity_id::text, 0)
  );

  select m.id, m.posicion into v_nuevo_id, v_posicion
    from public.media_assets m
   where m.entity_type = v_cap.entity_type
     and m.entity_id = v_cap.entity_id
     and m.solicitud_id = p_solicitud_id;
  if found then
    return query select 'reutilizada'::text, v_nuevo_id, v_posicion,
      (select estado from public.media_assets where id = v_nuevo_id),
      (select reserva_expira_en from public.media_assets where id = v_nuevo_id),
      v_cap.usos_restantes;
    return;
  end if;

  -- Cupo del álbum: el técnico de 500 que ya impone la 0068.
  if v_cap.entity_type = 'album' then
    select count(*) into v_usados
      from public.media_assets m
     where m.entity_type = 'album' and m.entity_id = v_cap.entity_id
       and m.deleted_at is null
       and (m.estado in ('listo','parcial_r2','parcial_cf')
            or (m.estado in ('pendiente','subiendo')
                and m.reserva_expira_en is not null and m.reserva_expira_en > now()));
    if v_usados >= 500 then
      return query select 'cupo_agotado'::text, null::uuid, null::integer,
                          null::text, null::timestamptz, v_cap.usos_restantes;
      return;
    end if;
  end if;

  select coalesce(max(m.posicion) + 1, 0) into v_posicion
    from public.media_assets m
   where m.entity_type = v_cap.entity_type and m.entity_id = v_cap.entity_id
     and m.deleted_at is null;

  -- Se consume el uso EN LA MISMA transacción que la reserva.
  --
  -- El valor viene de `v_cap`, que se leyó con FOR UPDATE unas líneas
  -- más arriba y por lo tanto está al día. No se escribe
  -- `usos_restantes - 1` a secas: `usos_restantes` es TAMBIÉN el nombre
  -- de una columna del RETURNS TABLE, y ahí Postgres se queda con el
  -- parámetro de salida en vez de con la columna. Da un error de
  -- referencia ambigua — lo encontró la batería local.
  update public.media_capacidades c
     set usos_restantes = v_cap.usos_restantes - 1
   where c.id = v_cap.id;

  insert into public.media_assets (
    entity_type, entity_id, visibilidad, estado,
    mime, bytes, nombre_original, posicion,
    solicitud_id, reserva_expira_en
  ) values (
    v_cap.entity_type, v_cap.entity_id, v_vis, 'pendiente',
    p_mime, p_bytes, v_nombre, v_posicion,
    p_solicitud_id, v_expira
  )
  returning id into v_nuevo_id;

  return query select 'creada'::text, v_nuevo_id, v_posicion,
                      'pendiente'::text, v_expira, v_cap.usos_restantes - 1;
end;
$$;

revoke all on function public.media_reservar_con_capacidad(text, uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.media_reservar_con_capacidad(text, uuid, text, bigint, text)
  to service_role;

-- ------------------------------------------------------------
-- 5. Comprobar que una capacidad cubre un asset
--
-- La confirmación anónima NO acepta solo un `asset_id`: exige la
-- capacidad, y acá se comprueba que ese asset pertenezca de verdad a la
-- entidad de esa capacidad. Sin esto, cualquiera con un `asset_id`
-- ajeno podría dispararle la confirmación.
-- ------------------------------------------------------------

create or replace function public.media_capacidad_cubre(
  p_token_hash text,
  p_asset_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.media_capacidades c
      join public.media_assets m
        on m.entity_type = c.entity_type and m.entity_id = c.entity_id
     where c.token_hash = p_token_hash
       and not c.revocada
       and c.expira_en > now()
       and m.id = p_asset_id
       and m.deleted_at is null
  );
$$;

revoke all on function public.media_capacidad_cubre(text, uuid)
  from public, anon, authenticated;
grant execute on function public.media_capacidad_cubre(text, uuid) to service_role;

-- ------------------------------------------------------------
-- 6. `media_assets` para la reserva anónima
--
-- El trigger de la 0110 deriva `propietario_id` de la entidad. Para un
-- álbum sin cliente asignado eso da null, que ya está contemplado.
--
-- `solicitante_id` queda NULL a propósito: no hay actor. La restricción
-- `media_assets_solicitante_con_solicitud` de la 0112 lo permite —
-- exige solicitante ⇒ solicitud, no al revés. Fue justamente el arreglo
-- que se le hizo para no romper `on delete set null`, y acá vuelve a
-- servir.
-- ------------------------------------------------------------

comment on table public.media_capacidades is
  'Capacidades de subida anónima (álbumes y comprobantes). Guarda SOLO el '
  'SHA-256 del token; el original viaja al navegador y no se persiste. La '
  'IP, si se guarda, va como HMAC y solo para rate limiting.';

comment on function public.media_reservar_con_capacidad(text, uuid, text, bigint, text) is
  'Reserva anónima. entity_type, entity_id y visibilidad salen de la '
  'capacidad, nunca del cliente. Consume el uso y reserva en la misma '
  'transacción, con la capacidad bloqueada.';

notify pgrst, 'reload schema';
