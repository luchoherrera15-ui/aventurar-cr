
-- ─────────────────────────────────────────────────────────────────────
-- 0187: el directorio público y Bookea Lealtad dejan de ser la misma lista.
--
-- `ranchos` sirve a DOS productos:
--   (a) el marketplace/directorio de proveedores de eventos
--   (b) Bookea Lealtad, que se contrata aparte en bookea.lat/lealtad
--
-- Un negocio que nace en /lealtad/nuevo NO es un proveedor del
-- directorio —no tiene provincia, ni cédula verificada, ni ficha— pero
-- hoy cae igual en la cola de aprobación del admin, suma en el contador
-- de "publicaciones esperando aprobación" y su dueño lo ve bajo el
-- título "Marketplace de ranchos".
--
-- NO se puede resolver con lo que ya existe:
--   · `estado`               significa lo mismo para los dos productos
--   · `lealtad_aprobado_en`  es OTRO eje (0129: "en revisión PARA
--                            lealtad"), y el alta de lealtad lo pone en
--                            now(), así que no distingue nada
--   · `vertical`             la 0125 prohíbe explícitamente 'lealtad'
--   · `plan_lealtad`         un negocio del marketplace también lo tiene
-- Va una columna propia.
--
-- TRES EJES, Y NO HAY QUE MEZCLARLOS:
--   estado                 publicada / esperando / rechazada   (0008)
--   lealtad_aprobado_en    aprobada PARA lealtad               (0129)
--   en_marketplace         ¿esta fila es una ficha del directorio?
--
-- ORDEN: primero se pega esto, después sale el deploy. Al revés, el
-- INSERT del alta de lealtad manda una columna que no existe y el alta
-- entera se cae. Si el deploy tarda no pasa nada: los negocios nuevos
-- nacen en `true` (igual que hoy) hasta que llegue el código.
--
-- ANTES DE PEGAR ESTO conviene correr docs/pegar-0187-en-marketplace.sql
-- (PASO 0): lista con nombre y todo las filas que el backfill va a sacar
-- del directorio. Si ahí aparece un negocio de verdad, no seguir.
-- ─────────────────────────────────────────────────────────────────────


-- ── PASO 1 — columna + backfill, en un bloque de UNA SOLA PASADA ─────
--
-- El guard por "¿ya existe la columna?" es el patrón de la 0127/0129, y
-- acá es OBLIGATORIO, no cosmético: las migraciones se pegan a mano y
-- este archivo se va a re-pegar (la 0140 pide re-pegarla cada vez que
-- aparece una columna nueva en `ranchos`). Sin el guard, un negocio que
-- un admin corrigió a mano con `set en_marketplace = true` volvería a
-- quedar marcado en falso en el próximo pegado, en silencio. Ya pasó
-- con la siembra de la 0169.
do $m187$
declare
  marcados integer := 0;
  nombres  text;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'ranchos'
       and column_name  = 'en_marketplace'
  ) then
    raise notice '0187: la columna ya existe — no se re-marca nada.';
    return;
  end if;

  -- Default TRUE a propósito: en la duda, un negocio SIGUE siendo del
  -- marketplace. Ninguna fila existente cambia de comportamiento por el
  -- solo hecho del ALTER.
  alter table public.ranchos
    add column en_marketplace boolean not null default true;

  -- Sin estas dos tablas no hay con qué PROBAR que un negocio nació en
  -- Lealtad. La columna queda creada y todo en true: exactamente igual
  -- que hoy. El backfill se corre después a mano con el archivo de docs.
  if to_regclass('public.solicitudes_lealtad') is null
     or to_regclass('public.verificacion_proveedores') is null then
    raise notice '0187: falta la 0130 o la 0046 — columna creada, BACKFILL NO CORRIDO. Correr el PASO 2 de docs/pegar-0187-en-marketplace.sql cuando estén.';
    return;
  end if;

  -- ── EL PREDICADO ──────────────────────────────────────────────────
  -- Todo con AND, nunca con OR. Es una PRUEBA POSITIVA de que la fila
  -- nació en Lealtad, no una corazonada de "ficha vacía":
  --
  -- 1. HUELLA DE NACIMIENTO. Una fila de `solicitudes_lealtad` que
  --    apunta a este rancho Y trae `negocio_nombre` solo la escriben
  --    los caminos de ALTA de lealtad (el alta gratis la inserta ella
  --    misma; el alta aprobada a mano o por Stripe enlaza el rancho de
  --    vuelta). Una solicitud de UPGRADE —un negocio del marketplace
  --    que compra Lealtad— sale con `negocio_nombre` en null.
  --
  --    OJO, Y POR ESO NO VA SOLA: el CHECK `solicitudes_alta_coherente`
  --    de la 0130 es `rancho_id is not null OR negocio_nombre is not
  --    null`. Es un OR: exige AL MENOS UNO, NO prohíbe tener los dos.
  --    La exclusividad "upgrade ⇒ negocio_nombre null" vive SOLO en
  --    TypeScript, así que la base no la garantiza y una fila escrita a
  --    mano en el SQL Editor puede traer las dos cosas. Por eso esta
  --    señal se suma a las otras con AND en vez de ser una rama de OR.
  --
  -- 2. AUSENCIA DE PROVEEDOR. Sin provincia y sin fila en
  --    `verificacion_proveedores`. Las tres altas reales del
  --    marketplace (web, app y admin) rebotan sin provincia, y las dos
  --    de dueño escriben la cédula + redes en el mismo paso (0046).
  --
  -- 3. FICHA INTACTA Y `estado = 'pendiente'`. Nunca se toca un
  --    'aprobado': una ficha que HOY es pública no puede desaparecer
  --    del directorio por este backfill, pase lo que pase. El resto
  --    (categoría 'otros', sin descripción, sin precio, sin capacidad,
  --    sin fotos) es exactamente lo que escribe el INSERT del alta de
  --    lealtad, y nada más.
  with marcadas as (
    update public.ranchos r
       set en_marketplace = false
     where r.estado = 'pendiente'
       and r.provincia is null
       and r.categoria = 'otros'
       and r.subcategoria is null
       and r.descripcion is null
       and r.contacto_whatsapp is null
       and r.precio_desde is null
       and r.capacidad_min is null
       and r.capacidad_max is null
       and r.foto_url is null
       and coalesce(r.fotos, '[]'::jsonb) = '[]'::jsonb
       and r.lealtad_aprobado_en is not null
       and not exists (
             select 1 from public.verificacion_proveedores v
              where v.rancho_id = r.id)
       and exists (
             select 1 from public.solicitudes_lealtad s
              where s.rancho_id = r.id
                and s.negocio_nombre is not null)
    returning r.nombre
  )
  select count(*), coalesce(string_agg(nombre, ' · '), '—')
    into marcados, nombres
    from marcadas;

  raise notice '0187: % negocio(s) quedaron FUERA del directorio: %', marcados, nombres;
