-- ============================================================
-- BOOKEA — El país deja de ser un supuesto (0170)
--
-- Bookea sale de Costa Rica. Esta migración es LA BASE de esa salida:
-- deja el PAÍS como dato de primera clase en `ranchos` y le quita a la
-- tabla el único candado que hoy hace IMPOSIBLE guardar un negocio que
-- no sea tico. No trae ruteo por país (/cr, /pa) ni moneda por país:
-- eso viene después y no toca el esquema.
--
-- ------------------------------------------------------------
-- LO QUE ENCONTRAMOS AL REVISAR (importante, cambió el plan)
--
-- `ranchos.pais` YA EXISTE. La trajo la 0062 (`hospedajes y país`)
-- junto con `zona_horaria`, pensando exactamente en esto:
--
--     alter table ranchos add column if not exists pais text
--       not null default 'CR' check (char_length(pais) = 2);
--     create index if not exists ranchos_pais_idx on ranchos (pais);
--
-- O sea que NO hay que crear la columna: hay que TERMINARLA. Tal como
-- quedó tiene tres cosas a medio hacer:
--
--   1. Guarda 'CR' en MAYÚSCULA. El ruteo que viene son URLs /cr, /pa,
--      /mx — minúsculas. Dos convenciones para el mismo dato es un bug
--      esperando: alguien va a comparar `pais === "cr"` contra un 'CR'
--      guardado y el filtro va a devolver cero negocios en silencio.
--   2. `char_length(pais) = 2` acepta 'XX', '99', 'ñ!' y 'Cr'. No es
--      una validación de código ISO, es una de largo.
--   3. Nadie la lee. `grep` sobre src/ y mobile/: la columna solo se
--      ESCRIBE (mi-negocio/nuevo/actions.ts, mobile/negocio/nuevo.tsx y
--      los seeds). Ninguna consulta la trae de vuelta — ni siquiera
--      está en las listas de columnas de src/lib/ranchos-publicos.ts.
--      Eso es lo que la hace segura de normalizar HOY: no hay código
--      comparando contra 'CR' que se pueda romper al pasarlo a 'cr'.
--
-- EL BLOQUEO REAL es otro y está en la 0008, línea 124:
--
--     provincia text check (
--       provincia in ('San José','Alajuela','Cartago','Heredia',
--                     'Guanacaste','Puntarenas','Limón')
--     )
--
-- Un negocio de Panamá con provincia 'Chiriquí' NO SE PUEDE INSERTAR.
-- La base lo rechaza antes de que ninguna pantalla se entere. Ese CHECK
-- es lo que esta migración quita.
--
-- ------------------------------------------------------------
-- COMPATIBILIDAD: NADA DE COSTA RICA CAMBIA
--
-- Este archivo lo pega el dueño a mano en el SQL Editor, así que NO se
-- puede coordinar con un deploy: puede correr antes o después de que el
-- código nuevo esté arriba. Por eso la normalización a minúscula se
-- sostiene con un TRIGGER y no solo con un CHECK. El formulario de alta
-- que hoy manda `pais: "CR"` (src/app/mi-negocio/nuevo/actions.ts:38 y
-- mobile/src/app/negocio/nuevo.tsx:204) sigue funcionando igual: el
-- trigger lo baja a 'cr' antes de guardar. Si en vez del trigger
-- hubiéramos puesto solo el CHECK, pegar esto un minuto antes del
-- deploy tumbaba el alta de negocios en producción.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================


-- ------------------------------------------------------------
-- 1. LA COLUMNA `pais`: existir, tener default y no admitir nulos
--
-- El `add column if not exists` es para una base a medio migrar (o una
-- de desarrollo recién creada). En producción no hace nada: la columna
-- ya está desde la 0062 y este paso pasa de largo sin tocar la tabla.
-- ------------------------------------------------------------

alter table ranchos add column if not exists pais text;

-- El default pasa de 'CR' a 'cr'. Cambiar un default es solo una
-- entrada en el catálogo: no reescribe ni una fila, no toma lock largo.
-- Costa Rica sigue siendo el caso por defecto — lo que cambia es cómo
-- se escribe, no cuál es.
alter table ranchos alter column pais set default 'cr';


