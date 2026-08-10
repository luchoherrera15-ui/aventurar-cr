-- ============================================================
-- BOOKEA MEDIA — Fase 2.1: la tabla `media_assets` (0110)
--
-- El problema medido: la app móvil descarga los ORIGINALES crudos de
-- Supabase (hasta 29,5 MB al abrir la ficha de un negocio, contra 188 KB
-- que sirve la web para lo mismo), y el ZIP de un álbum son 118,5 MB de
-- egress por descarga. La salida es servir las fotos desde Cloudflare
-- Images y guardar los originales en R2 privado.
--
-- Esta migración NO mueve una sola foto ni cambia una sola pantalla.
-- Solo crea el registro donde va a vivir esa información.
--
-- ── POR QUÉ NO HAY UNA COLUMNA `provider` ────────────────────────────
--
-- Un asset migrado está en los TRES lados a la vez: el original en R2,
-- la copia visual en Cloudflare Images y el fallback todavía en
-- Supabase. Un único valor `provider` tendría que mentir sobre dos de
-- los tres. Dónde vive cada cosa se DERIVA de las columnas que lo dicen
-- de verdad. Es la misma decisión que ya está tomada en
-- src/lib/media/tipos.ts.
--
-- ── UNA CLAVE NO ES UN ARCHIVO ───────────────────────────────────────
--
-- Ni `r2_key` ni `cf_image_id` prueban que exista nada:
--
--   · `r2_key` se calcula ANTES de subir, para poder firmar la URL de
--     carga. Una fila recién creada ya la tiene y no hay ningún objeto
--     detrás.
--
--   · `cf_image_id` lo devuelve Cloudflare al pedir un Direct Creator
--     Upload, o sea cuando la imagen todavía está en borrador y no
--     recibió un solo byte.
--
-- Por eso hay DOS columnas aparte —`r2_verificado_en` y
-- `cf_verificado_en`— que solo se escriben después de comprobar contra
-- cada proveedor que el objeto está ahí. Las restricciones de estado se
-- apoyan en esos sellos, no en las claves.
--
-- ── ADITIVA, PERO NO IDEMPOTENTE ─────────────────────────────────────
--
-- No toca `ranchos`, `albumes`, `album_fotos` ni `invitaciones`. Esas
-- tablas siguen siendo la fuente de verdad hasta que una fase posterior
-- las conecte, y son la red de seguridad: mientras `legacy_url` tenga
-- algo, la foto se ve aunque Cloudflare no exista.
--
-- Pero esta migración SE CORRE UNA SOLA VEZ. No lleva
-- `create table if not exists` a propósito: si `media_assets` ya existe
-- con otra forma, tiene que FALLAR y hacerse ver, no seguir de largo y
-- dejar una tabla con columnas viejas y restricciones nuevas a medias.
--
-- La seguridad (RLS, políticas, permisos) va en la 0111. Acá la tabla
-- nace cerrada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La tabla
-- ------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),

  -- El dueño, DERIVADO de la entidad por el trigger de la sección 5.
  -- Lo que mande el cliente se descarta y se pisa.
  --
  -- Es una FOTOGRAFÍA del propietario en el momento de registrar o
  -- reenlazar el asset, y sirve para agrupar y auditar. NUNCA decide
  -- permisos: eso se calcula siempre contra la entidad ACTUAL, en
  -- `media_puede_administrar()` (0111). Si un negocio cambia de dueño,
  -- esta columna queda vieja y los permisos igual siguen al dueño nuevo.
  --
  -- ANULABLE por DOS razones distintas:
  --
  --   1. `albumes.cliente_id` e `invitaciones.cliente_id` lo son: un
  --      álbum que el equipo creó sin cliente asignado no tiene dueño.
  --      En las otras cinco entidades el trigger no deja que sea null.
  --
  --   2. `on delete set null`: si se borra la cuenta, esta columna se
  --      vacía sola y la fila sobrevive. Es lo correcto — la foto de un
  --      rancho no tiene por qué desaparecer porque su dueño cerró la
  --      cuenta —, y por eso el trigger NO escucha esta columna (ver el
  --      CREATE TRIGGER de la sección 5).
  propietario_id uuid references auth.users(id) on delete set null,

  -- Contra qué tabla se valida la propiedad. La lista es exactamente
  -- `ENTIDADES` de src/lib/media/tipos.ts.
  --
  --   rancho        → ranchos.id            (dueño: ranchos.owner_id)
  --   rancho_item   → rancho_items.id       (dueño: vía rancho_id)
  --   equipo        → equipo_rancho.id      (dueño: vía rancho_id)
  --   album         → albumes.id            (dueño: albumes.cliente_id)
  --   invitacion    → invitaciones.id       (dueño: invitaciones.cliente_id)
  --   comprobante   → reservas.id           (dueño: vía rancho_id)
  --   verificacion  → verificacion_proveedores.rancho_id (esa tabla usa
  --                   rancho_id como clave primaria)
  entity_type text not null check (entity_type in (
    'rancho', 'rancho_item', 'equipo', 'album', 'invitacion',
    'comprobante', 'verificacion'
  )),

  -- Sin foreign key porque apunta a siete tablas distintas según
  -- `entity_type`, y Postgres no tiene FK polimórficas. Quien garantiza
  -- que la fila existe de verdad es el TRIGGER de la sección 5 — no una
  -- política de RLS: los INSERT los hace `service_role`, que salta RLS
  -- por definición. Un trigger, en cambio, corre siempre.
  entity_id uuid not null,

  -- Quién puede verlo. Tres niveles, no dos: un álbum digital no es
  -- público (no se lista en ningún lado) pero tampoco privado (el
  -- invitado que escanea el QR no tiene cuenta y nunca va a tenerla).
  --
  -- El default es el MÁS RESTRICTIVO. Un default 'publica' convertiría
  -- cualquier olvido —una fila insertada por un camino nuevo, un
  -- backfill apurado— en una filtración silenciosa. Con 'privada', ese
  -- mismo olvido produce una foto que no se ve: molesto, visible y
  -- arreglable sin que se haya expuesto nada.
  visibilidad text not null default 'privada'
    check (visibilidad in ('publica', 'compartida', 'privada')),

  estado text not null default 'pendiente' check (estado in (
    'pendiente', 'subiendo', 'parcial_r2', 'parcial_cf',
    'listo', 'error', 'huerfano'
  )),

  -- ── Dónde vive el archivo, y desde cuándo se sabe ──

  -- ── LA CADENA VACÍA NO ES UN DESTINO ──
  --
  -- Las tres columnas de abajo llevan el mismo par de comprobaciones, y
  -- la primera no es cosmética: `''` pasa todos los `is not null` de las
  -- restricciones de estado, así que sin este check una fila podría
  -- declararse 'listo' con `r2_key = ''` y no apuntar a ningún lado. Un
  -- `btrim` además descarta la cadena de puros espacios, que es el mismo
  -- problema disfrazado.
  --
  -- El tope de longitud evita que un valor descontrolado infle la fila y
  -- los índices. Todavía NO se valida el formato de la URL: solo vacío y
  -- longitud.

  -- El id en Cloudflare Images: la copia que se MIRA.
  -- OJO: existe desde el Direct Creator Upload, con la imagen en
  -- borrador. No prueba nada por sí solo.
  cf_image_id text check (
    cf_image_id is null
    or (btrim(cf_image_id) <> '' and octet_length(cf_image_id) <= 1024)
  ),
  -- Cuándo se comprobó CONTRA CLOUDFLARE que la imagen está subida y
  -- servible. Este sello sí prueba.
  cf_verificado_en timestamptz,

  -- La clave en R2: el original que se DESCARGA.
  -- OJO: se reserva antes de subir. No prueba nada por sí sola.
  -- El tope de 1024 es el mismo que `MAX_CLAVE` en src/lib/media/claves.ts,
  -- que a su vez es el máximo de una clave de S3/R2.
  r2_key text check (
    r2_key is null
    or (btrim(r2_key) <> '' and octet_length(r2_key) <= 1024)
  ),
  -- Cuándo se comprobó CONTRA R2 que el objeto existe (HEAD, con su
  -- tamaño y su tipo). Este sello sí prueba.
  r2_verificado_en timestamptz,

  -- La URL de Supabase de toda la vida: el fallback. No se vacía nunca
  -- mientras exista una app publicada que pueda pedirla.
  legacy_url text check (
    legacy_url is null
    or (btrim(legacy_url) <> '' and octet_length(legacy_url) <= 4096)
  ),

  -- ── Metadatos del archivo ──

  -- Puede traer datos personales: la gente sube "cedula-juan-perez.jpg"
  -- o "boda-maria-y-luis.heic". Por eso NO se expone por la API cliente
  -- (ver los GRANT de la 0111).
  nombre_original text check (
    nombre_original is null or char_length(nombre_original) <= 300
  ),

  -- Los doce MIME aceptados, exactamente `MIMES_PERMITIDOS` de
  -- src/lib/media/tipos.ts. Un MIME fuera de esta lista no se puede
  -- guardar, así que "no permitido" nunca llega a ser un estado.
  --
  -- OJO: varias restricciones de abajo distinguen imagen de video/audio
  -- con `like 'image/%'`. Eso es correcto SOLO porque esta lista está
  -- cerrada. Si algún día se agrega un MIME de imagen que no empiece con
  -- "image/", hay que revisar todas esas restricciones.
  mime text check (mime is null or mime in (
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/ogg'
  )),

  bytes bigint,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),

  -- Informativo: sirve para deduplicar en R2 y para verificar que la
  -- copia llegó entera. NO es único — dos invitados pueden subir la
  -- misma foto al mismo álbum a propósito, y quitarle una sería
  -- borrarle el recuerdo a alguien.
  checksum_sha256 text check (
    checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),

  -- El orden dentro de su galería. Nunca negativa: el dueño puede
  -- escribir esta columna desde el navegador (0111) y un número
  -- arbitrario no debería poder colarse delante de todo.
  posicion integer not null default 0 check (posicion >= 0),

  -- ── Fechas ──
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  error_en timestamptz,
  error_detalle text check (
    error_detalle is null or char_length(error_detalle) <= 2000
  ),
  -- Borrado LÓGICO. Los archivos NO se borran acá ni por trigger: los
  -- limpia un worker aparte, después, y con revisión.
  deleted_at timestamptz,

  -- ------------------------------------------------------------
  -- Invariantes de verificación
  -- ------------------------------------------------------------

  -- Un sello sin su referencia es un sello sobre nada.
  constraint media_assets_sello_r2_con_clave check (
    r2_verificado_en is null or r2_key is not null
  ),
  constraint media_assets_sello_cf_con_id check (
    cf_verificado_en is null or cf_image_id is not null
  ),

  -- Video y audio NO pasan por Cloudflare Images: ni identificador ni
  -- sello. Un `cf_image_id` sobre un video es un dato imposible.
  -- (Con `mime` nulo todavía no se puede saber, así que se deja pasar;
  -- las restricciones de estado de abajo cierran ese hueco.)
  constraint media_assets_no_imagen_sin_cloudflare check (
    mime is null
    or mime like 'image/%'
    or (cf_image_id is null and cf_verificado_en is null)
  ),

  -- Un objeto CONFIRMADO tiene metadatos, siempre.
  --
  -- Al reservar se puede no saber el tipo ni el tamaño definitivo: la
  -- fila nace con `mime` y `bytes` en null y está bien. Pero el sello de
  -- verificación se pone después de un HEAD contra el proveedor, y ese
  -- HEAD devuelve el tamaño: si hay sello y no hay `bytes`, alguien
  -- escribió el sello sin haber mirado de verdad.
  --
  -- Esto cierra solo un hueco que no hacía falta parchear tres veces:
  -- 'listo', 'parcial_r2' y 'parcial_cf' exigen los tres al menos un
  -- sello, así que ninguno de esos estados puede tener ya `bytes` nulo.
  -- Por eso las restricciones de estado de abajo NO repiten
  -- `bytes is not null`.
  --
  -- Y con `bytes` no nulo entra en juego `media_assets_bytes_coherente`,
  -- que exige que sea mayor que cero y esté dentro del tope de su tipo.
  constraint media_assets_confirmado_con_metadatos check (
    (r2_verificado_en is null and cf_verificado_en is null)
    or (mime is not null and bytes is not null)
  ),

  -- ------------------------------------------------------------
  -- Coherencia de los estados
  --
  -- Estas son las restricciones que más importan de toda la migración.
  -- Sin ellas, una fila puede decir 'listo' sin tener original: la
  -- galería la muestra, la descarga devuelve 404 y nadie sabe por qué.
  --
  -- Están acá ADEMÁS de en TypeScript porque un `update` a mano en el
  -- SQL Editor no pasa por TypeScript.
  -- ------------------------------------------------------------

  -- 'listo':
  --   · imagen      → R2 confirmado Y Cloudflare confirmado;
  --   · video/audio → R2 confirmado, y Cloudflare NULO en ambas
  --                   columnas (lo garantiza la restricción de arriba);
  --   · mime nulo   → nunca: sin saber el tipo no se sabe qué exigir.
  constraint media_assets_listo_coherente check (
    estado <> 'listo'
    or (
      mime is not null
      and r2_key is not null
      and r2_verificado_en is not null
      and (
        mime not like 'image/%'
        or (cf_image_id is not null and cf_verificado_en is not null)
      )
    )
  ),

  -- 'parcial_r2': SOLO imágenes (un video con R2 listo ya está 'listo').
  -- El original confirmado; la copia visual todavía no. `cf_image_id`
  -- puede existir como borrador, pero sin sello.
  constraint media_assets_parcial_r2_coherente check (
    estado <> 'parcial_r2'
    or (
      mime is not null
      and mime like 'image/%'
      and r2_key is not null
      and r2_verificado_en is not null
      and cf_verificado_en is null
    )
  ),

  -- 'parcial_cf': SOLO imágenes. La copia visual confirmada; el
  -- original todavía no. `r2_key` puede estar reservada, pero sin sello.
  constraint media_assets_parcial_cf_coherente check (
    estado <> 'parcial_cf'
    or (
      mime is not null
      and mime like 'image/%'
      and cf_image_id is not null
      and cf_verificado_en is not null
      and r2_verificado_en is null
    )
  ),

  -- ------------------------------------------------------------
  -- Tamaño, alineado con src/lib/media/cuotas.ts
  --
  -- `bytes` puede ser NULL mientras la reserva está incompleta (todavía
  -- no se sabe cuánto pesa). Pero en cuanto tiene valor, tiene que ser
  -- un tamaño real y estar dentro del tope de SU tipo:
  --
  --   imagen  10 MB = 10485760   (MAX_BYTES_IMAGEN — el tope de
  --                               Cloudflare Images; una imagen más
  --                               grande se rechaza antes de firmar)
  --   video  100 MB = 104857600  (MAX_BYTES.video — el tope real del
  --                               bucket, migración 0079)
  --   audio   20 MB = 20971520   (MAX_BYTES.audio)
  --
  -- Con `bytes` puesto y `mime` nulo se RECHAZA: los topes dependen del
  -- tipo, así que no hay forma de validar el número.
  -- ------------------------------------------------------------
  constraint media_assets_bytes_coherente check (
    bytes is null
    or (
      bytes > 0
      and mime is not null
      and (
        (mime like 'image/%' and bytes <= 10485760)
        or (mime like 'video/%' and bytes <= 104857600)
        or (mime like 'audio/%' and bytes <= 20971520)
      )
    )
  )

  -- NOTA: NO hay una restricción del tipo "borrado implica no listo".
  -- Se probó y estaba mal: el dueño solo puede escribir `posicion` y
  -- `deleted_at` (ver los GRANT de la 0111), así que una regla que
  -- exigiera bajar también `estado` al borrar le haría imposible quitar
  -- una foto que estaba lista. `deleted_at` y `estado` son dos ejes
  -- distintos: uno dice si se muestra, el otro si los archivos están.
);

