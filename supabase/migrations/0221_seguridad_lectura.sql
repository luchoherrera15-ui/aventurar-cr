-- ============================================================
--  SEGURIDAD · cerrar las FUGAS DE LECTURA por RLS abierta (29 ago 2026)
-- ============================================================
--
-- Auditoría de seguridad (docs/seguridad-auditoria-2026-08-29.md): la
-- anon key viaja pública en el bundle del cliente, así que la única
-- barrera real es RLS + los grants + los checks de las funciones. La
-- hermana 0220 cerró la ESCRITURA sobre lo ajeno; esta cierra la
-- LECTURA de más de la cuenta.
--
-- Lo que se cierra acá:
--   1) invitaciones: la policy abierta dejaba a CUALQUIERA enumerar la
--      tabla entera —titulo, anfitriones, fecha y hasta la DIRECCIÓN de
--      casa de cada evento— con un solo `GET /rest/v1/invitaciones`
--      (hallazgo 5, confirmado en vivo). RLS no puede forzar el filtro
--      por slug, así que la fila pública pasa a servirse por funciones
--      security-definer con acceso POR LINK, nunca por listado.
--   2) ranchos.destacado_orden: el dueño (rol `authenticated`) podía
--      subir su propia fila y auto-destacarse en la portada — algo que
--      decide la plataforma, no el negocio. Se protege la columna con un
--      trigger, el mismo patrón que `ranchos_proteger_dueno` (0116).
--
-- Lo que se DEJÓ deliberadamente sin tocar (con su porqué al final):
--   3) bucket `comprobantes` público  →  ver la nota grande al pie.
--   4) `visitas_pagina_resumen` a `anon`  →  ver la nota al pie.
--
-- Es idempotente: se puede correr más de una vez sin cambiar nada la
-- segunda. Ninguna migración se aplica desde acá: la pega el humano.
-- ============================================================


-- ============================================================
-- 1. invitaciones — de "tabla enumerable" a "acceso por link"
-- ============================================================
--
-- El problema de raíz: `/i/{slug}` y `/a/{slug}` son páginas PÚBLICAS
-- que corren con la llave anónima, y RLS solo sabe decir "esta fila sí,
-- esta no" — NO puede exigir "solo si viniste con el slug correcto". La
-- policy "Cualquiera ve las invitaciones activas" resolvía el acceso por
-- link a costa de habilitar también el listado completo. La forma
-- correcta de "acceso por link y nada de listado" es una función
-- security-definer que EXIGE el identificador como argumento: sin el
-- slug (o el id) exacto no devuelve nada, y no hay `select *` posible.

-- ------------------------------------------------------------
-- 1a. La invitación pública por slug (la usa /i/{slug})
-- ------------------------------------------------------------
--
-- Devuelve SOLO las columnas que pinta la página pública, y SOLO si la
-- invitación está 'activa' (un borrador o una archivada siguen dando
-- 404, igual que hoy). Trae además `preguntas` (0068) y `es_ejemplo`
-- (0074) para que la página deje de hacer dos consultas extra por id.
-- `security definer` + `set search_path = ''` (nombres calificados) es
-- el mismo blindaje del trigger de la 0116: la función corre con sus
-- propios permisos y salta la RLS de la tabla, pero solo puede devolver
-- lo que este cuerpo permite.
create or replace function public.invitacion_por_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  titulo text,
  anfitriones text,
  mensaje text,
  fecha_evento date,
  hora text,
  lugar_nombre text,
  direccion text,
  maps_url text,
  portada_url text,
  html_personalizado text,
  tema text,
  preguntas jsonb,
  es_ejemplo boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    i.id, i.slug, i.titulo, i.anfitriones, i.mensaje, i.fecha_evento,
    i.hora, i.lugar_nombre, i.direccion, i.maps_url, i.portada_url,
    i.html_personalizado, i.tema, i.preguntas, i.es_ejemplo
  from public.invitaciones i
  where i.slug = p_slug
    and i.estado = 'activa'
  limit 1;
$$;

