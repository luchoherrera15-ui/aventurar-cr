-- ============================================================
-- BOOKEA — Categorías propias del negocio (0119)
--
-- Tercera y última pieza de la Tanda 1 (docs/citas-roadmap.md). La
-- 0117 dijo QUÉ es un servicio, la 0118 CUÁNDO se reserva; esta dice
-- CÓMO SE ORDENA el catálogo.
--
-- ------------------------------------------------------------
-- LO QUE YA EXISTÍA, Y POR QUÉ NO SE REEMPLAZA
-- ------------------------------------------------------------
-- El negocio YA puede agrupar su catálogo: `rancho_items.grupo` (0050)
-- es un texto libre — "Cortes", "Barba", "Estaciones", "Bebidas" — y
-- `agruparPorSeccion` (src/lib/catalogo.ts) arma las secciones con él.
-- Lo usan doce archivos entre la web y la app: la vitrina pública, el
-- flujo de reserva, el panel y la pantalla de catálogo del teléfono.
--
-- La tentación era crear `categorias_negocio` con su id, ponerle un
-- `categoria_id` a `rancho_items` y migrar los `grupo` existentes.
-- NO se hace, por dos razones:
--
--   1. Habría DOS fuentes de verdad — `grupo` y `categoria_id` — salvo
--      que se borre la vieja, y acá no se borran columnas.
--   2. Obligaría a tocar los doce archivos de golpe, incluidos los de
--      Eventos, para no ganar nada que el texto no dé ya.
--
-- Lo que a `grupo` le falta NO es identidad: es ORDEN. Hoy una sección
-- aparece donde aparece su primer ítem, así que para mover "Barba"
-- arriba de "Cortes" hay que reordenar ítems uno por uno. Eso es lo
-- único que esta tabla agrega.
--
-- Entonces `categorias_negocio` guarda SOLO lo que no se puede
-- derivar del catálogo — el mismo criterio de `clientes_negocio`
-- (0109). El ítem sigue apuntando a su sección por nombre.
--
-- ------------------------------------------------------------
-- QUÉ SIGNIFICA QUE UNA SECCIÓN NO TENGA FILA ACÁ
-- ------------------------------------------------------------
-- Que se comporta como siempre. La tabla es OPCIONAL y PARCIAL:
--
--   · sección CON fila     → va en la posición que diga `orden`.
--   · sección SIN fila     → conserva el comportamiento viejo (aparece
--                            donde aparece su primer ítem), después de
--                            las ordenadas.
--   · sin ninguna fila     → el catálogo se ve exactamente como hoy.
--
-- Por eso ningún negocio necesita migración de datos, y por eso los
-- lugares para alquilar no se enteran: `rancho_items` no se toca, y
-- sin filas acá nada cambia. El panel que administra esto además vive
-- detrás de `vertical === 'citas'`, igual que la 0117 y la 0118.
--
-- ------------------------------------------------------------
-- BORRAR UNA CATEGORÍA NO BORRA SERVICIOS
-- ------------------------------------------------------------
-- Es la consecuencia buena de no tener FK: eliminar la fila solo
-- pierde el orden explícito de esa sección; los servicios quedan
-- intactos con su `grupo` y vuelven al orden implícito. Un `delete`
-- acá NUNCA puede llevarse un servicio por delante.
--
-- El renombrado sí tiene que arrastrar: cambiar "Uñas" por "Manicure"
-- debe actualizar el `grupo` de los ítems de ESE negocio. Eso lo hace
-- la acción de servidor `renombrarCategoria` en una transacción, no un
-- trigger: un trigger que reescribe `rancho_items` desde otra tabla es
-- justo el tipo de efecto invisible que después nadie encuentra.
--
-- ------------------------------------------------------------
-- UN SOLO NIVEL, A PROPÓSITO
-- ------------------------------------------------------------
-- La especificación (cap. 5) muestra dos niveles: Fitness > Yoga,
-- Belleza > Uñas. Acá va UNO solo, y es una decisión, no un recorte
-- por pereza:
--
--   · El ítem apunta a UNA sección por nombre. Con dos niveles hay que
--     decidir si apunta al padre o al hijo, y reescribir el render de
--     secciones en los doce archivos — web, app, vitrina y panel.
--   · Los negocios reales de esta vertical (barberías, uñas, spa,
--     gimnasios) tienen entre 8 y 20 servicios. "Cortes / Barba /
--     Color" es un nivel. Dos niveles es complejidad de catálogo
--     grande para catálogos que no lo son.
--   · Agregarlo después es UNA columna anulable (`padre_id uuid
--     references categorias_negocio(id)`) y el render que ya haga
--     falta. No agregarla hoy no cierra ninguna puerta.
--
-- Cuando un negocio real pida el segundo nivel, se abre. Mientras
-- tanto no se paga su costo.
-- ============================================================