-- ------------------------------------------------------------
-- 2. La tabla nace CERRADA
--
-- Supabase le concede privilegios de tabla completos a `anon` y
-- `authenticated` automáticamente al crear una tabla en el esquema
-- `public` (vienen de los ALTER DEFAULT PRIVILEGES del proyecto). Los
-- GRANT por columna de la 0111 NO reemplazan eso: se suman.
--
-- Así que lo primero es quitar todo. Se hace acá y no solo en la 0111
-- para que no exista ni un minuto —ni el hueco entre las dos
-- migraciones— en el que la tabla esté abierta.
--
-- No se usa ALTER DEFAULT PRIVILEGES a propósito: eso afectaría a las
-- demás tablas del proyecto.
-- ------------------------------------------------------------

revoke all privileges on table public.media_assets from public, anon, authenticated;

-- RLS habilitada sin políticas = nadie lee ni escribe, salvo
-- `service_role` (que la salta por definición). Las políticas llegan en
-- la 0111.
alter table public.media_assets enable row level security;

-- ------------------------------------------------------------
-- 3. Unicidad — solo donde se puede demostrar
-- ------------------------------------------------------------

-- Un objeto físico, una fila. Dos assets apuntando a la misma clave de
-- R2 significa que borrar uno le rompe la descarga al otro.
create unique index media_assets_r2_key_uk
  on public.media_assets (r2_key) where r2_key is not null;

