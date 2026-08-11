-- ============================================================
-- BOOKEA MEDIA — 3.1C: confirmar por CAPACIDAD, y terminar sin
-- Cloudflare (0114)
--
-- La 0112 dejó el flujo de confirmación completo… para UN caso: un
-- actor con sesión, sobre una de las tres entidades del piloto, con una
-- imagen que va a Cloudflare Images. Los endpoints de este bloque
-- necesitan dos cosas que ese flujo NO puede dar, y ninguna de las dos
-- se arregla desde TypeScript.
--
-- ── HUECO 1: NO HAY ACTOR ────────────────────────────────────────────
--
-- `media_tomar_confirmacion`, `media_registrar_r2`,
-- `media_finalizar_cloudflare`, `media_liberar_confirmacion` y
-- `media_rechazar_confirmacion` exigen `p_actor` y lo pasan por
-- `media_puede_administrar_como()`. Un invitado de boda no tiene
-- `auth.uid()` y nunca va a tenerlo: su autorización es la CAPACIDAD de
-- la 0113.
--
-- Además todas cortan con `entity_type not in ('rancho','rancho_item',
-- 'equipo')`, así que un álbum o un comprobante no pasan ni con actor.
--
-- La salida NO es aflojar esas funciones —siguen siendo correctas para
-- lo suyo y ya están probadas— sino un juego paralelo con sufijo `_cap`
-- cuya autorización es el hash del token. Cada una comprueba lo mismo
-- que su gemela, cambiando "¿este actor administra la entidad?" por
-- "¿esta capacidad cubre este asset?".
--
-- Dos juegos de funciones es peor que uno, y se eligió a sabiendas: la
-- alternativa era un parámetro `p_token_hash` de más en las cinco
-- funciones de la 0112, o sea sobrecargas del mismo nombre resueltas
-- por PostgREST según qué claves trae el JSON. Una ambigüedad en el
-- ruteo de una función que autoriza escrituras no es un lugar donde
-- convenga ahorrar líneas.
--
-- ── HUECO 2: `listo` EXIGÍA CLOUDFLARE PARA TODA IMAGEN ──────────────
--
-- `media_assets_listo_coherente` (0110) dice: si el MIME es
-- `image/%`, para estar `listo` hacen falta `cf_image_id` y
-- `cf_verificado_en`.
--
-- Un comprobante de SINPE es un JPEG. Una cédula de verificación
-- también. Los dos son PRIVADOS: se miran una vez, desde el panel, con
-- una URL firmada de R2. Mandarlos a Cloudflare Images sería sacar una
-- cédula de nuestro bucket privado y meterla en una CDN pública que
-- nadie pidió — y encima dejarlos atascados para siempre si no se hace,
-- porque sin el sello de Cloudflare nunca llegarían a `listo`.
--
-- Video y audio tenían el mismo problema por otro lado:
-- `media_registrar_r2` los deja en `parcial_r2`, y
-- `media_assets_parcial_r2_coherente` exige `mime like 'image/%'`. O
-- sea que un MP3 ni siquiera podía pasar por ahí.
--
-- Se arregla con `media_finalizar_r2`, que va de `subiendo` a `listo`
-- en UNA transacción escribiendo el sello de R2 — sin pasar por
-- `parcial_r2`, que para un archivo R2-only es un estado que no
-- significa nada. Y se amplía el CHECK de `listo` para que lo admita.
--
-- Lo contrario también se cierra con una restricción nueva: un
-- comprobante o una verificación NO PUEDEN tener `cf_image_id`. Que sea
-- R2-only deja de ser una intención del código y pasa a ser algo que la
-- base impide violar.
--
-- ── QUÉ NO CAMBIA ────────────────────────────────────────────────────
--
-- Ni una función de la 0112 se toca. `media_reservar` sigue siendo la
-- única ejecutable por `authenticated`. Todo lo de acá es
-- `service_role`, igual que la 0113.
--
-- Aditiva y segura de volver a aplicar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Qué archivos son R2-only
--
-- La regla, en una línea: NO va a Cloudflare Images lo que no es imagen
-- (no hay variante de un MP3) ni lo que es privado por producto
-- (comprobantes y verificaciones).
--
-- Se escribe DOS veces —acá como función y abajo dentro del CHECK— y no
-- es un descuido: un CHECK que llama a una función depende de que esa
-- función siga siendo lo que era, y Postgres no revalida las filas
-- existentes cuando el cuerpo cambia. Un `create or replace` distraído
-- desactivaría la restricción en silencio. La expresión va literal en
-- la restricción para que sea la base la que la garantice; la función
-- existe para el código PL/pgSQL de abajo, que sí puede llamarla.
--
-- Si alguna vez cambia la regla, hay que tocar los dos lugares. Está
-- señalado en ambos.
-- ------------------------------------------------------------

create or replace function public.media_solo_r2(p_entity_type text, p_mime text)
returns boolean
language sql
immutable
as $$
  -- ⚠️ ESPEJO de media_assets_listo_coherente. Cambiar los dos juntos.
  select p_mime is null
      or p_mime not like 'image/%'
      or p_entity_type in ('comprobante', 'verificacion');
$$;

revoke all on function public.media_solo_r2(text, text) from public, anon, authenticated;
grant execute on function public.media_solo_r2(text, text) to service_role;

comment on function public.media_solo_r2(text, text) is
  'true si el archivo NO lleva copia en Cloudflare Images: todo lo que no '
  'es imagen, más comprobantes y verificaciones (privados por producto). '
  'ESPEJO de la restricción media_assets_listo_coherente.';

-- ------------------------------------------------------------
-- 2. `listo` sin Cloudflare, cuando corresponde
-- ------------------------------------------------------------