-- ------------------------------------------------------------
-- 2. NORMALIZAR LOS DATOS QUE YA ESTÁN
--
-- Va ANTES de los CHECK nuevos a propósito: si se validara primero, la
-- migración fallaría contra las filas viejas que dicen 'CR'.
--
-- Son ~decenas/cientos de filas (el directorio entero de Bookea), así
-- que un solo UPDATE es cuestión de milisegundos. Si `ranchos` algún
-- día llegara a millones, esto se haría por lotes con un `where id in
-- (select id ... limit 5000)` en bucle, para no tener una transacción
-- larga encima de una tabla viva.
--
-- El `is distinct from` hace que la segunda pegada no escriba nada:
-- cero filas tocadas, cero vacuum, cero ruido en la replicación.
-- ------------------------------------------------------------

update ranchos
   set pais = 'cr'
 where pais is null
    or btrim(pais) = '';

update ranchos
   set pais = lower(btrim(pais))
 where pais is distinct from lower(btrim(pais));

-- `provincia` vacía se vuelve NULL. Hoy no debería haber ninguna (el
-- CHECK viejo tampoco aceptaba '': no está en la lista de las siete),
-- pero se limpia igual porque el CHECK nuevo sí distingue entre "no lo
-- llenó" (NULL, permitido) y "lo llenó con nada" ('', prohibido) — y
-- una fila con '' haría fallar la validación de más abajo.
update ranchos
   set provincia = null
 where provincia is not null
   and btrim(provincia) = '';

-- Y de paso se le quitan los espacios de sobra a las que sí tienen algo:
-- ' San José ' y 'San José' son la misma provincia y no pueden agrupar
-- distinto en los filtros del directorio.
update ranchos
   set provincia = btrim(provincia)
 where provincia is distinct from btrim(provincia);

-- NOT NULL: en producción ya lo es (la 0062 la creó así), y en ese caso
-- este bloque no ejecuta nada. Se pregunta primero porque un `set not
-- null` a secas escanea la tabla entera aunque no haga falta.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'ranchos'
       and column_name  = 'pais'
       and is_nullable  = 'YES'
  ) then
    execute 'alter table public.ranchos alter column pais set not null';
    raise notice 'ranchos.pais ahora es NOT NULL.';
  else
    raise notice 'ranchos.pais ya era NOT NULL: no se toca.';
  end if;
end $$;


-- ------------------------------------------------------------
-- 3. EL TRIGGER QUE MANTIENE LA CONVENCIÓN
--
-- Una sola forma de escribir el país en toda la base: minúsculas, sin
-- espacios. Da igual si quien inserta es la web, la app, un seed, el
-- panel de admin o un `insert` a mano desde el SQL Editor.
--
-- Es lo que permite pegar este archivo SIN coordinar con un deploy: el
-- código que hoy manda 'CR' sigue andando y guarda 'cr'.
--
-- También arregla el `provincia = ''` en el momento de escribir, para
-- que el CHECK de abajo nunca le explote en la cara a un formulario que
-- mandó el campo en blanco: se guarda como NULL, que es lo que quiso
-- decir.
--
-- `search_path = ''` es la recomendación de Supabase para funciones:
-- evita que un esquema puesto en el path por el llamador secuestre un
-- nombre. Acá no se referencia ninguna tabla y `lower`/`btrim` viven en
-- pg_catalog, que siempre está en el path.
-- ------------------------------------------------------------

create or replace function public.ranchos_normalizar_pais()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.pais := lower(btrim(coalesce(new.pais, 'cr')));
  if new.pais = '' then
    new.pais := 'cr';
  end if;

  if new.provincia is not null then
    new.provincia := btrim(new.provincia);
    if new.provincia = '' then
      new.provincia := null;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.ranchos_normalizar_pais() is
  'Normaliza ranchos.pais a ISO-3166 alpha-2 en minúscula y limpia provincia. '
  'Existe para que el código viejo que manda ''CR'' siga funcionando sin deploy coordinado.';

drop trigger if exists ranchos_normalizar_pais_trg on ranchos;
create trigger ranchos_normalizar_pais_trg
  before insert or update of pais, provincia on ranchos
  for each row
  execute function public.ranchos_normalizar_pais();