-- Ídem con la copia visual.
create unique index media_assets_cf_image_id_uk
  on public.media_assets (cf_image_id) where cf_image_id is not null;

-- NO hay índice único sobre `legacy_url`, y no es un olvido: HOY LA
-- MISMA URL SE REUTILIZA. En `ranchos`, la foto de portada vive a la
-- vez en `foto_url` y dentro del arreglo `fotos`, y a veces también en
-- `foto_presentacion` — tres referencias al mismo archivo del bucket.
-- Un UNIQUE global rechazaría la segunda y la tercera.
--
-- Cuando la fase de migración necesite idempotencia, la identidad
-- estable es la terna (entity_type, entity_id, legacy_url): dentro de
-- UNA entidad la misma URL sí es la misma foto. Ese índice se agrega en
-- la migración que lo necesite, con los datos ya vistos, y no antes.

-- NO hay índice único sobre `checksum_sha256`: dos fotos idénticas
-- pueden subirse a propósito (ver el comentario de la columna).

-- ------------------------------------------------------------
-- 4. Índices de consulta
-- ------------------------------------------------------------

-- El acceso principal: "dame la galería de esta entidad, en orden".
create index media_assets_entidad_idx
  on public.media_assets (entity_type, entity_id, posicion)
  where deleted_at is null;

