-- ============================================================
-- BOOKEA MEDIA — Fase 2.1: seguridad de `media_assets` (0111)
--
-- Corre DESPUÉS de la 0110. Por sí sola no hace nada útil: la 0110 deja
-- la tabla con RLS habilitada, los privilegios revocados y sin
-- políticas, o sea cerrada; acá se abren las tres puertas mínimas y ni
-- una más.
--
-- ── LAS TRES PUERTAS ─────────────────────────────────────────────────
--
--   anon           lee SOLO media 'publica', 'listo', viva, y solo si
--                  la entidad de la que cuelga es de verdad pública
--                  (rancho aprobado, invitación activa). Nunca ve
--                  álbumes, comprobantes ni cédulas.
--
--   authenticated  lo mismo que anon, MÁS la media de las entidades que
--                  administra de verdad. Puede reordenar y quitar; no
--                  puede crear ni borrar filas.
--
--   service_role   todo, desde el servidor. Nunca en código de cliente.
--
-- ── DOS CANDADOS DISTINTOS ───────────────────────────────────────────
--
-- RLS filtra FILAS. Para que `r2_key` y `legacy_url` no salgan jamás por
-- la API se usan GRANT por COLUMNA. Hacen falta los dos: sin el
-- segundo, cualquiera con la llave anónima podría leer cómo está
-- organizado el bucket privado a partir de una foto pública.
--
-- Y antes de los dos va un REVOKE: Supabase le concede privilegios de
-- tabla completos a `anon` y `authenticated` al crear una tabla en
-- `public`, y un GRANT por columna NO reemplaza ese permiso, se le suma.
--
-- Consecuencia práctica al escribir el código: `select *` sobre esta
-- tabla FALLA con la llave anónima. Hay que pedir las columnas por
-- nombre. Es incómodo una vez y protege para siempre.
--
-- ── ESTA MIGRACIÓN SÍ SE PUEDE VOLVER A APLICAR ──────────────────────
--
-- A diferencia de la 0110 (que crea la tabla y debe fallar si ya
-- existe), acá no hay nada que pueda perder datos: son funciones con
-- `create or replace`, `drop policy if exists` antes de cada política, y
-- revokes/grants que son declarativos. Volver a correrla deja el mismo
-- estado final, y eso es deseable: si mañana alguien afloja un permiso
-- a mano en el panel de Supabase, re-aplicar esta migración lo vuelve a
-- cerrar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ¿Quién administra esta entidad?
--
-- Devuelve un booleano y nada más. Es SECURITY DEFINER porque tiene que
-- poder mirar `ranchos`, `albumes` e `invitaciones` sin que las
-- políticas de esas tablas se metan en el medio — pero lo único que
-- sale de acá es true/false, nunca una fila.
--
-- `SET search_path = ''` y todo calificado con su esquema: sin eso,
-- alguien que pueda crear una tabla `ranchos` en un esquema que esté
-- antes en el search_path haría que esta función leyera la suya y
-- contestara que sí.
--
-- Sin SQL dinámico: es un `case` sobre una lista cerrada. No se
-- construye un nombre de tabla en ningún lado.
--
-- OJO: esta función NO mira `media_assets.propietario_id`. Los permisos
-- se calculan siempre contra la entidad ACTUAL, así que si un negocio
-- cambia de dueño, el dueño nuevo administra su media desde el primer
-- momento y el viejo deja de hacerlo — sin tocar una sola fila.
-- ------------------------------------------------------------

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
  select
    -- Sin sesión no se administra nada. Va primero para cortar temprano
    -- y para que quede escrito: `auth.uid()` es null para anon.
    auth.uid() is not null
    and (
      -- El equipo de Bookea entra a ayudar. `is_admin()` ya existe desde
      -- la 0008 y declara su propio search_path.
      public.is_admin()
      or case p_entity_type

        -- El negocio: el dueño está en la propia fila.
        when 'rancho' then exists (
          select 1 from public.ranchos r
           where r.id = p_entity_id and r.owner_id = auth.uid()
        )

        -- El catálogo cuelga del negocio (rancho_items.rancho_id).
        when 'rancho_item' then exists (
          select 1
            from public.rancho_items i
            join public.ranchos r on r.id = i.rancho_id
           where i.id = p_entity_id and r.owner_id = auth.uid()
        )

        -- El equipo también (equipo_rancho.rancho_id).
        when 'equipo' then exists (
          select 1
            from public.equipo_rancho e
            join public.ranchos r on r.id = e.rancho_id
           where e.id = p_entity_id and r.owner_id = auth.uid()
        )

        -- El álbum: `albumes.cliente_id` es ANULABLE. Un álbum que el
        -- equipo creó sin cliente asignado no tiene dueño, y entonces
        -- solo lo administra un admin.
        when 'album' then exists (
          select 1 from public.albumes a
           where a.id = p_entity_id
             and a.cliente_id is not null
             and a.cliente_id = auth.uid()
        )

        -- La invitación: `invitaciones.cliente_id`, también anulable.
        when 'invitacion' then exists (
          select 1 from public.invitaciones v
           where v.id = p_entity_id
             and v.cliente_id is not null
             and v.cliente_id = auth.uid()
        )

        -- El comprobante de pago cuelga de la reserva, y la reserva del
        -- negocio. Es el mismo camino que ya usa `puede_ver_comprobante`
        -- (migración 0011) para las políticas del bucket privado.
        --
        -- OJO: `reservas.cliente_id` existe (0032) pero es anulable y
        -- muchas reservas se hacen sin cuenta. Acá se reconoce SOLO al
        -- dueño del negocio, que es exactamente lo que hace la 0011: no
        -- se amplía el acceso de paso.
        when 'comprobante' then exists (
          select 1
            from public.reservas s
            join public.ranchos r on r.id = s.rancho_id
           where s.id = p_entity_id and r.owner_id = auth.uid()
        )

        -- La verificación del proveedor: esa tabla usa `rancho_id` como
        -- clave primaria, así que su `entity_id` ES un id de rancho.
        --
        -- Se consulta `verificacion_proveedores` Y `ranchos`, las dos, y
        -- no solo el rancho. La versión anterior miraba únicamente
        -- `ranchos` y quedaba INCONSISTENTE con el trigger de la 0110,
        -- que sí exige que exista la fila de verificación: se podía
        -- llegar a administrar media de una verificación ya borrada.
        --
        -- Ahora, si se borra la fila de `verificacion_proveedores`, esa
        -- media deja de ser legible y modificable para `authenticated`
        -- de inmediato. `service_role` la sigue viendo y puede
        -- procesarla como huérfana, que es justo lo que necesita el
        -- worker de limpieza.
        when 'verificacion' then exists (
          select 1
            from public.verificacion_proveedores vp
            join public.ranchos r on r.id = vp.rancho_id
           where vp.rancho_id = p_entity_id and r.owner_id = auth.uid()
        )

        -- Un entity_type que el código no conoce no autoriza nada.
        else false
      end
    );