revoke all on function public.invitacion_por_slug(text) from public;
grant execute on function public.invitacion_por_slug(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 1b. La paleta de la invitación por id (la usa /a/{slug}, el álbum)
-- ------------------------------------------------------------
--
-- La página del álbum es igual de pública (los invitados escanean un QR,
-- sin cuenta) y hereda los colores de su invitación leyéndola POR ID. Al
-- cerrar la lectura directa, esa consulta anónima devolvería null y el
-- álbum perdería el color. Se le da su propia puerta security-definer,
-- acotada a lo justo (la paleta y el HTML del que se deducen los
-- colores) y solo para invitaciones activas. Es lo que el propio código
-- prefería: "una función antes que una llave de servicio por un color".
create or replace function public.invitacion_paleta_por_id(p_id uuid)
returns table (
  paleta jsonb,
  html_personalizado text
)
language sql
security definer
set search_path = ''
stable
as $$
  select i.paleta, i.html_personalizado
  from public.invitaciones i
  where i.id = p_id
    and i.estado = 'activa'
  limit 1;
$$;

revoke all on function public.invitacion_paleta_por_id(uuid) from public;
grant execute on function public.invitacion_paleta_por_id(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 1c. El check "¿esta invitación está activa?" para el RSVP anónimo
-- ------------------------------------------------------------
--
-- El invitado confirma sin cuenta: inserta en `invitacion_rsvp` como
-- `anon`. La policy de ese INSERT (0066) valida con un subquery
-- `exists (select 1 from invitaciones where id = ... and estado='activa')`.
-- OJO: un subquery dentro de una policy respeta la RLS de la tabla
-- referida — hoy funciona SOLO porque la policy abierta deja al anónimo
-- ver las activas. Al quitarla, ese subquery se quedaría sin filas y el
-- RSVP dejaría de guardarse en silencio. Se reemplaza por esta función
-- security-definer (misma respuesta, sin depender de la RLS de lectura),
-- así el flujo del RSVP sigue idéntico sin tocar una línea de código.
create or replace function public.invitacion_esta_activa(p_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.invitaciones i
    where i.id = p_id and i.estado = 'activa'
  );
$$;

revoke all on function public.invitacion_esta_activa(uuid) from public;
grant execute on function public.invitacion_esta_activa(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 1d. Fuera la lectura anónima enumerable
-- ------------------------------------------------------------
--
-- Esta es LA policy del hallazgo 5. Se elimina: la lectura pública ya no
-- pasa por la tabla sino por las funciones de arriba.
drop policy if exists "Cualquiera ve las invitaciones activas" on public.invitaciones;

-- La lectura del dueño en /cuenta se queda intacta: la fila es suya.
-- (Se re-declara idéntica por si una base reconstruida no la tuviera;
--  es la misma de la 0066.)
drop policy if exists "El cliente ve sus invitaciones" on public.invitaciones;
create policy "El cliente ve sus invitaciones" on public.invitaciones
  for select to authenticated
  using (cliente_id = auth.uid());

-- El admin necesita SEGUIR viendo cualquier invitación por sesión (no
-- por service role): la pantalla de impresión `/i/{slug}/imprimir`
-- produce la hoja del cliente y la lee con la cookie del admin. Sin la
-- policy abierta, y como el admin NO es el `cliente_id`, esa lectura se
-- quedaba en null → notFound. Se le da su propia policy, atada al rol
-- real en `perfiles` (nunca a la metadata del cliente, misma regla que
-- todo el panel). Un anónimo tiene `auth.uid()` nulo → el `exists` da
-- falso → sigue sin poder enumerar nada.
drop policy if exists "El admin ve todas las invitaciones" on public.invitaciones;
create policy "El admin ve todas las invitaciones" on public.invitaciones
  for select to authenticated
  using (
    exists (
      select 1 from public.perfiles p
      where p.id = auth.uid() and p.rol = 'admin'
    )
  );

-- El RSVP anónimo, ahora sin depender de la RLS de lectura (ver 1c).
drop policy if exists "Cualquiera confirma asistencia" on public.invitacion_rsvp;
create policy "Cualquiera confirma asistencia" on public.invitacion_rsvp
  for insert to anon, authenticated
  with check (public.invitacion_esta_activa(invitacion_id));

-- Defensa en profundidad: se le retira a `anon` el SELECT de tabla. Ya
-- no hay ningún lector anónimo directo (todos pasan por las funciones),
-- así que aunque mañana alguien agregue una policy amplia por error, o
-- intente colar `invitaciones` en un embed de PostgREST, el anónimo
-- sigue recibiendo `permission denied` en vez de datos. `authenticated`
-- conserva el grant: lo necesitan las policies del dueño y del admin.
revoke select on public.invitaciones from anon;


-- ============================================================
-- 2. ranchos.destacado_orden — solo la plataforma destaca
-- ============================================================
--
-- `destacado_orden` es el puesto de un negocio en la grilla de la
-- portada, y lo pone EL ADMIN (src/app/admin/.../ranchos/actions.ts),
-- nunca el dueño. Pero el dueño tiene UPDATE sobre su propia fila (RLS
-- de la 0011) y —clave— el grant de UPDATE de la 0008 es a NIVEL DE
-- TABLA (`grant insert, update on ranchos to authenticated`), no por
-- columna. En Postgres el privilegio efectivo sobre una columna es la
-- UNIÓN del grant de tabla y el de columna: mientras exista el de
-- tabla, un `revoke update (destacado_orden)` NO surte ningún efecto.
-- O sea: cualquier dueño podía pegarle directo a la API y auto-subirse
-- el puesto.
--
-- POR QUÉ UN TRIGGER Y NO UN GRANT POR COLUMNA:
--   · El grant por columna exigiría primero `revoke update on ranchos`
--     entero y luego re-otorgar TODAS las demás columnas una por una —
--     frágil (cada columna nueva habría que acordarse de sumarla) y con
--     riesgo de romper el guardado del dueño.
--   · Y aunque se hiciera, seguiría sin distinguir al admin: el admin
--     también escribe como rol `authenticated` (requireAdmin usa la
--     cookie, no el service role), así que un `revoke ... authenticated`
--     le quitaría la columna también A ÉL y rompería la función de
--     destacar del panel.
-- El trigger sí distingue por ACTOR y es el patrón que el repo ya usa
-- para esto (`ranchos_proteger_dueno`, 0116): revierte/rechaza el cambio
-- salvo que venga de un admin o del service role.
create or replace function public.ranchos_proteger_destacado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.destacado_orden is distinct from old.destacado_orden then
    -- `auth.uid()` nulo = `service_role` o un job del servidor: pasa.
    -- El dueño NO entra acá a favor: destacarse lo decide la
    -- plataforma. Solo un admin (por su rol en `perfiles`, no por lo
    -- que diga la metadata del cliente) puede mover el puesto.
    if auth.uid() is not null
       and not exists (
         select 1 from public.perfiles p
         where p.id = auth.uid() and p.rol = 'admin'
       ) then
      raise exception
        'Solo un administrador puede cambiar el orden de destacado.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ranchos_proteger_destacado on public.ranchos;
create trigger ranchos_proteger_destacado
  before update of destacado_orden on public.ranchos
  for each row
  execute function public.ranchos_proteger_destacado();

-- Nadie llama esta función a mano; solo la dispara el trigger.
revoke all on function public.ranchos_proteger_destacado() from public, anon, authenticated;


-- ============================================================
-- 3. bucket `comprobantes` público — POR QUÉ NO SE TOCA ACÁ
-- ============================================================
--
-- El hallazgo 7a pide volver el bucket privado. Se investigó a fondo y
-- NO se hace en esta migración, a propósito, porque un `public=false` a
-- secas HOY ROMPE cosas en silencio:
--
--   · La VISTA de comprobantes ya está bien: el admin (invitaciones y
--     eventos) y el dueño (agenda) los abren con `createSignedUrl` de 60
--     s, nunca con la URL pública. Esa parte ya trata al bucket como si
--     fuera privado. Volverlo privado NO rompe la vista.
--
--   · PERO el MISMO bucket guarda los LOGOS y BANDAS de la tarjeta de
--     lealtad (`solicitudes_alta.pase_logo_url`, etc.), que son públicos
--     A PROPÓSITO: el generador del pase de Wallet los baja con un
--     `fetch` SIN sesión (src/lib/wallet/generar.ts → bajarImagen) y los
--     hornea dentro del .pkpass; además las vistas previas, el póster y
--     la tarjeta de lealtad los pintan con `getPublicUrl`. Un
--     `public=false` deja todas esas URLs `/object/public/...` en 400 y
--     rompe los pases y las vistas de lealtad — sin error de build, solo
--     imágenes rotas. Es exactamente lo que la propia 0144 advierte.
--
-- El arreglo correcto (invasivo, para decidir aparte) es SEPARAR los dos
-- usos: un bucket PÚBLICO para logos/bandas de lealtad y dejar
-- `comprobantes` privado solo para los recibos de pago. Eso toca las
-- subidas (opciones-pago.tsx, wizard-alta.tsx, planes/formulario-
-- solicitud.tsx, lib/lealtad/subida-alta.ts), la bajada del pase
-- (lib/wallet/generar.ts, google.ts) y los datos ya guardados. Por su
-- tamaño y su riesgo, se deja para una migración propia con su código.
-- Volver privado el bucket entero SIN eso rompería Wallet: por eso acá
-- no va ninguna sentencia — mejor no romper que cerrar a medias.


-- ============================================================
-- 4. visitas_pagina_resumen a `anon` — POR QUÉ SE DEJA
-- ============================================================
--
-- El hallazgo 8 (BAJA) propone revocarle el execute a `anon`. No se hace
-- porque el CONTADOR PÚBLICO la necesita como anónimo:
--   · La web la llama desde el servidor con la llave ANÓNIMA
--     (src/lib/visitas.ts → createAnonClient), porque corre dentro de
--     `unstable_cache`, que no puede tocar cookies.
--   · La app móvil la llama DIRECTO desde el teléfono con la anon key
--     (mobile/src/lib/visitas.ts); un visitante sin sesión es `anon` y
--     no tiene otra llave posible.
-- Revocarla apagaría el contador ("N personas visitaron este sitio") en
-- web y móvil. Además el dato es agregado y de a un negocio por llamada,
-- y ese número YA se muestra en la página: el riesgo es marginal. Se
-- deja como está y se reporta para que el humano decida.


-- ============================================================
-- Que PostgREST recargue el esquema (funciones y policies nuevas).
-- ============================================================
notify pgrst, 'reload schema';