create index media_assets_propietario_idx
  on public.media_assets (propietario_id)
  where propietario_id is not null and deleted_at is null;

-- La cola de trabajo: lo que falta subir, reintentar o limpiar. Parcial
-- a propósito — cuando todo esté migrado, este índice no pesa nada.
create index media_assets_pendientes_idx
  on public.media_assets (estado, created_at)
  where estado <> 'listo' and deleted_at is null;

-- Para deduplicar en R2 y para auditar copias. NO único.
create index media_assets_checksum_idx
  on public.media_assets (checksum_sha256)
  where checksum_sha256 is not null;

-- ------------------------------------------------------------
-- 5. El trigger que garantiza que la entidad EXISTE
--
-- Por qué hace falta un trigger y no alcanza con RLS: los INSERT de
-- esta tabla los hace `service_role` desde el servidor, y `service_role`
-- SALTA las políticas de RLS. O sea que una política que valide la
-- entidad no se ejecuta nunca en el camino real. Un trigger sí.
--
-- Qué hace, en orden:
--   1. busca la entidad con un CASE cerrado (sin SQL dinámico);
--   2. si no existe, levanta una excepción y el INSERT se cae;
--   3. deriva el propietario DESDE la entidad y PISA lo que haya venido
--      en `propietario_id`;
--   4. solo tolera propietario nulo para 'album' e 'invitacion', que
--      son las dos entidades cuyo `cliente_id` es anulable.
--
-- Solo se dispara al INSERT y cuando cambia `entity_type` o `entity_id`,
-- así que reordenar una foto, marcarla borrada o dejar en null su
-- propietario no vuelve a consultar nada. La lista de columnas está
-- elegida con cuidado: ver el comentario del CREATE TRIGGER, al final de
-- esta sección.
--
-- NO se agregan triggers a las siete tablas padre: eso es de otro
-- bloque. Consecuencia conocida y aceptada: si mañana se borra un
-- rancho, sus filas de `media_assets` quedan huérfanas hasta que pase
-- el worker de limpieza.
-- ------------------------------------------------------------

