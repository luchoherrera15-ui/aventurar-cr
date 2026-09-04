-- ════════════════════════════════════════════════════════════════════
--  0232 · SOLUTIONS — FUENTE, PORTADA, EFECTO Y FONDO DE CADA PUERTA
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (4 sep 2026): «más opciones de modificar, tipo
-- fuentes; que se pueda poner la portada completa o solo en card; que
-- tenga efectos; que se puedan poner imágenes en los fondos de los
-- cards».
--
-- Sigue exactamente el criterio de la 0231 y por las mismas razones:
-- LISTAS CERRADAS, no CSS libre. Un editor que deja pegar estilo
-- produce páginas rotas que terminamos arreglando nosotros, y abre la
-- puerta a inyectar CSS en una página pública. Con presets auditados
-- todo lo que el negocio puede elegir se ve bien y cumple contraste, y
-- lo que no está en la lista cae al default en el parser (temas.ts).
--
-- ── POR QUÉ LA IMAGEN DE FONDO SÍ ES TEXTO LIBRE ────────────────────
-- `fondo_url` no es una lista cerrada porque es una FOTO del negocio,
-- no una elección de diseño. La disciplina ahí es distinta: la URL se
-- valida contra nuestro propio storage antes de guardarse (el mismo
-- portero que ya usan `logo_url` y `foto_portada_url` en las actions),
-- así que la columna guarda una referencia a algo que ya subimos, no
-- una dirección arbitraria de internet.
--
-- ── LA LEGIBILIDAD NO LA ELIGE EL NEGOCIO ───────────────────────────
-- Con una foto detrás de una card, el texto encima puede quedar
-- ilegible con cualquier combinación de colores. Por eso el velo que
-- va sobre la foto NO es configurable: lo pone el renderizador con la
-- tinta del tema, siempre. El negocio elige la foto; el contraste lo
-- garantiza el sistema.

-- ── La fuente de la página ──────────────────────────────────────────
-- Seis caras, cargadas con next/font desde nuestro propio dominio (ver
-- src/app/solutions/fuentes.ts). `sistema` es la del sitio y el default,
-- así que ninguna página existente cambia de aspecto con esta migración.
alter table public.solutions_negocios
  add column if not exists fuente text not null default 'sistema'
  check (fuente in ('sistema', 'elegante', 'redonda', 'condensada', 'editorial', 'tecnica'));

-- ── Qué hace la foto de portada ─────────────────────────────────────
-- card     = adentro de la tarjeta del encabezado (lo de la 0230, y por
--            eso es el default: nadie cambia de aspecto al migrar);
-- completa = banner de borde a borde arriba de todo, con el nombre
--            encima — lo que pidió el dueño;
-- fondo    = la foto viste la página entera, las piezas flotan encima;
-- sin      = no se muestra, aunque esté cargada (para probar sin borrar).
alter table public.solutions_negocios
  add column if not exists estilo_portada text not null default 'card'
  check (estilo_portada in ('card', 'completa', 'fondo', 'sin'));

-- ── El efecto de las piezas ─────────────────────────────────────────
-- plano     = superficie + borde (lo de la 0230, default);
-- vidrio    = translúcido con desenfoque detrás;
-- elevado   = sólido con sombra y sin borde;
-- contorno  = sin relleno, borde marcado del acento;
-- degradado = relleno degradado hacia el acento.
alter table public.solutions_negocios
  add column if not exists efecto text not null default 'plano'
  check (efecto in ('plano', 'vidrio', 'elevado', 'contorno', 'degradado'));

-- ── La foto de fondo de UNA puerta ──────────────────────────────────
-- Nullable y sin default: la enorme mayoría de las puertas no lleva
-- foto, y una card con foto al lado de otra sin foto es una decisión
-- de diseño válida (destacar una sola).
alter table public.solutions_links
  add column if not exists fondo_url text;

comment on column public.solutions_negocios.fuente is
  'Cara tipográfica de /s/<slug>. Lista cerrada; las caras se cargan con next/font en src/app/solutions/fuentes.ts.';
comment on column public.solutions_negocios.estilo_portada is
  'Qué hace la foto de portada: card (dentro del encabezado), completa (banner de borde a borde), fondo (viste la página) o sin (oculta).';
comment on column public.solutions_negocios.efecto is
  'Acabado de las piezas: plano, vidrio, elevado, contorno o degradado. Auditado en src/lib/solutions/temas.ts.';
comment on column public.solutions_links.fondo_url is
  'Foto de fondo de esta puerta, en nuestro storage. El velo que garantiza el contraste lo pone el renderizador, no el negocio.';

notify pgrst, 'reload schema';