-- ------------------------------------------------------------
-- 4. FUERA EL CANDADO DE LAS SIETE PROVINCIAS
--
-- El CHECK de la 0008 se declaró en línea, así que Postgres le puso un
-- nombre automático — normalmente `ranchos_provincia_check`, pero puede
-- ser `ranchos_provincia_check1` si en algún momento hubo dos. Por eso
-- no se confía en el nombre: se buscan TODAS las restricciones CHECK de
-- `ranchos` cuya definición nombre la columna `provincia` y se dropean.
-- Igual con las de `pais` (la de `char_length(pais) = 2` de la 0062).
--
-- El `\m…\M` es límite de palabra en el regex de Postgres: así
-- `provincia` no matchea dentro de otra palabra y no se lleva por
-- delante un CHECK ajeno.
--
-- Dropear un CHECK no toca ni una fila: solo borra la entrada del
-- catálogo. Es instantáneo.
-- ------------------------------------------------------------

do $$
declare
  c record;
begin
  -- Red de seguridad para una base a medio migrar.
  if to_regclass('public.ranchos') is null then
    raise notice 'ranchos no existe todavía — no hay nada que hacer.';
    return;
  end if;

  for c in
    select conname, pg_get_constraintdef(oid) as definicion
      from pg_constraint
     where conrelid = 'public.ranchos'::regclass
       and contype  = 'c'
       and (
         pg_get_constraintdef(oid) ~ '\mprovincia\M'
         or pg_get_constraintdef(oid) ~ '\mpais\M'
       )
  loop
    execute format('alter table public.ranchos drop constraint if exists %I', c.conname);
    raise notice 'CHECK removido: % → %', c.conname, c.definicion;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 5. LO QUE REEMPLAZA AL CANDADO
--
-- POR QUÉ NO UNA TABLA DE REGIONES CON FOREIGN KEY.
-- Era la opción "bien hecha" y se descartó a conciencia. Una tabla
-- `regiones(pais, nombre)` con FK desde `ranchos.provincia` obliga a
-- cargar y MANTENER A MANO las divisiones administrativas de cada país
-- al que Bookea entre: 7 provincias de CR, 10 de Panamá, 32 estados de
-- México, 24 de Colombia… y a decidir qué nivel es "la región" en cada
-- uno (¿estado o municipio en México? ¿departamento o provincia en
-- Perú?). Ese catálogo se desactualiza, hay que traducirlo, y el día
-- que falte una fila el alta de un negocio real FALLA — que es
-- exactamente el problema que estamos arreglando, movido de lugar.
-- Peor: `ranchos.provincia` es texto libre que ya escribieron cientos
-- de filas; una FK obliga a mapear cada valor histórico o a perder el
-- dato. No vale el costo para lo que compra (autocompletar bonito), y
-- eso se puede resolver en el formulario, del lado de la app, sin
-- volver la base rígida.
--
-- LO QUE SÍ SE PIDE. `provincia` pasa a ser texto libre CON PISO:
--
--   · NULL sigue permitido — hay negocios sin dirección física
--     (servicios a domicilio, animación, organización) y romperlos
--     sería exactamente lo que esta tanda promete no hacer.
--   · Si tiene algo, tiene que ser algo: ni '' ni solo espacios.
--   · Tope de 80 caracteres. No es burocracia: 'Provincia de Buenos
--     Aires' son 27, el nombre más largo de la región del mundo no pasa
--     de ~60. Un valor de 4000 caracteres ahí es un formulario mal
--     pegado o un intento de ensuciar el índice, no una región.
--
-- El CHECK ya no menciona ningún país. Es la misma protección de antes
-- (que el campo signifique algo) sin atarla a Costa Rica.
--
-- NOT VALID + VALIDATE es el patrón de tabla viva: el `add constraint`
-- solo escribe en el catálogo y toma un lock de un instante; el
-- `validate` escanea, pero con un lock que NO bloquea lecturas ni
-- escrituras. Con el tamaño actual de `ranchos` da lo mismo, pero es el
-- patrón correcto y el que hay que copiar cuando la tabla crezca.
--
-- El drop-y-vuelve-a-crear dentro de un solo `do` (una sola sentencia,
-- o sea atómico) evita el hueco en el que la tabla se quede sin
-- ninguna restricción si algo falla entre medio.
-- ------------------------------------------------------------

do $$
begin
  alter table public.ranchos
    drop constraint if exists ranchos_provincia_no_vacia;

  alter table public.ranchos
    add constraint ranchos_provincia_no_vacia
    check (
      provincia is null
      or (btrim(provincia) <> '' and char_length(provincia) <= 80)
    )
    not valid;
end $$;