create or replace function public.media_assets_validar_entidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_propietario uuid;
  v_existe boolean;
begin
  -- `v_existe` queda en NULL si el SELECT no encuentra fila, y en true
  -- si la encuentra. Eso distingue "no existe" de "existe pero no tiene
  -- dueño" (un álbum sin cliente asignado), que son dos cosas muy
  -- distintas y que con un solo `v_propietario is null` se confundirían.
  case new.entity_type

    when 'rancho' then
      select r.owner_id, true into v_propietario, v_existe
        from public.ranchos r
       where r.id = new.entity_id;

    when 'rancho_item' then
      select r.owner_id, true into v_propietario, v_existe
        from public.rancho_items i
        join public.ranchos r on r.id = i.rancho_id
       where i.id = new.entity_id;

    when 'equipo' then
      select r.owner_id, true into v_propietario, v_existe
        from public.equipo_rancho e
        join public.ranchos r on r.id = e.rancho_id
       where e.id = new.entity_id;

    when 'album' then
      select a.cliente_id, true into v_propietario, v_existe
        from public.albumes a
       where a.id = new.entity_id;

    when 'invitacion' then
      select v.cliente_id, true into v_propietario, v_existe
        from public.invitaciones v
       where v.id = new.entity_id;

    when 'comprobante' then
      select r.owner_id, true into v_propietario, v_existe
        from public.reservas s
        join public.ranchos r on r.id = s.rancho_id
       where s.id = new.entity_id;

    -- La verificación se comprueba en SU tabla y recién después se saca
    -- el dueño del rancho: que exista el rancho no significa que exista
    -- la verificación.
    when 'verificacion' then
      select r.owner_id, true into v_propietario, v_existe
        from public.verificacion_proveedores vp
        join public.ranchos r on r.id = vp.rancho_id
       where vp.rancho_id = new.entity_id;

    else
      raise exception
        'media_assets: entity_type "%" no reconocido', new.entity_type
        using errcode = '23514';
  end case;

  if v_existe is not true then
    raise exception
      'media_assets: no existe ninguna entidad "%" con id %',
      new.entity_type, new.entity_id
      using errcode = '23503';
  end if;

  -- Propietario nulo solo donde el modelo real lo permite. En las otras
  -- cinco entidades el dueño sale de `ranchos.owner_id`, que es NOT NULL
  -- desde la 0008: un nulo ahí significa que algo cambió en el esquema y
  -- conviene enterarse acá y no meses después.
  if v_propietario is null and new.entity_type not in ('album', 'invitacion') then
    raise exception
      'media_assets: la entidad "%" (id %) no tiene propietario y debería tenerlo',
      new.entity_type, new.entity_id
      using errcode = '23502';
  end if;

  -- Se PISA lo que haya mandado quien llama. Es la línea que hace que
  -- `propietario_id` no se pueda falsear.
  new.propietario_id = v_propietario;

  return new;