end
$m187$;

comment on column public.ranchos.en_marketplace is
  'true = ficha del directorio público del marketplace: sale en la cola de aprobación del admin, en el contador de pendientes y bajo "Marketplace de ranchos" en /mi-negocio. false = el negocio nació en Bookea Lealtad y nunca se ofreció como proveedor. Es un eje APARTE de `estado` (publicado o no) y de `lealtad_aprobado_en` (0129, aprobado PARA lealtad).';


-- ── PASO 2 — el permiso de la columna (SIN ESTO NO SE PUEDE LEER) ────
--
-- La 0140 (anon) y la 0155 (authenticated) cambiaron el `select` de
-- tabla sobre `ranchos` por uno COLUMNA POR COLUMNA, para esconder las
-- 6 columnas de cobro. La lista quedó congelada en el momento en que
-- corrieron: toda columna agregada después nace SIN permiso, y una
-- consulta que la pida —o que la use en un WHERE, que también cuenta—
-- devuelve 42501. Mismo trampolín que ya dejaron escrito la 0169 y la
-- 0170.
--
-- Se otorga SOLO esta columna: un `grant select on ranchos` entero
-- volvería a abrir el SINPE y las cuentas bancarias.
do $g187$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant select (en_marketplace) on table public.ranchos to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select (en_marketplace) on table public.ranchos to authenticated';
  end if;