alter table public.media_assets drop constraint if exists media_assets_listo_coherente;
alter table public.media_assets add constraint media_assets_listo_coherente check (
  estado <> 'listo'
  or (
    mime is not null
    and r2_key is not null
    and r2_verificado_en is not null
    and (
      -- ⚠️ ESPEJO de public.media_solo_r2(). Cambiar los dos juntos.
      mime not like 'image/%'
      or entity_type in ('comprobante', 'verificacion')
      or (cf_image_id is not null and cf_verificado_en is not null)
    )
  )
);

-- Y al revés: lo privado NUNCA sale a Cloudflare Images.
--
-- Sin esto, "es R2-only" sería una convención que vive en el código y
-- que un `update` a mano o un camino nuevo puede saltarse. Una cédula
-- subida a una CDN pública no es un bug que se quiera descubrir tarde.
alter table public.media_assets drop constraint if exists media_assets_privado_sin_cloudflare;
alter table public.media_assets add constraint media_assets_privado_sin_cloudflare check (
  entity_type not in ('comprobante', 'verificacion')
  or (cf_image_id is null and cf_verificado_en is null)
);

-- ------------------------------------------------------------
-- 3. Los datos con los que el servidor arma la clave de R2
--
-- La clave es `originals/{propietario}/{entidad}/{entidadId}/{assetId}/
-- {archivo}` (src/lib/media/claves.ts), y `propietario_id` lo DERIVA el
-- trigger de la 0110 desde la entidad: no es el actor. Un admin que
-- sube al negocio de un tercero tiene que escribir bajo el prefijo del
-- tercero.
--
-- Ni `media_reservar` (0112) ni `media_reservar_con_capacidad` (0113)
-- devuelven esa columna, y `authenticated` no puede leerla (0111). Por
-- eso hace falta esta lectura, que corre como `service_role` y devuelve
-- solo lo que la clave necesita.
-- ------------------------------------------------------------