end;
$$;

-- ── POR QUÉ `propietario_id` NO ESTÁ EN LA LISTA DE COLUMNAS ──
--
-- Esta columna es `references auth.users(id) ON DELETE SET NULL`. Cuando
-- se borra una cuenta, Postgres dispara un UPDATE que pone
-- `propietario_id = null` en las filas que la apuntaban.
--
-- Si el trigger escuchara esa columna, ese UPDATE lo despertaría y la
-- función volvería a derivar el propietario desde la entidad, poniendo
-- OTRA VEZ el uuid del usuario que se está borrando. El resultado es una
-- violación de clave foránea, o directamente un usuario que no se puede
-- borrar nunca — y descubrirlo el día que alguien pide que le eliminen
-- la cuenta es tarde.
--
-- Sacarla de la lista es seguro: `anon` y `authenticated` no pueden
-- insertar ni escribir `propietario_id` (ver los GRANT de la 0111), así
-- que el único que podría tocarla a mano es `service_role`, o sea
-- nuestro propio servidor. Y en INSERT el trigger sigue disparándose
-- igual y pisando lo que venga.
--
-- Entonces el trigger corre exactamente cuando tiene que correr:
--   · al INSERT             → deriva y pisa el propietario;
--   · al reenlazar          → cambia entity_type o entity_id, recalcula;
--   · al borrar un usuario  → NO corre, y el SET NULL prospera;
--   · al tocar solo posicion, deleted_at o propietario_id → NO corre.
create trigger media_assets_validar_entidad
  before insert or update of entity_type, entity_id
  on public.media_assets
  for each row
  execute function public.media_assets_validar_entidad();