alter table public.ranchos validate constraint ranchos_provincia_no_vacia;

-- `pais`: ahora sí una validación de código ISO-3166 alpha-2 y no una
-- de largo. Exactamente dos letras, minúsculas. 'CR' ya no entra por el
-- CHECK — entra por el trigger, que lo convierte antes.
do $$
begin
  alter table public.ranchos
    drop constraint if exists ranchos_pais_iso2;

  alter table public.ranchos
    add constraint ranchos_pais_iso2
    check (pais ~ '^[a-z]{2}$')
    not valid;
end $$;

alter table public.ranchos validate constraint ranchos_pais_iso2;

-- Nota deliberada: NO hay una lista blanca de países ('cr','pa','mx').
-- Abrir un país nuevo no puede depender de que el dueño pegue otro SQL
-- en producción; la lista de países en los que Bookea opera vive en
-- src/lib/zonas.ts (PAISES), que es donde se decide qué se le ofrece a
-- la gente en el alta. La base garantiza la FORMA del dato; la app
-- decide el CATÁLOGO. Mismo criterio que con `provincia`.


-- ------------------------------------------------------------
-- 6. EL ÍNDICE PARA FILTRAR POR PAÍS
--
-- Cómo se consulta `ranchos` hoy (verificado en src/app/eventos/page.tsx,
-- src/app/citas/page.tsx, /hospedajes, /restaurantes y src/lib/destacados.ts):
--
--     .eq("estado", "aprobado")           ← SIEMPRE
--     .eq("vertical", "citas")            ← casi siempre
--     .order("created_at", desc)          ← SIEMPRE
--
-- Cuando llegue el ruteo por país, a ese mismo patrón se le suma
-- `.eq("pais", "cr")` adelante. Por eso el índice es compuesto y
-- PARCIAL sobre las filas publicadas: el directorio nunca pregunta por
-- pendientes ni rechazados, así que meterlos en el índice solo lo
-- engorda. `created_at desc` va dentro del índice para que el orden de
-- la portada salga del índice y no de un sort.
--
-- El `ranchos_pais_idx` simple que creó la 0062 NO se borra. Hoy es
-- inútil (todas las filas dicen 'cr', el planner lo ignora), pero el
-- día que haya varios países sirve para las consultas del admin, que sí
-- miran negocios en cualquier estado. Es un índice chico y borrarlo no
-- compra nada.
--
-- Se usa `create index` normal y no `concurrently` porque:
--   · `concurrently` NO puede correr dentro de una transacción, y este
--     archivo se pega entero de una vez en el SQL Editor.
--   · `ranchos` tiene cientos de filas: la creación es de milisegundos.
-- Si algún día son millones, hay que sacar esta línea del archivo y
-- correrla aparte con CONCURRENTLY.
-- ------------------------------------------------------------

create index if not exists ranchos_pais_publicados_idx
  on ranchos (pais, vertical, created_at desc)
  where estado = 'aprobado';


-- ------------------------------------------------------------
-- 7. EL PERMISO DE COLUMNA (la trampa de la 0140/0155)
--
-- Desde la 0140 (anon) y la 0155 (authenticated), el SELECT sobre
-- `ranchos` NO es de tabla completa: es columna por columna, con la
-- lista congelada en el momento en que esas migraciones corrieron.
-- `pais` es de la 0062, o sea ANTERIOR, así que en producción ya tiene
-- el permiso. Se lo damos igual, explícito: es idempotente, cuesta
-- nada, y deja escrito el trampolín para el próximo que agregue una
-- columna acá. Sin esto, el día que el ruteo por país filtre por
-- `pais`, el directorio devolvería un 403 y nadie sabría por qué.
--
-- INSERT/UPDATE no se tocan: la 0008 los dio a nivel tabla
-- (`grant insert, update on ranchos to authenticated`) y ni la 0140 ni
-- la 0155 los revocaron — solo revocaron SELECT.
-- ------------------------------------------------------------

grant select (pais) on ranchos to anon, authenticated;