end
$g187$;


-- ── PASO 3 — que el dueño no se mueva solo de lista ──────────────────
--
-- La 0008 da `grant insert, update on ranchos to authenticated` a nivel
-- TABLA y su política deja al dueño editar su propia fila; la 0140/0155
-- solo revocaron el SELECT. O sea que sin candado, el dueño de un
-- negocio de lealtad manda un PATCH y se mete solo en la cola de
-- aprobación del admin.
--
-- Cuarto candado de la misma familia: estado (0008), owner_id (0116),
-- lealtad_aprobado_* (0129), plan_lealtad (0148).
--
-- LANZA EN VEZ DE IGNORAR EN SILENCIO, a propósito: el día que exista
-- el botón "también quiero aparecer en el directorio", un candado que
-- revierte calladito diría "guardado" sin guardar nada. Y no puede
-- molestar a un guardado normal: el trigger tiene `when (old is
-- distinct from new)`, así que un UPDATE que manda la columna con el
-- mismo valor ni lo despierta.
--
-- El camino de vuelta sí existe: la llave de servicio y los admins
-- pasan (mismo criterio que la 0129), así que una server action puede
-- devolver un negocio al directorio.
create or replace function public.ranchos_proteger_en_marketplace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn187$
begin
  if auth.uid() is null then
    return new; -- service_role: el servidor decide (altas de lealtad, admin)
  end if;
  if exists (select 1 from public.perfiles p
              where p.id = auth.uid() and p.rol = 'admin') then
    return new;
  end if;
  raise exception 'Aparecer en el directorio de Bookea lo decide Bookea. Escribinos y lo movemos.'
    using errcode = '42501';
end;
$fn187$;

comment on function public.ranchos_proteger_en_marketplace() is
  'Candado de `ranchos.en_marketplace` (0187): solo un admin o la llave de servicio mueven un negocio de lista. Sin esto el dueño se metía solo en la cola de aprobación del directorio con un PATCH.';

drop trigger if exists ranchos_proteger_en_marketplace on public.ranchos;
create trigger ranchos_proteger_en_marketplace
  before update of en_marketplace on public.ranchos
  for each row
  when (old.en_marketplace is distinct from new.en_marketplace)
  execute function public.ranchos_proteger_en_marketplace();

-- PostgREST cachea el esquema y los permisos: sin esto, la API sigue
-- contestando con las reglas viejas y el INSERT del alta rebota con
-- PGRST204 aunque la columna ya exista.
notify pgrst, 'reload schema';


-- ── ÍNDICE: hoy NO hace falta, y decirlo es parte de la respuesta ────
-- Los cinco puntos de fuga filtran por owner_id (/mi-negocio, el
-- header, la app) o leen la tabla entera en memoria (el admin, con
-- decenas de filas). Postgres va a leer la tabla igual y un índice solo
-- agregaría costo de escritura. El día que el directorio tenga miles de
-- fichas, el que se paga solo es este — queda escrito para no
-- inventarlo bajo presión:
--
--   create index if not exists ranchos_cola_directorio_idx
--     on public.ranchos (created_at desc)
--     where en_marketplace and estado = 'pendiente';


-- ── EL RESULTADO, EN PANTALLA ────────────────────────────────────────
-- Los `raise notice` de arriba NO se ven en el panel de resultados del
-- SQL Editor de Supabase. Esta última sentencia sí se pinta como
-- grilla: es el rastro de quién quedó fuera del directorio. Toca solo
-- `ranchos`, así que no puede fallar por una tabla que no exista y
-- tumbar la migración entera al final.
select r.nombre,
       r.slug,
       r.estado,
       r.vertical,
       r.plan_lealtad,
       r.created_at
  from public.ranchos r
 where not r.en_marketplace
 order by r.created_at;