-- ------------------------------------------------------------
-- 6. `updated_at` al día
--
-- Trigger puro: escribe una fecha y nada más. Sin llamadas de red, sin
-- `http`, sin `pg_net`, sin webhooks. Un trigger que sale a internet
-- convierte cualquier `update` en algo que puede colgarse o fallar por
-- causas ajenas a la base.
-- ------------------------------------------------------------

create or replace function public.media_assets_tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger media_assets_updated_at
  before update on public.media_assets
  for each row
  execute function public.media_assets_tocar_updated_at();

-- ------------------------------------------------------------
-- 7. Las funciones de trigger no las llama nadie a mano
--
-- Revocarlas no rompe los triggers: Postgres comprueba EXECUTE cuando
-- se CREA el trigger, no cada vez que se dispara.
-- ------------------------------------------------------------

revoke all on function public.media_assets_validar_entidad()
  from public, anon, authenticated;
revoke all on function public.media_assets_tocar_updated_at()
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- 8. Documentación en la propia base
-- ------------------------------------------------------------

comment on table public.media_assets is
  'Registro único de fotos, videos y audios. El original vive en R2, la '
  'copia visual en Cloudflare Images y el fallback en Supabase; los tres '
  'a la vez. Sin columna provider. Espejo de src/lib/media/tipos.ts.';

comment on column public.media_assets.propietario_id is
  'DERIVADO por trigger al insertar o reenlazar; lo que manda el cliente se '
  'descarta. Es una FOTOGRAFÍA del propietario en ese momento: informativa, '
  'para agrupar y auditar. NUNCA decide permisos — eso se calcula contra la '
  'entidad ACTUAL en media_puede_administrar() (0111). El trigger no escucha '
  'esta columna, para que el ON DELETE SET NULL de auth.users prospere.';

comment on column public.media_assets.entity_id is
  'Id en la tabla que indica entity_type. Sin FK porque apunta a siete '
  'tablas; la existencia la garantiza el trigger media_assets_validar_entidad.';

comment on column public.media_assets.r2_key is
  'Clave del original. Se RESERVA antes de que el objeto exista: no prueba '
  'nada por sí sola. La prueba es r2_verificado_en.';

comment on column public.media_assets.r2_verificado_en is
  'Cuándo se comprobó contra R2 (HEAD) que el objeto existe. Solo con este '
  'sello se puede firmar una descarga.';

comment on column public.media_assets.cf_image_id is
  'Id de Cloudflare Images. Existe desde el Direct Creator Upload, con la '
  'imagen en BORRADOR y sin un solo byte: no prueba nada por sí solo. La '
  'prueba es cf_verificado_en.';

comment on column public.media_assets.cf_verificado_en is
  'Cuándo se comprobó contra Cloudflare que la imagen está subida y servible.';

comment on column public.media_assets.nombre_original is
  'Puede contener datos personales ("cedula-juan-perez.jpg"). No se expone '
  'por la API cliente.';

comment on column public.media_assets.legacy_url is
  'La URL de Supabase de siempre. Es el fallback y no se vacía mientras haya '
  'apps publicadas que la pidan. Se repite entre filas a propósito.';

comment on column public.media_assets.deleted_at is
  'Borrado lógico. Los archivos de R2 y Cloudflare NO se borran acá: los '
  'limpia un worker aparte, con revisión.';

notify pgrst, 'reload schema';
