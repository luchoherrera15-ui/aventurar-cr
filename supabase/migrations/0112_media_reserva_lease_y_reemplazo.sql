-- ============================================================
-- BOOKEA MEDIA — 3.1A: reserva atómica, leases y reemplazo (0112)
--
-- La 0110 creó `media_assets` y la 0111 la cerró con RLS. Faltaba lo
-- que hace que DOS peticiones simultáneas no se pisen, que es el único
-- problema que no se puede resolver desde TypeScript: entre leer y
-- escribir siempre hay una ventana.
--
-- Acá se agregan tres cosas:
--
--   1. RESERVA ATÓMICA. Autorización, cupo, posición e idempotencia en
--      una sola transacción, con `auth.uid()` adentro. `media_reservar`
--      es la ÚNICA función nueva que puede llamar `authenticated`, y
--      por eso revalida todo por su cuenta: alguien puede invocarla
--      directo desde Supabase sin pasar nunca por nuestro endpoint.
--
--   2. LEASES. Un `estado = 'subiendo'` dice que algo está en curso
--      pero no QUIÉN lo está haciendo. Dos `/confirmar` simultáneos
--      importarían dos veces la misma imagen a Cloudflare. Un lease con
--      dueño y vencimiento lo impide, y vence solo si el proceso muere.
--
--   3. REEMPLAZO. `rancho_item` y `equipo` tienen UNA foto. Sin
--      reemplazo no podrían cambiarla nunca: para subir la nueva habría
--      que borrar la vieja primero y quedarse sin foto si algo falla.
--
-- ── ALCANCE DE 3.1A ──────────────────────────────────────────────────
--
--   Entidades: rancho (8 fotos), rancho_item (1), equipo (1).
--   MIME: las seis imágenes aprobadas.
--   Todo lo demás —álbumes, comprobantes, invitaciones, verificaciones,
--   video y audio— sigue en el flujo legacy de Supabase Storage. Es
--   TEMPORAL: el bloque siguiente es el token compartido de álbumes.
--
-- ── DOS RELOJES QUE NO SE PUEDEN CONFUNDIR ───────────────────────────
--
--   `solicitante_id`  QUIÉN pidió la reserva (auth.uid()). Es el actor.
--   `propietario_id`  el DUEÑO de la entidad, derivado por el trigger
--                     de la 0110.
--
-- No son lo mismo y confundirlos rompe el límite antiabuso: un admin
-- que sube al negocio de un tercero tiene `propietario_id` del tercero.
-- El tope global de 20 se cuenta SIEMPRE por `solicitante_id`.
--
-- ── ⛔ BLOQUEO DE PRODUCCIÓN: EL BACKFILL ────────────────────────────
--
-- El conteo de cupo de `media_reservar` mira SOLO `media_assets`. Hoy
-- las fotos de un negocio viven en `ranchos.fotos`, `ranchos.foto_url`,
-- `ranchos.foto_presentacion`, `rancho_items.foto_url` y
-- `equipo_rancho.foto_url`, y NO están representadas acá.
--
-- Mientras eso siga así, un rancho con 8 fotos legacy podría reservar 8
-- más: 16 en total. Por eso los endpoints /api/media/* NO SE HABILITAN
-- EN PRODUCCIÓN hasta que el backfill represente la media legacy en
-- esta tabla.
--
-- Y no: esta función NO va a contar `ranchos.fotos` ni `foto_url`. Esas
-- tres columnas guardan URLs que se repiten entre sí (la portada está a
-- la vez en `foto_url` y dentro de `fotos`), así que contarlas exigiría
-- deduplicar en SQL, en el camino crítico de la reserva, con una lógica
-- que habría que desmontar después.
--
-- ── WRITE-ONCE (no se implementa acá) ────────────────────────────────
--
-- `r2_key` se considera de ESCRITURA ÚNICA. La API firma el PUT con
-- `If-None-Match: *`, así que el primer PUT crea el objeto y cualquier
-- repetición contra esa clave devuelve 412. Eso es lo que permite
-- sellar `r2_verificado_en` con la certeza de que el objeto no va a
-- cambiar después. Vive en `src/lib/media/r2.ts`, no acá.
--
-- ── SEGURA DE VOLVER A APLICAR ───────────────────────────────────────
--
-- Todo es `add column if not exists`, `create or replace`,
-- `drop constraint if exists` y `create index if not exists`. No hay un
-- solo DDL que pueda perder datos.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas nuevas
--
-- Todas anulables y sin valor por defecto: las filas históricas y las
-- que traiga el backfill se quedan en null y no pasan por este flujo.
-- ------------------------------------------------------------

-- Idempotencia de /api/media/sesion. Lo genera el CLIENTE: repetir la
-- misma petición (un reintento, un doble clic, una red mala) tiene que
-- devolver el mismo asset y volver a firmar su misma clave, no crear
-- otra fila con otro objeto en R2.
alter table public.media_assets add column if not exists solicitud_id uuid;

-- QUIÉN pidió la reserva. Ver "DOS RELOJES" arriba: NO es
-- `propietario_id`. Es el único campo con el que se puede contar el
-- tope global por actor, y el que impide que otro usuario reutilice un
-- `solicitud_id` ajeno.
alter table public.media_assets
  add column if not exists solicitante_id uuid
  references auth.users(id) on delete set null;

-- Hasta cuándo vale la reserva. Se alinea con la vida de la URL PUT
-- firmada (30 min). Pasado eso, la fila es candidata a limpieza.
alter table public.media_assets add column if not exists reserva_expira_en timestamptz;

-- Quién posee la confirmación en curso, y hasta cuándo.
alter table public.media_assets add column if not exists confirmacion_lease uuid;
alter table public.media_assets add column if not exists confirmacion_expira_en timestamptz;

-- Lo mismo para el worker de limpieza (que NO se implementa acá).
alter table public.media_assets add column if not exists limpieza_lease uuid;
alter table public.media_assets add column if not exists limpieza_expira_en timestamptz;

-- A qué asset viene a sustituir.
alter table public.media_assets
  add column if not exists reemplaza_asset_id uuid
  references public.media_assets(id) on delete set null;

-- ------------------------------------------------------------
-- 2. Restricciones
-- ------------------------------------------------------------

-- Un lease sin vencimiento no vence NUNCA: bloquearía el asset para
-- siempre. Y un vencimiento sin lease no identifica a nadie.
alter table public.media_assets drop constraint if exists media_assets_lease_confirmacion_par;
alter table public.media_assets add constraint media_assets_lease_confirmacion_par
  check ((confirmacion_lease is null) = (confirmacion_expira_en is null));

alter table public.media_assets drop constraint if exists media_assets_lease_limpieza_par;
alter table public.media_assets add constraint media_assets_lease_limpieza_par
  check ((limpieza_lease is null) = (limpieza_expira_en is null));

alter table public.media_assets drop constraint if exists media_assets_reemplazo_no_propio;
alter table public.media_assets add constraint media_assets_reemplazo_no_propio
  check (reemplaza_asset_id is null or reemplaza_asset_id <> id);

-- "solicitud_id obligatorio para lo que crea media_reservar" no se
-- puede escribir tal cual: la base no sabe qué función insertó una
-- fila. Lo que SÍ se puede atar es la marca del flujo nuevo.
alter table public.media_assets drop constraint if exists media_assets_reserva_con_solicitud;
alter table public.media_assets add constraint media_assets_reserva_con_solicitud
  check (reserva_expira_en is null or solicitud_id is not null);

-- La dirección de esta regla importa, y la primera versión la tenía al
-- revés: decía `solicitud_id is null or solicitante_id is not null`, o
-- sea "si hay solicitud tiene que haber solicitante".
--
-- Eso CONTRADICE el `on delete set null` de la columna. Al borrar una
-- cuenta, Postgres pone `solicitante_id = null` pero `solicitud_id`
-- sigue ahí, la restricción se viola y el DELETE sobre `auth.users`
-- FALLA. Una persona que pidió una reserva no podría darse de baja.
--
-- La dirección segura es la contraria: si hay solicitante, tiene que
-- haber solicitud. Vaciar el solicitante siempre es válido.
--
-- Que la fila quede huérfana no la deja disponible para nadie: la
-- comprobación de idempotencia usa `is distinct from auth.uid()`, y
-- `null is distinct from <uuid>` es TRUE, así que ningún otro actor
-- puede adueñarse de esa solicitud.
--
-- Se borra también el nombre viejo para que la migración siga siendo
-- reaplicable sobre una base donde ya se había creado la versión mala.
alter table public.media_assets drop constraint if exists media_assets_solicitud_con_solicitante;
alter table public.media_assets drop constraint if exists media_assets_solicitante_con_solicitud;
alter table public.media_assets add constraint media_assets_solicitante_con_solicitud
  check (solicitante_id is null or solicitud_id is not null);

-- Una reserva del flujo nuevo todavía en curso tiene que tener
-- vencimiento. Sin él, una fila abandonada en 'pendiente' no sería
-- nunca candidata a limpieza.
alter table public.media_assets drop constraint if exists media_assets_reserva_viva_con_vencimiento;
alter table public.media_assets add constraint media_assets_reserva_viva_con_vencimiento
  check (
    solicitud_id is null
    or estado not in ('pendiente', 'subiendo')
    or reserva_expira_en is not null
  );

-- ------------------------------------------------------------
-- 3. Índices
-- ------------------------------------------------------------

-- (1) IDEMPOTENCIA. Impide la doble reserva. Por entidad y no global,
-- para que un solicitud_id repetido contra OTRA entidad no colisione.
create unique index if not exists media_assets_solicitud_uk
  on public.media_assets (entity_type, entity_id, solicitud_id)
  where solicitud_id is not null;

-- (2) UN SOLO REEMPLAZO ACTIVO POR OBJETIVO. Sin esto, dos reemplazos
-- simultáneos de la misma foto marcarían el original borrado dos veces
-- y dejarían dos fotos nuevas donde cabe una.
create unique index if not exists media_assets_reemplazo_activo_uk
  on public.media_assets (reemplaza_asset_id)
  where reemplaza_asset_id is not null
    and deleted_at is null
    and estado not in ('error', 'huerfano');

-- (3) LA COLA DEL WORKER. Reservas vencidas que nunca se confirmaron.
create index if not exists media_assets_reserva_vencida_idx
  on public.media_assets (reserva_expira_en)
  where estado in ('pendiente', 'subiendo') and deleted_at is null;

-- (4) EL CONTEO DE CUPO. Corre con el advisory lock tomado, o sea en el
-- camino crítico de cada reserva.
create index if not exists media_assets_vivos_por_entidad_idx
  on public.media_assets (entity_type, entity_id)
  where deleted_at is null and estado not in ('error', 'huerfano');

-- (5) EL CONTEO ANTIABUSO, por ACTOR. Antes estaba por `propietario_id`
-- y era incorrecto: ese es el dueño de la entidad, no quien pidió la
-- reserva. Se reemplaza por `solicitante_id`.
drop index if exists public.media_assets_reservas_por_propietario_idx;
create index if not exists media_assets_reservas_por_solicitante_idx
  on public.media_assets (solicitante_id, reserva_expira_en)
  where estado in ('pendiente', 'subiendo') and deleted_at is null;

-- ------------------------------------------------------------
-- 4. Los dos advisory locks, y en qué ORDEN se toman
--
-- Hay DOS ámbitos de exclusión y no se pueden mezclar:
--
--   ENTIDAD  serializa las reservas de una misma galería. Protege el
--            cupo 8/1/1 y el cálculo de `posicion`.
--
--   ACTOR    serializa las reservas de una misma persona ENTRE
--            ENTIDADES DISTINTAS. Sin él, alguien con 19 reservas
--            activas dispara dos peticiones a la vez contra dos
--            negocios y las dos leen 19: pasan las dos y termina con
--            21. El lock de entidad no lo atrapa porque son entidades
--            distintas.
--
-- Se usan claves de 64 bits con `hashtextextended` y PREFIJOS
-- distintos. Ojo con lo que eso garantiza y lo que no: el prefijo hace
-- que las ENTRADAS de los dos ámbitos nunca coincidan, pero después del
-- hash siguen siendo dos números de 64 bits y una colisión es
-- matemáticamente posible. Lo que se compra es que sea
-- extraordinariamente improbable, no imposible. Si alguna vez chocaran,
-- el efecto sería una espera de más —dos operaciones sin relación
-- serializándose entre sí—, nunca una pérdida de exclusión.
--
-- ORDEN DE ADQUISICIÓN, SIEMPRE EL MISMO: entidad, después actor.
-- Un orden fijo es lo que evita el interbloqueo. Si una función tomara
-- actor→entidad y otra entidad→actor, dos transacciones cruzadas se
-- quedarían esperando para siempre. `media_finalizar_cloudflare` toma
-- solo el de entidad, que respeta el mismo orden por ser el primero.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 5. FUNCIÓN 1 — propiedad con un actor explícito
--
-- La 0111 tiene `media_puede_administrar(tipo, id)`, que usa
-- `auth.uid()`. Sirve mientras quien pregunta es el usuario, pero las
-- funciones de confirmación corren como `service_role`, donde
-- `auth.uid()` es NULL — y ahí esa función diría "no" a todo.
--
-- OJO con el admin: no se puede llamar a `public.is_admin()` (usa
-- `auth.uid()`), así que el rol se lee de `perfiles` CON EL ACTOR.
-- ------------------------------------------------------------

create or replace function public.media_puede_administrar_como(
  p_actor       uuid,
  p_entity_type text,
  p_entity_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_actor is not null
    and p_entity_id is not null
    and (
      exists (
        select 1 from public.perfiles p
         where p.id = p_actor and p.rol = 'admin'
      )
      or case p_entity_type

        when 'rancho' then exists (
          select 1 from public.ranchos r
           where r.id = p_entity_id and r.owner_id = p_actor
        )

        when 'rancho_item' then exists (
          select 1
            from public.rancho_items i
            join public.ranchos r on r.id = i.rancho_id
           where i.id = p_entity_id and r.owner_id = p_actor
        )

        when 'equipo' then exists (
          select 1
            from public.equipo_rancho e
            join public.ranchos r on r.id = e.rancho_id
           where e.id = p_entity_id and r.owner_id = p_actor
        )

        when 'album' then exists (
          select 1 from public.albumes a
           where a.id = p_entity_id
             and a.cliente_id is not null
             and a.cliente_id = p_actor
        )

        when 'invitacion' then exists (
          select 1 from public.invitaciones v
           where v.id = p_entity_id
             and v.cliente_id is not null
             and v.cliente_id = p_actor
        )

        when 'comprobante' then exists (
          select 1
            from public.reservas s
            join public.ranchos r on r.id = s.rancho_id
           where s.id = p_entity_id and r.owner_id = p_actor
        )

        -- Se exige la fila EN `verificacion_proveedores`, no solo el
        -- rancho: borrada la verificación, su media deja de ser
        -- administrable de inmediato.
        when 'verificacion' then exists (
          select 1
            from public.verificacion_proveedores vp
            join public.ranchos r on r.id = vp.rancho_id
           where vp.rancho_id = p_entity_id and r.owner_id = p_actor
        )

        else false
      end
    );
$$;

-- La de la 0111 pasa a delegar. `create or replace` NO modifica aquel
-- archivo: lo supersede en la base.
create or replace function public.media_puede_administrar(
  p_entity_type text,
  p_entity_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.media_puede_administrar_como(auth.uid(), p_entity_type, p_entity_id);
$$;

revoke all on function public.media_puede_administrar_como(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.media_puede_administrar_como(uuid, text, uuid) to service_role;

revoke all on function public.media_puede_administrar(text, uuid) from public, anon;
grant execute on function public.media_puede_administrar(text, uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 6. FUNCIÓN 2 — media_reservar
--
-- La ÚNICA función nueva que puede ejecutar `authenticated`, y por eso
-- la que más desconfía: cualquiera con una sesión puede llamarla
-- directo desde el SDK de Supabase, sin pasar por /api/media/sesion. Si
-- las validaciones vivieran solo en TypeScript, no existirían.
--
-- Es SECURITY DEFINER porque `authenticated` NO tiene INSERT sobre
-- `media_assets` (0111). Pero `auth.uid()` adentro sigue siendo el
-- usuario real: lo pone PostgREST desde el JWT, y SECURITY DEFINER
-- cambia los privilegios, no la identidad.
--
-- ORDEN, que no es negociable:
--   validar → propiedad → LOCK ENTIDAD → LOCK ACTOR → idempotencia →
--   reemplazo → límites → posición → insertar.
--
-- Los locks van ANTES de buscar `solicitud_id`. Al revés, dos
-- peticiones simultáneas leerían las dos "no existe" y competirían por
-- el INSERT; una ganaría y la otra chocaría contra el índice único con
-- un 23505 crudo.
-- ------------------------------------------------------------

create or replace function public.media_reservar(
  p_solicitud_id       uuid,
  p_entity_type        text,
  p_entity_id          uuid,
  p_mime               text,
  p_bytes              bigint,
  p_nombre_original    text,
  p_reemplaza_asset_id uuid default null
)
returns table (
  codigo             text,
  asset_id           uuid,
  posicion           integer,
  estado             text,
  reserva_expira_en  timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor      uuid := auth.uid();
  v_nombre     text := btrim(coalesce(p_nombre_original, ''));
  v_limite     integer;
  v_usados     integer;
  v_reservas   integer;
  v_posicion   integer;
  v_expira     timestamptz := now() + interval '30 minutes';
  v_previa     public.media_assets%rowtype;
  v_objetivo   public.media_assets%rowtype;
  v_nuevo_id   uuid;
begin
  -- ---------- 1. Validar ----------
  if v_actor is null then
    raise exception 'media_reservar: hace falta una sesión.' using errcode = '42501';
  end if;

  if p_solicitud_id is null then
    raise exception 'media_reservar: falta el identificador de solicitud.'
      using errcode = '22023';
  end if;

  -- Alcance de 3.1A. Las otras cuatro entidades existen en el sistema
  -- pero todavía no pasan por acá; el endpoint traduce esto a 422.
  if p_entity_type is null or p_entity_type not in ('rancho', 'rancho_item', 'equipo') then
    raise exception 'media_reservar: entidad fuera del alcance habilitado.'
      using errcode = '0A000';
  end if;

  if p_entity_id is null then
    raise exception 'media_reservar: falta la entidad.' using errcode = '22023';
  end if;

  if p_mime is null or p_mime not in (
    'image/jpeg', 'image/png', 'image/webp',
    'image/avif', 'image/heic', 'image/heif'
  ) then
    raise exception 'media_reservar: formato fuera del alcance habilitado.'
      using errcode = '0A000';
  end if;

  -- 10 MiB: el tope de Cloudflare Images, el mismo que
  -- MAX_BYTES_IMAGEN en src/lib/media/tipos.ts.
  if p_bytes is null or p_bytes <= 0 or p_bytes > 10485760 then
    raise exception 'media_reservar: tamaño inválido.' using errcode = '22023';
  end if;

  if v_nombre = '' or char_length(v_nombre) > 300 then
    raise exception 'media_reservar: nombre de archivo inválido.' using errcode = '22023';
  end if;

  -- ---------- 2. Propiedad ----------
  if not public.media_puede_administrar(p_entity_type, p_entity_id) then
    raise exception 'media_reservar: no se administra esa entidad.' using errcode = '42501';
  end if;

  -- ---------- 3. Locks, en el orden fijo: entidad y después actor ----------
  perform pg_advisory_xact_lock(
    hashtextextended('media:entidad:' || p_entity_type || ':' || p_entity_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('media:actor:' || v_actor::text, 0)
  );

  -- ---------- 4. Idempotencia ----------
  select * into v_previa
    from public.media_assets m
   where m.entity_type = p_entity_type
     and m.entity_id = p_entity_id
     and m.solicitud_id = p_solicitud_id;

  if found then
    -- Un `solicitud_id` pertenece a QUIEN lo pidió. Otro actor —otro
    -- admin del equipo, por ejemplo— no puede adueñarse de esa reserva
    -- reutilizando su identificador.
    if v_previa.solicitante_id is distinct from v_actor then
      raise exception 'media_reservar: ese identificador de solicitud es de otro usuario.'
        using errcode = '42501';
    end if;

    -- Misma solicitud, ¿mismo pedido? Si cambió algo, el cliente está
    -- reutilizando un identificador que ya significa otra cosa.
    if v_previa.mime is distinct from p_mime
       or v_previa.bytes is distinct from p_bytes
       or btrim(coalesce(v_previa.nombre_original, '')) is distinct from v_nombre
       or v_previa.reemplaza_asset_id is distinct from p_reemplaza_asset_id then
      return query select 'conflicto_solicitud'::text, v_previa.id, v_previa.posicion,
                          v_previa.estado, v_previa.reserva_expira_en;
      return;
    end if;

    return query select 'reutilizada'::text, v_previa.id, v_previa.posicion,
                        v_previa.estado, v_previa.reserva_expira_en;
    return;
  end if;

  -- ---------- 5. Reemplazo ----------
  if p_reemplaza_asset_id is not null then
    select * into v_objetivo
      from public.media_assets m
     where m.id = p_reemplaza_asset_id;

    if not found
       or v_objetivo.entity_type <> p_entity_type
       or v_objetivo.entity_id <> p_entity_id
       or v_objetivo.deleted_at is not null
       or v_objetivo.estado <> 'listo' then
      raise exception 'media_reservar: la foto que se quiere reemplazar no es válida.'
        using errcode = '22023';
    end if;

    -- El índice único lo garantiza igual, pero llegar acá con un
    -- mensaje claro es mejor que un 23505 crudo.
    if exists (
      select 1 from public.media_assets m
       where m.reemplaza_asset_id = p_reemplaza_asset_id
         and m.deleted_at is null
         and m.estado not in ('error', 'huerfano')
    ) then
      return query select 'reemplazo_en_curso'::text, null::uuid, null::integer,
                          null::text, null::timestamptz;
      return;
    end if;
  end if;

  -- ---------- 6. Límite de producto ----------
  -- rancho: 8 (FOTOS_MAX, src/app/mi-negocio/types.tsx).
  -- rancho_item y equipo: 1, porque su `foto_url` es UNA columna.
  v_limite := case p_entity_type when 'rancho' then 8 else 1 end;

  -- Cuenta lo que ocupa lugar de verdad. Un REEMPLAZO no suma: viene a
  -- ocupar el lugar de otro, no uno nuevo.
  select count(*) into v_usados
    from public.media_assets m
   where m.entity_type = p_entity_type
     and m.entity_id = p_entity_id
     and m.deleted_at is null
     and m.reemplaza_asset_id is null
     and (
       m.estado in ('listo', 'parcial_r2', 'parcial_cf')
       or (m.estado in ('pendiente', 'subiendo')
           and m.reserva_expira_en is not null
           and m.reserva_expira_en > now())
     );

  if p_reemplaza_asset_id is null and v_usados >= v_limite then
    return query select 'cupo_agotado'::text, null::uuid, null::integer,
                        null::text, null::timestamptz;
    return;
  end if;

  -- ---------- 7. Antiabuso, por ACTOR ----------
  -- Tope TÉCNICO, no comercial: /sesion firma URLs de escritura a R2 y
  -- crea filas, así que sin techo es un generador gratuito de ambas.
  --
  -- Se cuenta por `solicitante_id`, NUNCA por `propietario_id`: el
  -- segundo es el dueño de la entidad y para un admin que sube al
  -- negocio de un tercero no tiene nada que ver con quien pidió.
  --
  -- El lock de actor tomado arriba es lo que hace fiable este conteo
  -- entre entidades distintas.
  select count(*) into v_reservas
    from public.media_assets m
   where m.solicitante_id = v_actor
     and m.deleted_at is null
     and m.estado in ('pendiente', 'subiendo')
     and m.reserva_expira_en is not null
     and m.reserva_expira_en > now();

  if v_reservas >= 20 then
    return query select 'demasiadas_reservas'::text, null::uuid, null::integer,
                        null::text, null::timestamptz;
    return;
  end if;

  -- ---------- 8. Posición ----------
  if p_reemplaza_asset_id is not null then
    -- Hereda el lugar del que va a sustituir: la galería no se reordena
    -- por cambiar una foto.
    v_posicion := v_objetivo.posicion;
  else
    select coalesce(max(m.posicion) + 1, 0) into v_posicion
      from public.media_assets m
     where m.entity_type = p_entity_type
       and m.entity_id = p_entity_id
       and m.deleted_at is null;
  end if;

  -- ---------- 9. Insertar ----------
  -- `propietario_id` NO se pasa: lo deriva el trigger de la 0110 desde
  -- la entidad real. `visibilidad` se deriva acá y tampoco es
  -- parámetro: las tres entidades del piloto son públicas.
  insert into public.media_assets (
    entity_type, entity_id, visibilidad, estado,
    mime, bytes, nombre_original, posicion,
    solicitud_id, solicitante_id, reserva_expira_en, reemplaza_asset_id
  ) values (
    p_entity_type, p_entity_id, 'publica', 'pendiente',
    p_mime, p_bytes, v_nombre, v_posicion,
    p_solicitud_id, v_actor, v_expira, p_reemplaza_asset_id
  )
  returning id into v_nuevo_id;

  return query select 'creada'::text, v_nuevo_id, v_posicion,
                      'pendiente'::text, v_expira;
end;
$$;

revoke all on function public.media_reservar(uuid, text, uuid, text, bigint, text, uuid)
  from public, anon;
grant execute on function public.media_reservar(uuid, text, uuid, text, bigint, text, uuid)
  to authenticated;

-- ------------------------------------------------------------
-- 7. FUNCIÓN 3 — media_preparar_subida
--
-- Entre `media_reservar` y esta llamada, el servidor calculó la clave
-- de R2. Es una segunda ventana en la que el negocio pudo cambiar de
-- dueño, así que se revalida la propiedad ANTES de asignar nada.
--
-- La fila se bloquea con FOR UPDATE antes de mirarla: sin eso, entre el
-- SELECT y el UPDATE otra transacción puede cambiar el estado y esta
-- función escribiría sobre una realidad que ya no existe.
--
-- La clave es de ESCRITURA ÚNICA: una vez asignada, o se repite igual
-- (idempotente) o se rechaza.
-- ------------------------------------------------------------

create or replace function public.media_preparar_subida(
  p_actor              uuid,
  p_asset_id           uuid,
  p_r2_key             text,
  -- El servidor pone `true` SOLO después de comprobar con R2 que el
  -- objeto rechazado ya no existe. PostgreSQL no puede verificarlo —no
  -- habla con R2— y este es el único dato del que depende de quien
  -- llama. Por eso está aislado en su propio parámetro, con nombre
  -- explícito, en vez de escondido en una bandera genérica.
  p_objeto_previo_ausente boolean default false
)
returns table (codigo text, estado text, reserva_expira_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila   public.media_assets%rowtype;
  v_expira timestamptz := now() + interval '30 minutes';
begin
  if p_actor is null or p_asset_id is null or btrim(coalesce(p_r2_key, '')) = '' then
    raise exception 'media_preparar_subida: parámetros inválidos.' using errcode = '22023';
  end if;

  -- FOR UPDATE: cierra la ventana entre leer y escribir.
  select * into v_fila
    from public.media_assets m
   where m.id = p_asset_id
   for update;

  if not found or v_fila.deleted_at is not null then
    raise exception 'media_preparar_subida: el asset no existe.' using errcode = '22023';
  end if;

  if v_fila.entity_type not in ('rancho', 'rancho_item', 'equipo') then
    raise exception 'media_preparar_subida: entidad fuera del alcance.' using errcode = '0A000';
  end if;

  if v_fila.solicitud_id is null or v_fila.solicitante_id is null then
    raise exception 'media_preparar_subida: el asset no viene del flujo de reserva.'
      using errcode = '22023';
  end if;

  -- La revalidación que cierra la ventana de transferencia.
  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_preparar_subida: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  -- Con una limpieza en curso no se prepara ni se renueva nada: el
  -- worker puede estar por borrar el objeto que se iba a firmar.
  if v_fila.limpieza_lease is not null and v_fila.limpieza_expira_en > now() then
    return query select 'limpieza_en_curso'::text, v_fila.estado, v_fila.reserva_expira_en;
    return;
  end if;

  -- Estados admitidos, explícitos. Todo lo demás se rechaza por su
  -- nombre en vez de caer en un `else` genérico.
  if v_fila.estado in ('parcial_r2', 'parcial_cf', 'listo') then
    raise exception 'media_preparar_subida: ese archivo ya fue confirmado.'
      using errcode = '42501';
  end if;

  if v_fila.estado = 'huerfano' then
    raise exception 'media_preparar_subida: ese asset fue descartado.' using errcode = '42501';
  end if;

  if v_fila.estado not in ('pendiente', 'subiendo', 'error') then
    raise exception 'media_preparar_subida: estado no admitido.' using errcode = '42501';
  end if;

  -- ---------- Reintento desde 'error' ----------
  -- Solo si el servidor ya comprobó que el objeto rechazado no está en
  -- R2. Si siguiera ahí, el PUT firmado con If-None-Match daría 412 y
  -- el usuario vería un error sin sentido.
  if v_fila.estado = 'error' then
    if not p_objeto_previo_ausente then
      return query select 'objeto_previo_presente'::text, v_fila.estado, v_fila.reserva_expira_en;
      return;
    end if;

    -- La clave tiene que ser la misma: es de escritura única.
    if v_fila.r2_key is not null and v_fila.r2_key <> p_r2_key then
      raise exception 'media_preparar_subida: la clave ya estaba asignada y es otra.'
        using errcode = '42501';
    end if;

    -- Este era el bug: el UPDATE decía
    -- `case when estado = 'pendiente' then 'subiendo' else estado end`,
    -- así que una fila en 'error' se quedaba en 'error' mientras la
    -- función devolvía 'subiendo'. El servidor firmaba una URL para un
    -- asset que la base seguía teniendo por fallido.
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

  -- ---------- Ya tenía clave ----------
  if v_fila.r2_key is not null then
    if v_fila.r2_key = p_r2_key then
      -- Idempotente: se renueva la ventana y se devuelve el estado REAL
      -- en el que queda la fila.
      update public.media_assets
         set estado = 'subiendo',
             reserva_expira_en = v_expira
       where id = p_asset_id;
      return query select 'reutilizada'::text, 'subiendo'::text, v_expira;
      return;
    end if;
    raise exception 'media_preparar_subida: la clave ya estaba asignada y es otra.'
      using errcode = '42501';
  end if;

  -- ---------- Primera asignación ----------
  update public.media_assets
     set r2_key = p_r2_key,
         estado = 'subiendo',
         reserva_expira_en = v_expira
   where id = p_asset_id;

  return query select 'asignada'::text, 'subiendo'::text, v_expira;
end;
$$;

revoke all on function public.media_preparar_subida(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.media_preparar_subida(uuid, uuid, text, boolean) to service_role;

-- ------------------------------------------------------------
-- 8. FUNCIÓN 4 — media_tomar_confirmacion
--
-- Adquiere el lease ANTES de que el servidor gaste una sola llamada a
-- R2 o a Cloudflare. Si la propiedad cambió, se sabe acá y no después
-- de haber importado una imagen.
--
-- Devuelve las columnas internas que `authenticated` NO puede leer
-- (0111 no le concede SELECT sobre `r2_key` ni sobre los sellos), que
-- es justamente por lo que esta función existe.
--
-- ESTADOS ADMITIDOS: solo 'subiendo' y 'parcial_r2'.
-- 'parcial_cf' queda FUERA a propósito: el flujo del piloto es R2 y
-- después Cloudflare, así que un asset con la copia visual arriba y el
-- original no es un estado que este flujo pueda producir. Si se
-- admitiera, `media_registrar_r2` lo pasaría a 'parcial_r2' conservando
-- `cf_verificado_en`, y eso viola `media_assets_parcial_r2_coherente`
-- de la 0110, que exige `cf_verificado_en is null`.
--
-- La transacción termina al devolver: las llamadas a R2 y Cloudflare
-- ocurren DESPUÉS, con el lease como única exclusión. Mantener una
-- transacción abierta durante una llamada de red es cómo se agotan las
-- conexiones de la base.
-- ------------------------------------------------------------

create or replace function public.media_tomar_confirmacion(
  p_actor    uuid,
  p_asset_id uuid
)
returns table (
  codigo             text,
  lease              uuid,
  estado             text,
  entity_type        text,
  entity_id          uuid,
  mime               text,
  bytes              bigint,
  r2_key             text,
  r2_verificado_en   timestamptz,
  cf_image_id        text,
  cf_verificado_en   timestamptz,
  reemplaza_asset_id uuid
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

  -- FOR UPDATE: el claim del lease tiene que ser atómico contra otra
  -- confirmación Y contra el worker de limpieza.
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

  -- La propiedad se revalida ANTES de cualquier retorno que exponga
  -- datos internos, incluido el idempotente de 'ya_listo'.
  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_tomar_confirmacion: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  -- Solo el flujo nuevo, y solo con clave asignada.
  --
  -- Va ANTES de la rama `ya_listo` a propósito. Al revés, un asset
  -- LEGACY que estuviera en 'listo' —los que va a traer el backfill,
  -- sin `solicitud_id` ni `r2_key`— entraba por `ya_listo` y esta
  -- función le devolvía sus columnas internas. Este flujo no es el
  -- suyo: se lo rechaza antes de exponer nada.
  if v_fila.solicitud_id is null or v_fila.solicitante_id is null or v_fila.r2_key is null then
    return query select 'no_confirmable'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid;
    return;
  end if;

  -- Ya terminado: idempotente, y sin tomar lease. Acá ya se sabe que es
  -- del flujo nuevo y que quien pregunta administra la entidad.
  if v_fila.estado = 'listo' then
    return query select 'ya_listo'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.mime, v_fila.bytes,
      v_fila.r2_key, v_fila.r2_verificado_en, v_fila.cf_image_id,
      v_fila.cf_verificado_en, v_fila.reemplaza_asset_id;
    return;
  end if;

  if v_fila.estado not in ('subiendo', 'parcial_r2') then
    return query select 'estado_no_confirmable'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid;
    return;
  end if;

  -- Una reserva vencida que nunca llegó a confirmarse no se confirma
  -- tarde: su URL de subida ya no vale y el worker puede estar por
  -- limpiarla. Si R2 ya está sellado, en cambio, el vencimiento de la
  -- reserva es irrelevante — el objeto existe y está verificado.
  if v_fila.estado = 'subiendo'
     and v_fila.r2_verificado_en is null
     and v_fila.reserva_expira_en is not null
     and v_fila.reserva_expira_en <= now() then
    return query select 'reserva_vencida'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid;
    return;
  end if;

  -- Otra confirmación vigente.
  if v_fila.confirmacion_lease is not null and v_fila.confirmacion_expira_en > now() then
    return query select 'en_curso'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid;
    return;
  end if;

  -- LIMPIEZA VIGENTE: no se confirma encima de un worker que puede
  -- estar borrando el objeto ahora mismo. La regla inversa, obligatoria
  -- para el worker, está documentada en la sección de limpieza.
  if v_fila.limpieza_lease is not null and v_fila.limpieza_expira_en > now() then
    return query select 'limpieza_en_curso'::text, null::uuid, v_fila.estado,
      v_fila.entity_type, v_fila.entity_id, v_fila.mime, v_fila.bytes,
      null::text, null::timestamptz, null::text, null::timestamptz, null::uuid;
    return;
  end if;

  -- Acá el lease de confirmación está libre o vencido, y el de limpieza
  -- —si existe— está VENCIDO: se invalida de paso, porque un worker
  -- muerto no debe bloquear la confirmación para siempre.
  v_lease := gen_random_uuid();

  update public.media_assets
     set confirmacion_lease = v_lease,
         confirmacion_expira_en = v_expira,
         limpieza_lease = null,
         limpieza_expira_en = null
   where id = p_asset_id;

  return query select 'tomado'::text, v_lease, v_fila.estado,
    v_fila.entity_type, v_fila.entity_id, v_fila.mime, v_fila.bytes,
    v_fila.r2_key, v_fila.r2_verificado_en, v_fila.cf_image_id,
    v_fila.cf_verificado_en, v_fila.reemplaza_asset_id;
end;
$$;

revoke all on function public.media_tomar_confirmacion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_tomar_confirmacion(uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- 9. FUNCIÓN 5 — registrar la verificación de R2
--
-- Se escribe el sello de R2 ANTES de tocar Cloudflare, y el lease NO se
-- libera. Las dos cosas juntas son lo que hace segura la reanudación:
-- si Cloudflare falla, el asset queda en `parcial_r2` con su sello
-- puesto y un reintento salta directo a la importación.
--
-- La fecha la pone la base (`now()`), no quien llama: un servidor con
-- el reloj corrido o un parámetro manipulado no puede antedatar una
-- verificación.
--
-- IDEMPOTENCIA CONCURRENTE: con FOR UPDATE, la segunda llamada espera a
-- la primera y después ve `r2_verificado_en` ya puesto, así que
-- devuelve sin reescribirlo. La PRIMERA fecha es la que queda.
-- ------------------------------------------------------------

create or replace function public.media_registrar_r2(
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
    raise exception 'media_registrar_r2: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_fila
    from public.media_assets m
   where m.id = p_asset_id
   for update;

  if not found or v_fila.deleted_at is not null then
    raise exception 'media_registrar_r2: el asset no existe.' using errcode = '22023';
  end if;

  -- Lease propio Y VIGENTE. Un lease vencido no autoriza nada aunque
  -- el uuid coincida: el proceso pudo morir y otro pudo tomarlo.
  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_registrar_r2: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  if v_fila.r2_key is null then
    raise exception 'media_registrar_r2: el asset no tiene clave de R2.' using errcode = '22023';
  end if;

  if v_fila.estado not in ('subiendo', 'parcial_r2') then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  -- Idempotente: no se reescribe la fecha.
  if v_fila.r2_verificado_en is not null then
    return query select 'reutilizada'::text, v_fila.estado;
    return;
  end if;

  update public.media_assets
     set r2_verificado_en = now(),
         estado = 'parcial_r2'
   where id = p_asset_id;

  return query select 'registrada'::text, 'parcial_r2'::text;
end;
$$;

revoke all on function public.media_registrar_r2(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_registrar_r2(uuid, uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- 10. FUNCIÓN 6 — finalizar con Cloudflare
--
-- El único camino a `listo`.
--
-- ── LA CARRERA DEL REEMPLAZO ─────────────────────────────────────────
--
-- Un reemplazo no consume cupo porque va a ocupar el lugar de otro.
-- Pero entre la reserva y la finalización pasan minutos, y en ese rato:
--
--   1. la entidad está llena (8 de 8);
--   2. se reserva un reemplazo de la foto X — no consume cupo;
--   3. alguien BORRA la foto X;
--   4. queda un lugar libre y otra reserva normal lo toma: 8 de 8;
--   5. el reemplazo finaliza... y quedan 9.
--
-- Por eso acá se toma el MISMO advisory lock de entidad que usa
-- `media_reservar` —para que ninguna reserva nueva entre mientras se
-- decide— y se revalida que el objetivo siga vivo y en `listo`. Si ya
-- no lo está, NO se marca la nueva como lista: se devuelve
-- `objetivo_invalido` para que el endpoint compense borrando la imagen
-- recién creada en Cloudflare.
--
-- Orden de bloqueo: advisory de entidad, después la fila nueva, después
-- la fila objetivo. Fijo, para no cruzarse con nadie.
-- ------------------------------------------------------------

create or replace function public.media_finalizar_cloudflare(
  p_actor       uuid,
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
  v_fila     public.media_assets%rowtype;
  v_objetivo public.media_assets%rowtype;
  v_cf       text := btrim(coalesce(p_cf_image_id, ''));
begin
  if p_actor is null or p_asset_id is null or p_lease is null then
    raise exception 'media_finalizar_cloudflare: parámetros inválidos.' using errcode = '22023';
  end if;

  if v_cf = '' then
    raise exception 'media_finalizar_cloudflare: falta el id de Cloudflare.'
      using errcode = '22023';
  end if;

  -- Primero una lectura sin bloquear, solo para saber de qué entidad es
  -- y poder tomar el advisory lock en el orden correcto.
  select * into v_fila from public.media_assets m where m.id = p_asset_id;
  if not found or v_fila.deleted_at is not null then
    raise exception 'media_finalizar_cloudflare: el asset no existe.' using errcode = '22023';
  end if;

  -- Mismo lock que `media_reservar`: ninguna reserva nueva entra en
  -- esta entidad mientras se decide el intercambio.
  perform pg_advisory_xact_lock(
    hashtextextended('media:entidad:' || v_fila.entity_type || ':' || v_fila.entity_id::text, 0)
  );

  -- Ahora sí, con la fila bloqueada y ya releída.
  select * into v_fila
    from public.media_assets m
   where m.id = p_asset_id
   for update;

  if not found or v_fila.deleted_at is not null then
    raise exception 'media_finalizar_cloudflare: el asset no existe.' using errcode = '22023';
  end if;

  -- La propiedad se revalida ANTES de cualquier retorno idempotente.
  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_finalizar_cloudflare: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  -- Ya estaba listo con el MISMO id: idempotente. Con otro id, se
  -- rechaza — significaría que hay dos imágenes en Cloudflare para un
  -- solo asset y una quedaría huérfana sin que nadie lo sepa.
  if v_fila.estado = 'listo' and v_fila.cf_image_id is not null then
    if v_fila.cf_image_id = v_cf then
      return query select 'reutilizada'::text, v_fila.estado;
      return;
    end if;
    raise exception 'media_finalizar_cloudflare: ya tiene otra imagen de Cloudflare.'
      using errcode = '42501';
  end if;

  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  if v_fila.estado <> 'parcial_r2' then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  -- Sin el sello de R2 no hay original verificado: no se sella nada.
  if v_fila.r2_verificado_en is null then
    raise exception 'media_finalizar_cloudflare: falta la verificación de R2.'
      using errcode = '42501';
  end if;

  -- ---------- El intercambio ----------
  if v_fila.reemplaza_asset_id is not null then
    select * into v_objetivo
      from public.media_assets m
     where m.id = v_fila.reemplaza_asset_id
     for update;

    -- El objetivo tiene que seguir siendo lo que era cuando se reservó.
    -- Si lo borraron o cambió de estado, su lugar ya lo pudo ocupar
    -- otra foto y finalizar acá dejaría la entidad por encima del cupo.
    if not found
       or v_objetivo.deleted_at is not null
       or v_objetivo.estado <> 'listo'
       or v_objetivo.entity_type <> v_fila.entity_type
       or v_objetivo.entity_id <> v_fila.entity_id then
      return query select 'objetivo_invalido'::text, v_fila.estado;
      return;
    end if;

    if not public.media_puede_administrar_como(
         p_actor, v_objetivo.entity_type, v_objetivo.entity_id) then
      return query select 'objetivo_invalido'::text, v_fila.estado;
      return;
    end if;

    -- Sale la vieja...
    update public.media_assets
       set deleted_at = now()
     where id = v_objetivo.id;
  end if;

  -- ...y entra la nueva, en la misma transacción. O pasan las dos
  -- cosas, o no pasa ninguna: la entidad nunca se queda sin foto ni
  -- termina con una de más.
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

revoke all on function public.media_finalizar_cloudflare(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.media_finalizar_cloudflare(uuid, uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 11. FUNCIÓN 7 — liberar tras un fallo TEMPORAL de Cloudflare
--
-- No borra nada de R2 ni quita el sello: el original está verificado y
-- sigue estándolo. Solo suelta el lease para que otro `/confirmar`
-- pueda reintentar SOLO la importación.
-- ------------------------------------------------------------

create or replace function public.media_liberar_confirmacion(
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
    raise exception 'media_liberar_confirmacion: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_fila
    from public.media_assets m
   where m.id = p_asset_id
   for update;

  if not found then
    raise exception 'media_liberar_confirmacion: el asset no existe.' using errcode = '22023';
  end if;

  -- Vencimiento incluido: antes solo se comparaba el uuid, y un lease
  -- caducado podía liberar un lease que ya era de otro proceso.
  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_liberar_confirmacion: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  if v_fila.r2_verificado_en is null then
    raise exception 'media_liberar_confirmacion: no hay verificación de R2 que conservar.'
      using errcode = '42501';
  end if;

  if v_fila.estado <> 'parcial_r2' then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  update public.media_assets
     set confirmacion_lease = null,
         confirmacion_expira_en = null
   where id = p_asset_id;

  return query select 'liberada'::text, 'parcial_r2'::text;
end;
$$;

revoke all on function public.media_liberar_confirmacion(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.media_liberar_confirmacion(uuid, uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- 12. FUNCIÓN 8 — rechazar la confirmación
--
-- Para metadatos que no coinciden o firma incompatible. Marca el asset
-- en `error` y limpia los sellos que dejaron de valer.
--
-- NO afirma que el objeto se borró de R2: eso pasa fuera de PostgreSQL
-- y puede fallar. Por eso la fila SE CONSERVA con su `r2_key` — es lo
-- único que le permite al worker volver a intentar el borrado.
-- ------------------------------------------------------------

create or replace function public.media_rechazar_confirmacion(
  p_actor    uuid,
  p_asset_id uuid,
  p_lease    uuid,
  p_codigo   text,
  p_detalle  text
)
returns table (codigo text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila   public.media_assets%rowtype;
  -- Se corta a 500 aunque la columna admita 2000 (0110): el mensaje es
  -- para diagnosticar, no para volcar la respuesta de un proveedor.
  v_texto  text := left(
    btrim(coalesce(p_codigo, 'desconocido')) || ': ' || btrim(coalesce(p_detalle, '')),
    500
  );
begin
  if p_actor is null or p_asset_id is null or p_lease is null then
    raise exception 'media_rechazar_confirmacion: parámetros inválidos.' using errcode = '22023';
  end if;

  select * into v_fila
    from public.media_assets m
   where m.id = p_asset_id
   for update;

  if not found then
    raise exception 'media_rechazar_confirmacion: el asset no existe.' using errcode = '22023';
  end if;

  -- Vencimiento incluido, igual que en liberar.
  if v_fila.confirmacion_lease is null
     or v_fila.confirmacion_lease <> p_lease
     or v_fila.confirmacion_expira_en is null
     or v_fila.confirmacion_expira_en <= now() then
    return query select 'lease_invalido'::text, v_fila.estado;
    return;
  end if;

  if not public.media_puede_administrar_como(p_actor, v_fila.entity_type, v_fila.entity_id) then
    raise exception 'media_rechazar_confirmacion: el actor ya no administra la entidad.'
      using errcode = '42501';
  end if;

  if v_fila.estado not in ('subiendo', 'parcial_r2') then
    return query select 'estado_no_admitido'::text, v_fila.estado;
    return;
  end if;

  -- Se limpian los sellos porque dejaron de ser ciertos, y también
  -- `cf_image_id`: si el archivo se rechaza, la imagen que hubiera en
  -- Cloudflare no debe quedar referenciada. `r2_key` SE CONSERVA.
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

revoke all on function public.media_rechazar_confirmacion(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.media_rechazar_confirmacion(uuid, uuid, uuid, text, text)
  to service_role;

-- ------------------------------------------------------------
-- 13. Limpieza posterior — solo la documentación y las columnas
--
-- El worker NO se implementa en este bloque, y es un BLOQUEO DE
-- PRODUCCIÓN: sin él, cada subida abandonada deja una fila y
-- posiblemente un objeto en R2 que nadie vuelve a mirar.
--
-- Cuando se escriba, tiene que hacerlo así:
--
--   · Lease de limpieza de 5 minutos (`limpieza_lease`).
--
--   · GRACIA de al menos 10 minutos DESPUÉS de `reserva_expira_en`.
--     `reserva_expira_en` marca cuándo dejó de valer la URL firmada, NO
--     cuándo terminó un PUT que ya venía en camino. Sin la gracia se
--     puede borrar el objeto de una subida que estaba terminando.
--
--   · REGLA INVERSA, OBLIGATORIA: nunca tomar el lease de limpieza si
--     hay `confirmacion_lease` VIGENTE. Es el espejo exacto de lo que
--     hace `media_tomar_confirmacion`, que no toma la confirmación si
--     hay limpieza vigente. Las dos mitades juntas son lo que impide
--     que el worker borre un objeto que se está confirmando.
--
--   · El claim tiene que ser ATÓMICO: `select ... for update` y decidir
--     con la fila bloqueada, o un `update ... where ... returning` en
--     una sola sentencia. Entre un SELECT y un DELETE separados,
--     /confirmar puede tomar el lease en el medio.
--
--   · Recién con el lease en mano se borran objetos de R2 y Cloudflare.
--     Después: `estado = 'huerfano'` y `deleted_at = now()`.
--
--   · Si el borrado del proveedor falla, NO marcar limpio: conservar la
--     fila y sus claves para reintentar.
-- ------------------------------------------------------------

comment on column public.media_assets.solicitud_id is
  'Idempotencia de /api/media/sesion. Lo genera el cliente. Repetirlo '
  'devuelve el mismo asset y vuelve a firmar su misma clave. Null en '
  'filas históricas y en las que traiga el backfill.';

comment on column public.media_assets.solicitante_id is
  'QUIÉN pidió la reserva (auth.uid()). NO es propietario_id, que es el '
  'dueño derivado de la entidad y puede ser otra persona (un admin '
  'subiendo al negocio de un tercero). El tope global de 20 reservas '
  'activas se cuenta SIEMPRE por esta columna.';

comment on column public.media_assets.reserva_expira_en is
  'Hasta cuándo vale la reserva (30 min, alineado con la URL PUT firmada). '
  'Vencida y sin confirmar, la fila es candidata a limpieza — con gracia.';

comment on column public.media_assets.confirmacion_lease is
  'Quién posee la confirmación en curso. Impide que dos /confirmar '
  'importen dos veces la misma imagen a Cloudflare. Vence a los 10 min '
  'para que un proceso muerto no bloquee el asset para siempre.';

comment on column public.media_assets.limpieza_lease is
  'Claim del worker de limpieza (5 min). Nunca se toma si hay una '
  'confirmación vigente, y viceversa. El worker todavía NO existe: es un '
  'bloqueo de producción.';

comment on column public.media_assets.reemplaza_asset_id is
  'A qué asset viene a sustituir. La foto anterior sigue visible hasta '
  'que la nueva queda lista; recién ahí se marca borrada, en la misma '
  'transacción y bajo el mismo advisory lock de entidad que usa la '
  'reserva. Un reemplazo no consume cupo.';

comment on function public.media_reservar(uuid, text, uuid, text, bigint, text, uuid) is
  'ÚNICA función nueva ejecutable por authenticated: revalida alcance, '
  'MIME, tamaño, nombre y propiedad por su cuenta porque puede llamarse '
  'directo desde el SDK sin pasar por el endpoint. Toma dos advisory '
  'locks en orden fijo (entidad, después actor). El conteo de cupo solo '
  'es correcto DESPUÉS del backfill de la media legacy.';

notify pgrst, 'reload schema';