$$;

-- ------------------------------------------------------------
-- 2. ¿La entidad de la que cuelga es DE VERDAD pública?
--
-- No alcanza con que la fila diga `visibilidad = 'publica'`. Si un
-- negocio se despublica o una invitación se archiva, sus fotos tienen
-- que dejar de verse sin que nadie tenga que acordarse de actualizar
-- `media_assets`. Esta función es la que hace que eso pase solo.
--
-- Álbum, comprobante y verificación devuelven SIEMPRE false: no existe
-- ninguna combinación por la que anon los lea desde esta tabla.
-- ------------------------------------------------------------

create or replace function public.media_entidad_es_publica(
  p_entity_type text,
  p_entity_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_entity_type

    -- Un negocio es público cuando está aprobado (política de la 0008).
    when 'rancho' then exists (
      select 1 from public.ranchos r
       where r.id = p_entity_id and r.estado = 'aprobado'
    )

    -- El catálogo y el equipo se muestran en la página del negocio, así
    -- que siguen su suerte.
    --
    -- Nota: la política de `rancho_items` (0035) hoy es `using (true)`,
    -- o sea que deja ver ítems de negocios sin aprobar. Acá se aplica el
    -- criterio MÁS estricto, ya aprobado: las fotos de un negocio que
    -- todavía no fue revisado no son públicas.
    when 'rancho_item' then exists (
      select 1
        from public.rancho_items i
        join public.ranchos r on r.id = i.rancho_id
       where i.id = p_entity_id and r.estado = 'aprobado'
    )

    when 'equipo' then exists (
      select 1
        from public.equipo_rancho e
        join public.ranchos r on r.id = e.rancho_id
       where e.id = p_entity_id and r.estado = 'aprobado'
    )

    -- Una invitación es pública cuando está activa (política de la 0066).
    when 'invitacion' then exists (
      select 1 from public.invitaciones v
       where v.id = p_entity_id and v.estado = 'activa'
    )

    -- 'album'        → el acceso pasa por el servidor (ver sección 6).
    -- 'comprobante'  → privado, siempre.
    -- 'verificacion' → privado, siempre (son cédulas).
    else false
  end;
$$;

-- ------------------------------------------------------------
-- 3. Permisos de las funciones
--
-- Se revoca de PUBLIC y ADEMÁS de `anon` y `authenticated` por nombre.
-- Revocar de PUBLIC alcanza para el privilegio heredado, pero si alguna
-- vez alguien le concedió EXECUTE directo a uno de esos roles, ese
-- permiso directo sobrevive al revoke de PUBLIC. Nombrarlos cierra las
-- dos puertas.
-- ------------------------------------------------------------

revoke all on function public.media_puede_administrar(text, uuid)
  from public, anon, authenticated;
revoke all on function public.media_entidad_es_publica(text, uuid)
  from public, anon, authenticated;

-- Solo quien tiene sesión necesita preguntar si administra algo.
grant execute on function public.media_puede_administrar(text, uuid) to authenticated;

-- Esta la evalúa la política de lectura pública, así que la necesita
-- también quien entra sin cuenta.
grant execute on function public.media_entidad_es_publica(text, uuid) to anon, authenticated;

-- Las funciones de trigger de la 0110: nadie las llama a mano. Se
-- repite el revoke acá para que esta migración deje el estado completo
-- aunque se aplique sola.
revoke all on function public.media_assets_validar_entidad()
  from public, anon, authenticated;
revoke all on function public.media_assets_tocar_updated_at()
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Permisos de tabla: primero quitar TODO, después dar lo mínimo
--
-- El revoke se repite (ya está en la 0110) para que esta migración
-- deje el estado completo por sí sola y para que re-aplicarla vuelva a
-- cerrar cualquier permiso que se haya aflojado a mano.
--
-- No se usa ALTER DEFAULT PRIVILEGES: afectaría al resto del proyecto.
-- ------------------------------------------------------------

revoke all privileges on table public.media_assets from public, anon, authenticated;

-- ── Lo que SÍ se puede leer ──
--
-- Catorce columnas. Lo que no está acá no sale nunca por la API cliente:
--
--   propietario_id     de quién es cada cosa no es asunto de nadie
--   r2_key             la ubicación del original privado
--   legacy_url         es una URL directa al bucket de Supabase; darla
--                      sería seguir sirviendo el original crudo, que es
--                      exactamente el problema que este proyecto viene a
--                      resolver. El fallback legacy lo resuelve el
--                      SERVIDOR, que sí ve esta columna.
--   nombre_original    puede traer datos personales en el nombre
--   checksum_sha256    permite confirmar si tenés un archivo idéntico
--   r2_verificado_en   interno de operación
--   cf_verificado_en   interno de operación
--   error_en           interno de operación
--   error_detalle      puede filtrar rutas y mensajes del proveedor
grant select (
  id,
  entity_type,
  entity_id,
  visibilidad,
  estado,
  cf_image_id,
  mime,
  bytes,
  width,
  height,
  posicion,
  created_at,
  updated_at,
  deleted_at
) on public.media_assets to anon, authenticated;

-- Reordenar y quitar. Nada más.
--
-- Con esto el dueño NO puede tocar `visibilidad` (publicaría fotos
-- privadas), ni `estado` (marcaría listo lo que no lo está), ni las
-- columnas de ubicación y verificación. Eso no lo hace la política: lo
-- hace este GRANT.
grant update (posicion, deleted_at) on public.media_assets to authenticated;

-- El servidor administra todo: crear, confirmar, corregir, limpiar.
-- Esta llave vive SOLO en variables de entorno del servidor y no puede
-- aparecer en el bundle del navegador ni en la app de Expo.
grant all on table public.media_assets to service_role;

-- ------------------------------------------------------------
-- 5. Políticas de fila
-- ------------------------------------------------------------

-- ── 5.1 Lectura pública ──
--
-- Cuatro condiciones, todas obligatorias:
--   · la fila no está borrada;
--   · su visibilidad es 'publica' (NUNCA 'compartida' ni 'privada');
--   · está 'listo' — y las restricciones de la 0110 garantizan que un
--     'listo' tiene los DOS sellos de verificación que le tocan;
--   · la entidad de la que cuelga es públicamente visible AHORA.
drop policy if exists "Media pública de entidades públicas" on public.media_assets;
create policy "Media pública de entidades públicas" on public.media_assets
  for select to anon, authenticated
  using (
    deleted_at is null
    and visibilidad = 'publica'
    and estado = 'listo'
    and public.media_entidad_es_publica(entity_type, entity_id)
  );

-- ── 5.2 El dueño ve lo suyo ──
--
-- Toda su media, en cualquier estado y cualquier visibilidad: la
-- necesita para ver qué subió, qué falló y qué está a medias. Las
-- columnas internas siguen fuera de su alcance por el GRANT de arriba.
drop policy if exists "El dueño ve su media" on public.media_assets;
create policy "El dueño ve su media" on public.media_assets
  for select to authenticated
  using (public.media_puede_administrar(entity_type, entity_id));

-- ── 5.3 El dueño reordena y quita ──
--
-- `using` decide qué filas puede tocar; `with check` decide cómo pueden
-- quedar. Las dos con la misma función, para que no se pueda mover un
-- asset a una entidad ajena en el mismo update.
drop policy if exists "El dueño reordena y quita su media" on public.media_assets;
create policy "El dueño reordena y quita su media" on public.media_assets
  for update to authenticated
  using (public.media_puede_administrar(entity_type, entity_id))
  with check (public.media_puede_administrar(entity_type, entity_id));

-- No hay política de INSERT ni de DELETE para `authenticated`, y es a
-- propósito:
--
--   · CREAR un asset exige reservar una clave de R2 y firmar una URL de
--     subida. Eso solo lo puede hacer el servidor, que además valida
--     MIME, tamaño y cupo. Un insert directo desde el navegador crearía
--     filas sin archivo detrás.
--
--   · BORRAR es lógico: se pone `deleted_at`, que ya está permitido
--     arriba. El borrado físico de R2 y Cloudflare lo hace un worker
--     aparte, con revisión.
--
--   · Los ÁLBUMES compartidos no tienen política ninguna: ver sección 6.

-- ------------------------------------------------------------
-- 6. LOS ÁLBUMES COMPARTIDOS — LEER ESTO
--
-- No hay ninguna política que le deje a `anon` leer una fila con
-- `visibilidad = 'compartida'`. Es deliberado.
--
-- HOY NO EXISTE UN TOKEN DE ÁLBUM. Se revisó la 0068 y la 0089:
-- `albumes` tiene `id`, `invitacion_id`, `cliente_id`, `slug`, `titulo`,
-- `subtitulo`, `estado` y `created_at`, y nada más. Se entra a un álbum
-- con `/a/{slug}` y la política pública lo entrega con solo pedir
-- `estado = 'activo'`. El `slug` es un nombre legible, NO un secreto, y
-- `album_foto_llaves` (0089) guarda el hash de un token del NAVEGADOR
-- que sirve para borrar la foto propia — no para entrar.
--
-- Está decidido que en una fase posterior se crea un token aleatorio,
-- guardado como hash y validado por el servidor. Hasta que exista, la
-- regla que sí se puede garantizar desde la base es la más estricta:
-- una fila 'compartida' solo la lee `service_role`, o sea el servidor —
-- que es exactamente el lugar donde va a ocurrir esa validación.
--
-- Consecuencia concreta para la fase que conecte los álbumes: la página
-- /a/{slug} NO va a poder leer `media_assets` con la llave anónima como
-- lee hoy `album_fotos`. Va a tener que leerla del lado del servidor y
-- devolver URLs ya firmadas.
-- ------------------------------------------------------------

comment on function public.media_puede_administrar(text, uuid) is
  'Propiedad real por entidad: ranchos.owner_id, albumes.cliente_id, '
  'invitaciones.cliente_id, y los derivados por rancho_id. NO usa la '
  'columna propietario_id de media_assets: los permisos se calculan '
  'siempre contra la entidad actual.';

comment on function public.media_entidad_es_publica(text, uuid) is
  'Si la entidad padre es públicamente visible hoy (rancho aprobado, '
  'invitación activa). album/comprobante/verificacion: siempre false.';

notify pgrst, 'reload schema';