create or replace function public.media_datos_para_clave(p_asset_id uuid)
returns table (
  propietario_id  uuid,
  entity_type     text,
  entity_id       uuid,
  nombre_original text,
  mime            text,
  bytes           bigint,
  estado          text,
  r2_key          text,
  solo_r2         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.propietario_id, m.entity_type, m.entity_id, m.nombre_original,
         m.mime, m.bytes, m.estado, m.r2_key,
         public.media_solo_r2(m.entity_type, m.mime)
    from public.media_assets m
   where m.id = p_asset_id
     and m.deleted_at is null;
$$;

revoke all on function public.media_datos_para_clave(uuid) from public, anon, authenticated;
grant execute on function public.media_datos_para_clave(uuid) to service_role;

-- ------------------------------------------------------------
-- 4. ¿Esta capacidad cubre este asset?
--
-- La 0113 ya tiene `media_capacidad_cubre`, que devuelve un booleano.
-- Para un endpoint eso no alcanza: "no cubre" puede ser un token que no
-- existe (401), uno vencido (410) o uno válido apuntando a otra entidad
-- (403), y son tres respuestas distintas.
--
-- Devuelve además la entidad, que es lo que hace que el cliente anónimo
-- nunca la elija.
-- ------------------------------------------------------------

create or replace function public.media_capacidad_de_asset(
  p_token_hash text,
  p_asset_id   uuid
)
returns table (
  codigo       text,
  capacidad_id uuid,
  entity_type  text,
  entity_id    uuid,
  proposito    text,
  max_bytes    bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cap public.media_capacidades%rowtype;
  v_m   public.media_assets%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_asset_id is null then
    return query select 'capacidad_invalida'::text, null::uuid, null::text,
                        null::uuid, null::text, null::bigint;
    return;
  end if;

  select * into v_cap
    from public.media_capacidades c
   where c.token_hash = p_token_hash;

  if not found then
    return query select 'capacidad_invalida'::text, null::uuid, null::text,
                        null::uuid, null::text, null::bigint;
    return;
  end if;

  if v_cap.revocada or v_cap.expira_en <= now() then
    return query select 'capacidad_vencida'::text, v_cap.id, null::text,
                        null::uuid, null::text, null::bigint;
    return;
  end if;

  select * into v_m from public.media_assets m where m.id = p_asset_id;

  -- "No existe" y "existe pero es de otro" se responden IGUAL a
  -- propósito: distinguirlos le confirmaría a quien prueba uuids cuáles
  -- son assets reales.
  if not found
     or v_m.deleted_at is not null
     or v_m.entity_type is distinct from v_cap.entity_type
     or v_m.entity_id is distinct from v_cap.entity_id then
    return query select 'no_cubre'::text, v_cap.id, null::text,
                        null::uuid, null::text, null::bigint;
    return;
  end if;

  return query select 'ok'::text, v_cap.id, v_cap.entity_type,
                      v_cap.entity_id, v_cap.proposito, v_cap.max_bytes;
end;
$$;

revoke all on function public.media_capacidad_de_asset(text, uuid)
  from public, anon, authenticated;
grant execute on function public.media_capacidad_de_asset(text, uuid) to service_role;

-- ------------------------------------------------------------
-- 5. Preparar la subida, autorizando por capacidad
--
-- Gemela de `media_preparar_subida` (0112). Mismos estados admitidos,
-- misma escritura única de `r2_key`, mismo `p_objeto_previo_ausente`
-- para el reintento desde 'error'. Lo único que cambia es de dónde sale
-- la autorización.
-- ------------------------------------------------------------

create or replace function public.media_preparar_subida_cap(
  p_token_hash            text,
  p_asset_id              uuid,
  p_r2_key                text,
  p_objeto_previo_ausente boolean default false
)
returns table (codigo text, estado text, reserva_expira_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila   public.media_assets%rowtype;
  v_aut    record;
  v_expira timestamptz := now() + interval '30 minutes';
begin
  if p_asset_id is null or btrim(coalesce(p_r2_key, '')) = '' then
    raise exception 'media_preparar_subida_cap: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_aut from public.media_capacidad_de_asset(p_token_hash, p_asset_id);
  if v_aut.codigo <> 'ok' then
    return query select v_aut.codigo, null::text, null::timestamptz;
    return;
  end if;

  -- FOR UPDATE: cierra la ventana entre leer y escribir, igual que la 0112.
  select * into v_fila
    from public.media_assets m
   where m.id = p_asset_id
   for update;

  if not found or v_fila.deleted_at is not null then
    raise exception 'media_preparar_subida_cap: el asset no existe.' using errcode = '22023';
  end if;

  -- Del flujo de reserva anónima: `solicitud_id` sí, `solicitante_id`
  -- NO (no hay actor). Es exactamente lo que permite la restricción
  -- `media_assets_solicitante_con_solicitud` de la 0112.
  if v_fila.solicitud_id is null then
    raise exception 'media_preparar_subida_cap: el asset no viene del flujo de reserva.'
      using errcode = '22023';
  end if;

  if v_fila.limpieza_lease is not null and v_fila.limpieza_expira_en > now() then
    return query select 'limpieza_en_curso'::text, v_fila.estado, v_fila.reserva_expira_en;
    return;
  end if;

  if v_fila.estado in ('parcial_r2', 'parcial_cf', 'listo') then
    raise exception 'media_preparar_subida_cap: ese archivo ya fue confirmado.'
      using errcode = '42501';
  end if;
  if v_fila.estado = 'huerfano' then
    raise exception 'media_preparar_subida_cap: ese asset fue descartado.' using errcode = '42501';
  end if;
  if v_fila.estado not in ('pendiente', 'subiendo', 'error') then
    raise exception 'media_preparar_subida_cap: estado no admitido.' using errcode = '42501';
  end if;

  if v_fila.estado = 'error' then
    if not p_objeto_previo_ausente then
      return query select 'objeto_previo_presente'::text, v_fila.estado, v_fila.reserva_expira_en;
      return;
    end if;
    if v_fila.r2_key is not null and v_fila.r2_key <> p_r2_key then
      raise exception 'media_preparar_subida_cap: la clave ya estaba asignada y es otra.'
        using errcode = '42501';
    end if;

    update public.media_assets
       set r2_key = p_r2_key,
           estado = 'subiendo',
           reserva_expira_en = v_expira,
           error_en = null,
           error_detalle = null,
           r2_verificado_en = null,
           cf_image_id = null,
           cf_verificado_en = null
     where id = p_asset_id;

    return query select 'reintentada'::text, 'subiendo'::text, v_expira;
    return;
  end if;

  if v_fila.r2_key is not null then
    if v_fila.r2_key = p_r2_key then
      update public.media_assets
         set estado = 'subiendo', reserva_expira_en = v_expira
       where id = p_asset_id;
      return query select 'reutilizada'::text, 'subiendo'::text, v_expira;
      return;
    end if;
    raise exception 'media_preparar_subida_cap: la clave ya estaba asignada y es otra.'
      using errcode = '42501';
  end if;

  update public.media_assets
     set r2_key = p_r2_key, estado = 'subiendo', reserva_expira_en = v_expira
   where id = p_asset_id;

  return query select 'asignada'::text, 'subiendo'::text, v_expira;
end;
$$;

revoke all on function public.media_preparar_subida_cap(text, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.media_preparar_subida_cap(text, uuid, text, boolean)
  to service_role;

-- ------------------------------------------------------------
-- 6. Tomar el lease de confirmación con una capacidad
--
-- Gemela de `media_tomar_confirmacion` (0112), con dos diferencias
-- además de la autorización:
--
--   · admite TODAS las entidades, porque el alcance de este flujo lo
--     fija la capacidad (que solo se emite para álbum y comprobante) y
--     no una lista dentro de la función;
--
--   · devuelve `solo_r2`, que es lo que le dice al endpoint si tiene
--     que importar a Cloudflare o terminar ahí mismo. Lo decide la
--     BASE y no TypeScript: es la misma regla que sostiene el CHECK.
-- ------------------------------------------------------------

create or replace function public.media_tomar_confirmacion_cap(
  p_token_hash text,
  p_asset_id   uuid
)
returns table (
  codigo           text,
  lease            uuid,
  estado           text,
  entity_type      text,
  entity_id        uuid,
  visibilidad      text,
  mime             text,
  bytes            bigint,
  r2_key           text,
  r2_verificado_en timestamptz,
  cf_image_id      text,
  cf_verificado_en timestamptz,
  solo_r2          boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila   public.media_assets%rowtype;
  v_aut    record;
  v_lease  uuid;
  v_expira timestamptz := now() + interval '10 minutes';
begin
  if p_asset_id is null then
    raise exception 'media_tomar_confirmacion_cap: parámetros inválidos.' using errcode = '22023';
  end if;

  -- La autorización va PRIMERO, antes de leer una sola columna interna.
  select * into v_aut from public.media_capacidad_de_asset(p_token_hash, p_asset_id);
  if v_aut.codigo <> 'ok' then
    return query select v_aut.codigo, null::uuid, null::text, null::text, null::uuid,
      null::text, null::text, null::bigint, null::text, null::timestamptz,
      null::text, null::timestamptz, null::boolean;
    return;
  end if;

  select * into v_fila
    from public.media_assets m
   where m.id = p_asset_id
   for update;

  if not found or v_fila.deleted_at is not null then
    raise exception 'media_tomar_confirmacion_cap: el asset no existe.' using errcode = '22023';
  end if;

  -- Solo el flujo nuevo, y solo con clave asignada. ANTES de `ya_listo`,
  -- por lo mismo que en la 0112: una fila legacy en 'listo' no tiene por
  -- qué recibir sus columnas internas por este camino.
  if v_fila.solicitud_id is null or v_fila.r2_key is null then
    return query select 'no_confirmable'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::boolean;
    return;
  end if;

  if v_fila.estado = 'listo' then
    return query select 'ya_listo'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      v_fila.r2_key, v_fila.r2_verificado_en, v_fila.cf_image_id, v_fila.cf_verificado_en,
      public.media_solo_r2(v_fila.entity_type, v_fila.mime);
    return;
  end if;

  if v_fila.estado not in ('subiendo', 'parcial_r2') then
    return query select 'estado_no_confirmable'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::boolean;
    return;
  end if;

  if v_fila.estado = 'subiendo'
     and v_fila.r2_verificado_en is null
     and v_fila.reserva_expira_en is not null
     and v_fila.reserva_expira_en <= now() then
    return query select 'reserva_vencida'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::boolean;
    return;
  end if;

  if v_fila.confirmacion_lease is not null and v_fila.confirmacion_expira_en > now() then
    return query select 'en_curso'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::boolean;
    return;
  end if;

  if v_fila.limpieza_lease is not null and v_fila.limpieza_expira_en > now() then
    return query select 'limpieza_en_curso'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::boolean;
    return;
  end if;

  v_lease := gen_random_uuid();

  update public.media_assets
     set confirmacion_lease = v_lease,
         confirmacion_expira_en = v_expira,
         limpieza_lease = null,
         limpieza_expira_en = null
   where id = p_asset_id;

  return query select 'tomado'::text, v_lease, v_fila.estado,
    v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
    v_fila.r2_key, v_fila.r2_verificado_en, v_fila.cf_image_id, v_fila.cf_verificado_en,
    public.media_solo_r2(v_fila.entity_type, v_fila.mime);
end;
$$;

revoke all on function public.media_tomar_confirmacion_cap(text, uuid)
  from public, anon, authenticated;
grant execute on function public.media_tomar_confirmacion_cap(text, uuid) to service_role;

-- ------------------------------------------------------------
-- 7. Registrar el sello de R2 (imágenes que sí van a Cloudflare)
--
-- Gemela de `media_registrar_r2`. La fecha la pone la base, el lease
-- tiene que estar vigente y la idempotencia no reescribe el sello.
-- ------------------------------------------------------------

create or replace function public.media_registrar_r2_cap(
  p_token_hash text,
  p_asset_id   uuid,
  p_lease      uuid
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.media_assets%rowtype;
  v_aut  record;
begin
  if p_asset_id is null or p_lease is null then
    raise exception 'media_registrar_r2_cap: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_aut from public.media_capacidad_de_asset(p_token_hash, p_asset_id);
  if v_aut.codigo <> 'ok' then
    return query select v_aut.codigo, null::text;
    return;
  end if;

  select * into v_fila from public.media_assets m where m.id = p_asset_id for update;

  if not found or v_fila.deleted_at is not null then
    raise exception 'media_registrar_r2_cap: el asset no existe.' using errcode = '22023';
  end if;

  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  if v_fila.r2_key is null then
    raise exception 'media_registrar_r2_cap: el asset no tiene clave de R2.' using errcode = '22023';
  end if;

  -- Un R2-only NO pasa por acá: `parcial_r2` exige `mime like image/%`
  -- (0110) y, para lo privado, quedarse en parcial sería quedarse a
  -- medias de un camino que no tiene segunda mitad. Va por
  -- `media_finalizar_r2_cap`.
  if public.media_solo_r2(v_fila.entity_type, v_fila.mime) then
    return query select 'es_solo_r2'::text, v_fila.estado;
    return;
  end if;

  if v_fila.estado not in ('subiendo', 'parcial_r2') then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  if v_fila.r2_verificado_en is not null then
    return query select 'reutilizada'::text, v_fila.estado;
    return;
  end if;

  update public.media_assets
     set r2_verificado_en = now(), estado = 'parcial_r2'
   where id = p_asset_id;

  return query select 'registrada'::text, 'parcial_r2'::text;
end;
$$;

revoke all on function public.media_registrar_r2_cap(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_registrar_r2_cap(text, uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- 8. Terminar SIN Cloudflare — el corazón de esta migración
--
-- De `subiendo` a `listo` en una sola transacción, escribiendo el sello
-- de R2. NO pasa por `parcial_r2`: para un archivo que no lleva copia
-- visual, "el original está y la copia no" no describe nada — no hay
-- segunda mitad que esperar, y dejarlo ahí sería inventar un estado
-- intermedio que ningún reintento puede cerrar.
--
-- Se admite también entrar desde `parcial_r2` por si un asset llegó ahí
-- por otro camino (un cambio de entidad, una fila arreglada a mano): en
-- ese caso el sello ya está y solo se sube el estado.
--
-- Se niega en redondo si el archivo NO es R2-only: una foto de álbum
-- que terminara por acá quedaría `listo` sin copia visual, y la galería
-- pediría una variante que no existe. Es la traducción exacta de "no
-- fuerces esos archivos por media_finalizar_cloudflare", en la
-- dirección contraria.
--
-- Existe en dos versiones —por capacidad y por actor— porque las dos
-- van a hacer falta: hoy la anónima cierra los comprobantes, y la de
-- actor es la que va a cerrar video, audio y las verificaciones cuando
-- entren al flujo autenticado. La lógica vive una sola vez, en
-- `media_finalizar_r2_interno`.
-- ------------------------------------------------------------

create or replace function public.media_finalizar_r2_interno(
  p_asset_id uuid,
  p_lease    uuid
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.media_assets%rowtype;
begin
  select * into v_fila from public.media_assets m where m.id = p_asset_id for update;

  if not found or v_fila.deleted_at is not null then
    raise exception 'media_finalizar_r2: el asset no existe.' using errcode = '22023';
  end if;

  -- Idempotente ANTES de mirar el lease: una confirmación repetida sobre
  -- algo ya terminado no es un error, y su lease ya fue liberado.
  if v_fila.estado = 'listo' and v_fila.r2_verificado_en is not null then
    return query select 'reutilizada'::text, v_fila.estado;
    return;
  end if;

  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  if not public.media_solo_r2(v_fila.entity_type, v_fila.mime) then
    -- Una imagen pública sin copia visual no es un archivo terminado.
    return query select 'requiere_cloudflare'::text, v_fila.estado;
    return;
  end if;

  if v_fila.r2_key is null then
    raise exception 'media_finalizar_r2: el asset no tiene clave de R2.' using errcode = '22023';
  end if;

  if v_fila.estado not in ('subiendo', 'parcial_r2') then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  -- El sello lo pone la base (`now()`), nunca quien llama, y solo si no
  -- estaba: la PRIMERA verificación es la que vale.
  update public.media_assets
     set r2_verificado_en = coalesce(r2_verificado_en, now()),
         estado = 'listo',
         confirmacion_lease = null,
         confirmacion_expira_en = null,
         error_en = null,
         error_detalle = null
   where id = p_asset_id;

  return query select 'finalizada'::text, 'listo'::text;
end;
$$;

revoke all on function public.media_finalizar_r2_interno(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_finalizar_r2_interno(uuid, uuid) to service_role;

create or replace function public.media_finalizar_r2_cap(
  p_token_hash text,
  p_asset_id   uuid,
  p_lease      uuid
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aut record;
begin
  if p_asset_id is null or p_lease is null then
    raise exception 'media_finalizar_r2_cap: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_aut from public.media_capacidad_de_asset(p_token_hash, p_asset_id);
  if v_aut.codigo <> 'ok' then
    return query select v_aut.codigo, null::text;
    return;
  end if;

  return query select * from public.media_finalizar_r2_interno(p_asset_id, p_lease);
end;
$$;

revoke all on function public.media_finalizar_r2_cap(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_finalizar_r2_cap(text, uuid, uuid) to service_role;

create or replace function public.media_finalizar_r2(
  p_actor    uuid,
  p_asset_id uuid,
  p_lease    uuid
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.media_assets%rowtype;
begin
  if p_actor is null or p_asset_id is null or p_lease is null then
    raise exception 'media_finalizar_r2: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_fila from public.media_assets m where m.id = p_asset_id;
  if not found or v_fila.deleted_at is not null then
    raise exception 'media_finalizar_r2: el asset no existe.' using errcode = '22023';
  end if;

  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_finalizar_r2: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  return query select * from public.media_finalizar_r2_interno(p_asset_id, p_lease);
end;
$$;

revoke all on function public.media_finalizar_r2(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_finalizar_r2(uuid, uuid, uuid) to service_role;

comment on function public.media_finalizar_r2(uuid, uuid, uuid) is
  'Cierra en `listo` un archivo que NO lleva copia en Cloudflare Images '
  '(video, audio, comprobantes y verificaciones). Escribe el sello de R2 y '
  'sube el estado en una sola transacción, sin pasar por parcial_r2. Se '
  'niega si el archivo SÍ requiere Cloudflare.';

-- ------------------------------------------------------------
-- 9. Finalizar con Cloudflare, autorizando por capacidad
--
-- Gemela de `media_finalizar_cloudflare`. Se conserva el advisory lock
-- de ENTIDAD —misma clave y mismo orden que `media_reservar` y
-- `media_reservar_con_capacidad`— porque el cupo del álbum se decide
-- bajo ese lock.
--
-- El bloque de reemplazo de la 0112 NO se replica: una capacidad no
-- puede reemplazar nada (`media_reservar_con_capacidad` no acepta
-- `p_reemplaza_asset_id`), así que acá esa rama sería código muerto.
-- Se comprueba explícitamente y se rechaza, en vez de ignorarlo.
-- ------------------------------------------------------------

create or replace function public.media_finalizar_cloudflare_cap(
  p_token_hash  text,
  p_asset_id    uuid,
  p_lease       uuid,
  p_cf_image_id text
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.media_assets%rowtype;
  v_aut  record;
  v_cf   text := btrim(coalesce(p_cf_image_id, ''));
begin
  if p_asset_id is null or p_lease is null then
    raise exception 'media_finalizar_cloudflare_cap: parámetros inválidos.' using errcode = '22023';
  end if;
  if v_cf = '' then
    raise exception 'media_finalizar_cloudflare_cap: falta el id de Cloudflare.'
      using errcode = '22023';
  end if;

  select * into v_aut from public.media_capacidad_de_asset(p_token_hash, p_asset_id);
  if v_aut.codigo <> 'ok' then
    return query select v_aut.codigo, null::text;
    return;
  end if;

  -- Lectura sin bloquear, solo para saber de qué entidad es y tomar el
  -- advisory lock en el orden correcto (entidad primero, siempre).
  select * into v_fila from public.media_assets m where m.id = p_asset_id;
  if not found or v_fila.deleted_at is not null then
    raise exception 'media_finalizar_cloudflare_cap: el asset no existe.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('media:entidad:' || v_fila.entity_type || ':' || v_fila.entity_id::text, 0)
  );

  select * into v_fila from public.media_assets m where m.id = p_asset_id for update;
  if not found or v_fila.deleted_at is not null then
    raise exception 'media_finalizar_cloudflare_cap: el asset no existe.' using errcode = '22023';
  end if;

  -- Idempotente con el MISMO id; con otro se rechaza, porque
  -- significaría dos imágenes en Cloudflare para un solo asset y una
  -- quedaría huérfana sin que nadie lo sepa.
  if v_fila.estado = 'listo' and v_fila.cf_image_id is not null then
    if v_fila.cf_image_id = v_cf then
      return query select 'reutilizada'::text, v_fila.estado;
      return;
    end if;
    raise exception 'media_finalizar_cloudflare_cap: ya tiene otra imagen de Cloudflare.'
      using errcode = '42501';
  end if;

  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  -- Un R2-only jamás llega acá: la restricción
  -- `media_assets_privado_sin_cloudflare` lo impediría igual, pero
  -- fallar con un código propio es mejor que con una violación de CHECK.
  if public.media_solo_r2(v_fila.entity_type, v_fila.mime) then
    return query select 'es_solo_r2'::text, v_fila.estado;
    return;
  end if;

  -- Una capacidad no reemplaza fotos. Si aparece un reemplazo acá, algo
  -- se armó por un camino que no es este.
  if v_fila.reemplaza_asset_id is not null then
    return query select 'reemplazo_no_admitido'::text, v_fila.estado;
    return;
  end if;

  if v_fila.estado <> 'parcial_r2' then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  if v_fila.r2_verificado_en is null then
    raise exception 'media_finalizar_cloudflare_cap: falta la verificación de R2.'
      using errcode = '42501';
  end if;

  update public.media_assets
     set cf_image_id = v_cf,
         cf_verificado_en = now(),
         estado = 'listo',
         confirmacion_lease = null,
         confirmacion_expira_en = null,
         error_en = null,
         error_detalle = null
   where id = p_asset_id;

  return query select 'finalizada'::text, 'listo'::text;
end;
$$;

revoke all on function public.media_finalizar_cloudflare_cap(text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.media_finalizar_cloudflare_cap(text, uuid, uuid, text)
  to service_role;

-- ------------------------------------------------------------
-- 10. Liberar y rechazar, con capacidad
--
-- `liberar` es para el fallo TEMPORAL de Cloudflare: no borra nada ni
-- quita el sello —el original está verificado y sigue estándolo—, solo
-- suelta el lease para que un reintento salte directo a la importación.
--
-- `rechazar` es para los metadatos que no coinciden o la firma
-- incompatible. NO afirma que el objeto se borró de R2: eso pasa fuera
-- de Postgres y puede fallar, así que `r2_key` SE CONSERVA para que el
-- worker pueda reintentar el borrado.
-- ------------------------------------------------------------

create or replace function public.media_liberar_confirmacion_cap(
  p_token_hash text,
  p_asset_id   uuid,
  p_lease      uuid
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.media_assets%rowtype;
  v_aut  record;
begin
  if p_asset_id is null or p_lease is null then
    raise exception 'media_liberar_confirmacion_cap: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_aut from public.media_capacidad_de_asset(p_token_hash, p_asset_id);
  if v_aut.codigo <> 'ok' then
    return query select v_aut.codigo, null::text;
    return;
  end if;

  select * into v_fila from public.media_assets m where m.id = p_asset_id for update;
  if not found then
    raise exception 'media_liberar_confirmacion_cap: el asset no existe.' using errcode = '22023';
  end if;

  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  if v_fila.r2_verificado_en is null then
    raise exception 'media_liberar_confirmacion_cap: no hay verificación de R2 que conservar.'
      using errcode = '42501';
  end if;

  if v_fila.estado <> 'parcial_r2' then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  update public.media_assets
     set confirmacion_lease = null, confirmacion_expira_en = null
   where id = p_asset_id;

  return query select 'liberada'::text, 'parcial_r2'::text;
end;
$$;

revoke all on function public.media_liberar_confirmacion_cap(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_liberar_confirmacion_cap(text, uuid, uuid) to service_role;

create or replace function public.media_rechazar_confirmacion_cap(
  p_token_hash text,
  p_asset_id   uuid,
  p_lease      uuid,
  p_codigo     text,
  p_detalle    text
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila  public.media_assets%rowtype;
  v_aut   record;
  v_texto text := left(
    btrim(coalesce(p_codigo, 'desconocido')) || ': ' || btrim(coalesce(p_detalle, '')),
    500
  );
begin
  if p_asset_id is null or p_lease is null then
    raise exception 'media_rechazar_confirmacion_cap: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_aut from public.media_capacidad_de_asset(p_token_hash, p_asset_id);
  if v_aut.codigo <> 'ok' then
    return query select v_aut.codigo, null::text;
    return;
  end if;

  select * into v_fila from public.media_assets m where m.id = p_asset_id for update;
  if not found then
    raise exception 'media_rechazar_confirmacion_cap: el asset no existe.' using errcode = '22023';
  end if;

  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  if v_fila.estado not in ('subiendo', 'parcial_r2') then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  update public.media_assets
     set estado = 'error',
         error_en = now(),
         error_detalle = v_texto,
         r2_verificado_en = null,
         cf_image_id = null,
         cf_verificado_en = null,
         confirmacion_lease = null,
         confirmacion_expira_en = null
   where id = p_asset_id;

  return query select 'rechazada'::text, 'error'::text;
end;
$$;

revoke all on function public.media_rechazar_confirmacion_cap(text, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.media_rechazar_confirmacion_cap(text, uuid, uuid, text, text)
  to service_role;

-- ------------------------------------------------------------
-- 11. Soltar el lease sin haber tocado nada
--
-- `media_liberar_confirmacion` (0112) exige `parcial_r2` y sello de R2
-- puesto: sirve para el fallo de Cloudflare, que ocurre con el original
-- ya verificado. Pero hay un caso ANTERIOR que no cubre.
--
-- El endpoint toma el lease y lo primero que hace es un HEAD contra R2.
-- Si el objeto todavía no está —el navegador confirmó un instante antes
-- de que terminara el PUT, o la subida se cortó— no pasó nada que haya
-- que deshacer: no hay sello, no hay imagen, no hay nada escrito. Lo
-- correcto es devolver el lease en el acto.
--
-- Sin esta función, ese caso dejaba el asset bloqueado los 10 minutos
-- del lease. Rechazarlo con `media_rechazar_confirmacion` sería peor:
-- lo mandaría a `error` por una carrera de milisegundos, obligando a
-- pedir una sesión nueva.
--
-- Solo suelta si NO se selló nada. Un lease sobre algo ya verificado no
-- se toca por acá.
-- ------------------------------------------------------------

create or replace function public.media_soltar_lease_interno(
  p_asset_id uuid,
  p_lease    uuid
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.media_assets%rowtype;
begin
  select * into v_fila from public.media_assets m where m.id = p_asset_id for update;

  if not found then
    raise exception 'media_soltar_lease: el asset no existe.' using errcode = '22023';
  end if;

  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  -- Con algo ya sellado, soltar por acá escondería trabajo hecho: para
  -- eso está `media_liberar_confirmacion`, que exige el sello.
  if v_fila.r2_verificado_en is not null or v_fila.cf_verificado_en is not null then
    return query select 'ya_hay_sello'::text, v_fila.estado;
    return;
  end if;

  if v_fila.estado <> 'subiendo' then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  update public.media_assets
     set confirmacion_lease = null, confirmacion_expira_en = null
   where id = p_asset_id;

  return query select 'soltado'::text, v_fila.estado;
end;
$$;

revoke all on function public.media_soltar_lease_interno(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_soltar_lease_interno(uuid, uuid) to service_role;

create or replace function public.media_soltar_lease_cap(
  p_token_hash text,
  p_asset_id   uuid,
  p_lease      uuid
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aut record;
begin
  if p_asset_id is null or p_lease is null then
    raise exception 'media_soltar_lease_cap: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_aut from public.media_capacidad_de_asset(p_token_hash, p_asset_id);
  if v_aut.codigo <> 'ok' then
    return query select v_aut.codigo, null::text;
    return;
  end if;

  return query select * from public.media_soltar_lease_interno(p_asset_id, p_lease);
end;
$$;

revoke all on function public.media_soltar_lease_cap(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_soltar_lease_cap(text, uuid, uuid) to service_role;

create or replace function public.media_soltar_lease(
  p_actor    uuid,
  p_asset_id uuid,
  p_lease    uuid
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.media_assets%rowtype;
begin
  if p_actor is null or p_asset_id is null or p_lease is null then
    raise exception 'media_soltar_lease: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_fila from public.media_assets m where m.id = p_asset_id;
  if not found then
    raise exception 'media_soltar_lease: el asset no existe.' using errcode = '22023';
  end if;

  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_soltar_lease: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  return query select * from public.media_soltar_lease_interno(p_asset_id, p_lease);
end;
$$;

revoke all on function public.media_soltar_lease(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_soltar_lease(uuid, uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- 12. Anotar una incidencia sin destruir estado válido
--
-- El caso que obliga a que esto exista: Cloudflare CREA la imagen, y el
-- `UPDATE` que la iba a registrar falla (lease vencido entremedio,
-- caída de la base). Queda una imagen en Cloudflare que `media_assets`
-- no referencia — invisible, y facturable para siempre.
--
-- La compensación normal es borrarla. Pero el borrado también puede
-- fallar, y ahí hace falta que ese id quede ESCRITO en algún lado.
--
-- No sirve `media_rechazar_confirmacion`: además de anotar, manda el
-- asset a `error` y borra `r2_verificado_en`. Aplicarlo acá tiraría un
-- original ya verificado —obligando a resubir el archivo entero— por un
-- problema que no tiene nada que ver con el original.
--
-- Esta función solo ESCRIBE el texto. No toca `estado`, ni los sellos,
-- ni el lease. Es deliberadamente incapaz de romper nada.
-- ------------------------------------------------------------

create or replace function public.media_anotar_incidencia(
  p_asset_id uuid,
  p_detalle  text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_asset_id is null or btrim(coalesce(p_detalle, '')) = '' then
    return false;
  end if;

  update public.media_assets m
     set error_detalle = left(
           case
             when m.error_detalle is null or btrim(m.error_detalle) = '' then btrim(p_detalle)
             else m.error_detalle || ' | ' || btrim(p_detalle)
           end,
           2000
         )
   where m.id = p_asset_id;

  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function public.media_anotar_incidencia(uuid, text)
  from public, anon, authenticated;
grant execute on function public.media_anotar_incidencia(uuid, text) to service_role;

comment on function public.media_anotar_incidencia(uuid, text) is
  'Deja constancia de una incidencia (por ejemplo, una imagen huérfana en '
  'Cloudflare que no se pudo borrar) SIN tocar estado, sellos ni lease. No '
  'usar media_rechazar_confirmacion para esto: descarta el sello de R2 y '
  'obliga a resubir un original que estaba bien.';

-- ------------------------------------------------------------
-- 13. `media_tomar_confirmacion` también tiene que decir `solo_r2`
--
-- La versión de la 0112 devuelve el estado, la entidad, el MIME, la
-- clave y los sellos — pero no si el archivo lleva copia visual ni cuál
-- es su visibilidad. Sin esas dos columnas, el endpoint tendría que
-- deducirlas del lado de TypeScript, y ahí aparecen los dos problemas
-- que este archivo viene evitando:
--
--   · `solo_r2` es la MISMA regla que sostiene el CHECK de `listo`.
--     Reimplementarla en TypeScript significa dos copias que se
--     desincronizan, y la que decide de verdad es la de la base: el
--     endpoint terminaría intentando una transición que el CHECK
--     rechaza. Sin esto, `media_finalizar_r2` —la función por la que se
--     nombró esta migración— sería inalcanzable desde el camino
--     autenticado: video, audio y las verificaciones nunca podrían
--     cerrarse.
--
--   · `visibilidad` decide si la imagen se sirve firmada. Deducirla de
--     una tabla de constantes en vez de leer la FILA significa que una
--     fila cuya visibilidad se cambió a mano se entregaría con el
--     criterio viejo. En un álbum eso es una URL abierta donde tenía
--     que haber uNA firmada.
--
-- `create or replace` NO sirve acá: Postgres no deja cambiar el tipo de
-- retorno de una función existente. Hay que soltarla y volver a
-- crearla, que es seguro porque ningún endpoint la llamaba todavía.
-- Todo lo demás —los códigos, el orden de las comprobaciones, los
-- estados admitidos— queda EXACTAMENTE igual que en la 0112.
-- ------------------------------------------------------------

drop function if exists public.media_tomar_confirmacion(uuid, uuid);

create function public.media_tomar_confirmacion(
  p_actor    uuid,
  p_asset_id uuid
)
returns table (
  codigo             text,
  lease              uuid,
  estado             text,
  entity_type        text,
  entity_id          uuid,
  visibilidad        text,
  mime               text,
  bytes              bigint,
  r2_key             text,
  r2_verificado_en   timestamptz,
  cf_image_id        text,
  cf_verificado_en   timestamptz,
  reemplaza_asset_id uuid,
  solo_r2            boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila   public.media_assets%rowtype;
  v_lease  uuid;
  v_expira timestamptz := now() + interval '10 minutes';
begin
  if p_actor is null or p_asset_id is null then
    raise exception 'media_tomar_confirmacion: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_fila
    from public.media_assets m
   where m.id = p_asset_id
   for update;

  if not found or v_fila.deleted_at is not null then
    raise exception 'media_tomar_confirmacion: el asset no existe.' using errcode = '22023';
  end if;

  if v_fila.entity_type not in ('rancho', 'rancho_item', 'equipo') then
    raise exception 'media_tomar_confirmacion: entidad fuera del alcance.' using errcode = '0A000';
  end if;

  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_tomar_confirmacion: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  if v_fila.solicitud_id is null or v_fila.solicitante_id is null or v_fila.r2_key is null then
    return query select 'no_confirmable'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid, null::boolean;
    return;
  end if;

  if v_fila.estado = 'listo' then
    return query select 'ya_listo'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      v_fila.r2_key, v_fila.r2_verificado_en, v_fila.cf_image_id,
      v_fila.cf_verificado_en, v_fila.reemplaza_asset_id,
      public.media_solo_r2(v_fila.entity_type, v_fila.mime);
    return;
  end if;

  if v_fila.estado not in ('subiendo', 'parcial_r2') then
    return query select 'estado_no_confirmable'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid, null::boolean;
    return;
  end if;

  if v_fila.estado = 'subiendo'
     and v_fila.r2_verificado_en is null
     and v_fila.reserva_expira_en is not null
     and v_fila.reserva_expira_en <= now() then
    return query select 'reserva_vencida'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid, null::boolean;
    return;
  end if;

  if v_fila.confirmacion_lease is not null and v_fila.confirmacion_expira_en > now() then
    return query select 'en_curso'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid, null::boolean;
    return;
  end if;

  if v_fila.limpieza_lease is not null and v_fila.limpieza_expira_en > now() then
    return query select 'limpieza_en_curso'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid, null::boolean;
    return;
  end if;

  v_lease := gen_random_uuid();

  update public.media_assets
     set confirmacion_lease = v_lease,
         confirmacion_expira_en = v_expira,
         limpieza_lease = null,
         limpieza_expira_en = null
   where id = p_asset_id;

  return query select 'tomado'::text, v_lease, v_fila.estado,
    v_fila.entity_type, v_fila.entity_id, v_fila.visibilidad, v_fila.mime, v_fila.bytes,
    v_fila.r2_key, v_fila.r2_verificado_en, v_fila.cf_image_id,
    v_fila.cf_verificado_en, v_fila.reemplaza_asset_id,
    public.media_solo_r2(v_fila.entity_type, v_fila.mime);
end;
$$;

revoke all on function public.media_tomar_confirmacion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_tomar_confirmacion(uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- 14. Revocar una capacidad
--
-- Cuando una tanda termina —o cuando el endpoint detecta abuso— la
-- capacidad deja de valer aunque le queden minutos. No se borra la
-- fila: sirve para auditar cuántos usos llegó a gastar.
-- ------------------------------------------------------------

create or replace function public.media_revocar_capacidad(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  update public.media_capacidades c
     set revocada = true
   where c.token_hash = p_token_hash and not c.revocada;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function public.media_revocar_capacidad(text) from public, anon, authenticated;
grant execute on function public.media_revocar_capacidad(text) to service_role;

notify pgrst, 'reload schema';