create table if not exists categorias_negocio (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,

  -- El nombre ES la llave contra `rancho_items.grupo`. Mismo límite
  -- que rancho_items_grupo_check (0050): si acá cupiera un nombre que
  -- allá no, renombrar dejaría ítems huérfanos.
  nombre text not null check (char_length(trim(nombre)) between 1 and 40),

  orden integer not null default 0,
  created_at timestamptz not null default now()
);

-- Sin duplicados por negocio, sin importar mayúsculas ni espacios:
-- "Cortes" y "cortes " serían dos secciones que se ven igual y
-- agrupan distinto.
create unique index if not exists categorias_negocio_nombre_idx
  on categorias_negocio (rancho_id, lower(trim(nombre)));

create index if not exists categorias_negocio_rancho_idx
  on categorias_negocio (rancho_id, orden);

alter table categorias_negocio enable row level security;

-- LECTURA: pública. Las secciones son parte de la vitrina — el cliente
-- sin sesión que abre la página de reservas tiene que verlas en el
-- orden que el dueño quiso, igual que ve `rancho_items` desde la 0035.
-- No hay nada privado acá: son los mismos nombres que ya se muestran.
drop policy if exists "Las secciones del catálogo son públicas" on categorias_negocio;
create policy "Las secciones del catálogo son públicas" on categorias_negocio
  for select to anon, authenticated
  using (true);

-- ESCRITURA: quien administra el negocio. `gestiona_rancho()` (0116)
-- ya resuelve dueño, colaborador y admin en una sola función, así que
-- no se reimplementa la comparación con owner_id — que es exactamente
-- el error que la 0116 evitó al no reescribir 77 políticas a mano.
drop policy if exists "Quien administra el negocio ordena sus secciones"
  on categorias_negocio;
create policy "Quien administra el negocio ordena sus secciones" on categorias_negocio
  for all to authenticated
  using (gestiona_rancho(rancho_id))
  with check (gestiona_rancho(rancho_id));

-- Los permisos "de fondo". Crear la tabla por SQL no los otorga solos y
-- la RLS NO los reemplaza: sin esto, PostgREST responde "permission
-- denied for table categorias_negocio" a todo el mundo, con las
-- políticas perfectamente escritas al lado. Mismo par que la 0109 usó
-- para `clientes_negocio` y la 0116 para `rancho_colaboradores`.
--
-- `anon` lleva SELECT y nada más: el visitante sin sesión tiene que ver
-- el orden de las secciones al reservar, pero no escribir. Quién puede
-- escribir de verdad lo decide la política de arriba
-- (`gestiona_rancho`), no este grant.
grant select on categorias_negocio to anon;
grant select, insert, update, delete on categorias_negocio to authenticated;
grant all on categorias_negocio to service_role;

comment on table categorias_negocio is
  'Orden explícito de las secciones del catálogo de un negocio (0119). '
  'El ítem sigue apuntando a su sección por nombre en rancho_items.grupo: '
  'esta tabla NO es dueña de la relación, solo del orden. Una sección sin '
  'fila acá conserva el orden implícito (aparece donde su primer ítem). '
  'Borrar una fila no toca ningún servicio.';

comment on column categorias_negocio.nombre is
  'Debe coincidir con rancho_items.grupo de ese negocio. Renombrar exige '
  'arrastrar el grupo de los ítems — lo hace renombrarCategoria en el '
  'servidor, no un trigger.';
