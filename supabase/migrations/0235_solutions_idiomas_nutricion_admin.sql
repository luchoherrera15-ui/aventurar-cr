-- ════════════════════════════════════════════════════════════════════
--  0235 · SOLUTIONS — MENÚ EN VARIOS IDIOMAS, FICHA NUTRICIONAL,
--         Y ALTA DESDE LA ADMINISTRACIÓN
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (5 sep 2026):
--   · «que el menú se pueda ver en cinco idiomas al mismo tiempo:
--     español, italiano, francés…»;
--   · «al clickear la foto de un plato, poder agregar cuánta proteína,
--     cuánto tal cosa — opcional, si el restaurante quiere»;
--   · «desde la administración, yo pongo el correo y les dejo el
--     paquete listo».
--
-- ── LOS IDIOMAS: UNA COLUMNA JSONB, NO UNA TABLA POR IDIOMA ─────────
-- Cada plato y cada sección guardan sus traducciones en `traducciones`:
--   { "en": { "nombre": "...", "descripcion": "..." }, "fr": { ... } }
-- El español sigue en `nombre`/`descripcion`, que es lo que ya existe y
-- lo que ve todo el código actual: un menú sin traducciones no cambia
-- nada. Una tabla aparte (item × idioma) sería más «normal» y también
-- más cara de leer —un join por cada plato del menú— para un dato que
-- siempre se lee entero junto con el plato. El negocio elige qué
-- idiomas OFRECE en `idiomas_menu`; el parser (idiomas.ts) es quien
-- acota qué llaves valen.
--
-- ── LA FICHA NUTRICIONAL: OPCIONAL, Y POR ESO NULL ──────────────────
-- `nutricion` es null para el plato que no la carga (la mayoría).
-- Forma: { "porcion": "300 g", "calorias": 520, "proteina": 24,
-- "carbohidratos": 60, "grasa": 18, "alergenos": ["gluten","lacteos"] }.
-- Sin CHECK de forma: la valida el parser del código, que puede decir
-- «gramos negativos» en español; un CHECK de jsonb solo diría «viola».
--
-- ── EL ALTA DESDE EL ADMIN ──────────────────────────────────────────
-- `origen` y `creado_por` dejan escrito quién armó el negocio. Es lo
-- que permite distinguir en el admin lo que Bookea le dejó listo a un
-- cliente de lo que el cliente creó solo, y a quién preguntarle.

alter table public.solutions_negocios
  add column if not exists idiomas_menu text[] not null default '{}'
  check (idiomas_menu <@ array['en', 'fr', 'it', 'pt', 'de']::text[]);

alter table public.solutions_menu_secciones
  add column if not exists traducciones jsonb not null default '{}'::jsonb;
alter table public.solutions_menu_items
  add column if not exists traducciones jsonb not null default '{}'::jsonb;
alter table public.solutions_menu_items
  add column if not exists nutricion jsonb;

alter table public.solutions_negocios
  add column if not exists origen text not null default 'publico'
  check (origen in ('publico', 'admin'));
alter table public.solutions_negocios
  add column if not exists creado_por uuid references auth.users (id) on delete set null;

comment on column public.solutions_negocios.idiomas_menu is
  'Idiomas que el menú ofrece además del español (en, fr, it, pt, de). Vacío = solo español.';
comment on column public.solutions_menu_items.traducciones is
  'Traducciones del plato por idioma: {"en":{"nombre","descripcion"},...}. El español vive en nombre/descripcion.';
comment on column public.solutions_menu_secciones.traducciones is
  'Traducciones del nombre de la sección por idioma: {"en":{"nombre"},...}.';
comment on column public.solutions_menu_items.nutricion is
  'Ficha nutricional opcional: porcion, calorias, proteina, carbohidratos, grasa (g), alergenos[]. null = no la cargó.';
comment on column public.solutions_negocios.origen is
  'publico = el cliente lo creó en /solutions/crear; admin = Bookea se lo dejó listo desde /admin/solutions.';

notify pgrst, 'reload schema';