-- ------------------------------------------------------------
-- 8. RLS: NO CAMBIA, Y ES A PROPÓSITO
--
-- Las políticas de `ranchos` (0008) son:
--   · "Todos ven los ranchos aprobados" → estado = 'aprobado'
--     or owner_id = auth.uid() or is_admin()
--   · "Un dueño crea/edita su propio rancho" → owner_id = auth.uid()
--
-- Ninguna necesita saber el país, y meterle el país sería un error:
--   · El país es un criterio de PRESENTACIÓN (qué le muestro a quien
--     entra por /pa), no de PERMISO. Filtrarlo en RLS haría que un
--     negocio panameño fuera invisible para Google, para un tico que
--     quiere contratar en Panamá, y para el link que el propio dueño
--     comparte por WhatsApp.
--   · `auth.uid()` no dice de qué país es nadie. No hay con qué
--     comparar sin inventar un campo de país en el perfil y volver la
--     autorización dependiente de él.
-- El filtro por país va en la consulta (`.eq("pais", …)`), donde se
-- puede quitar cuando haga falta. RLS queda como está.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- 9. QUE EL ESQUEMA SE EXPLIQUE SOLO
-- ------------------------------------------------------------

comment on column ranchos.pais is
  'País del negocio en ISO-3166 alpha-2 MINÚSCULA (cr, pa, mx). Siempre minúscula: '
  'coincide con el segmento de URL del ruteo por país (/cr, /pa) y lo garantiza el '
  'trigger ranchos_normalizar_pais_trg, no solo el CHECK. Default ''cr'': Costa Rica '
  'es el caso por defecto. La lista de países habilitados NO está en la base — vive '
  'en src/lib/zonas.ts (PAISES), para poder abrir un país sin pegar SQL en producción.';

comment on column ranchos.provincia is
  'División administrativa de primer nivel del negocio, en el idioma del país: '
  'provincia en CR y PA, estado en MX, departamento en CO. Texto libre a propósito — '
  'hasta la 0170 estaba amarrada por CHECK a las 7 provincias de Costa Rica, lo que '
  'hacía imposible guardar un negocio extranjero. Se validan la forma y el largo, no '
  'el contenido: el catálogo de regiones lo ofrece el formulario, no la base. Puede '
  'ser NULL (servicios sin sede física). Interpretarla SIEMPRE junto con `pais`: '
  '''San José'' existe en Costa Rica y en Argentina.';

comment on column ranchos.zona_horaria is
  'Zona horaria IANA del negocio (0062). Es la que tienen que leer los motores de '
  'disponibilidad, recordatorios y calendarios — nunca asumir America/Costa_Rica. '
  'Se deriva de `pais` al dar de alta con zonaDePais() de src/lib/zonas.ts.';


-- PostgREST cachea esquema y permisos: sin esto la API sigue
-- contestando con las reglas viejas hasta el próximo reinicio.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------
-- CÓMO COMPROBARLO (pegar aparte, después de correr lo de arriba)
--
-- 1. Todo lo viejo quedó como Costa Rica, en minúscula:
--
--      select pais, count(*) from ranchos group by pais;
--      -- una sola fila: cr | <total>
--
-- 2. El candado de las siete provincias ya no está y el nuevo sí:
--
--      select conname, pg_get_constraintdef(oid), convalidated
--        from pg_constraint
--       where conrelid = 'ranchos'::regclass and contype = 'c'
--         and pg_get_constraintdef(oid) ~ '\mprovincia\M|\mpais\M';
--      -- ranchos_provincia_no_vacia y ranchos_pais_iso2, ambos con
--      -- convalidated = true. Ninguno nombrando 'San José'.
--
-- 3. Un negocio de Panamá ENTRA (esto antes fallaba):
--
--      insert into ranchos (owner_id, nombre, pais, provincia, estado)
--      values ((select id from auth.users limit 1),
--              'Prueba Panamá', 'PA', 'Chiriquí', 'pendiente')
--      returning id, pais, provincia;
--      -- devuelve pais = 'pa' (en minúscula, aunque se mandó 'PA':
--      -- eso es el trigger). Después: delete from ranchos where
--      -- nombre = 'Prueba Panamá';
--
-- 4. La basura NO entra:
--
--      update ranchos set provincia = '   ' where id = <alguno>;
--      -- queda NULL, no '   '  (trigger)
--      update ranchos set pais = 'costa rica' where id = <alguno>;
--      -- ERROR: viola ranchos_pais_iso2
--
-- 5. El público puede leer la columna:
--
--      curl "$SUPABASE_URL/rest/v1/ranchos?select=nombre,pais&limit=1" \
--           -H "apikey: $ANON_KEY"
--      -- 200 con el país, no 403.
-- ------------------------------------------------------------
