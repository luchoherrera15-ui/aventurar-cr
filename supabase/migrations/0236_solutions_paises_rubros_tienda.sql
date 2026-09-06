-- ════════════════════════════════════════════════════════════════════
--  0236 · SOLUTIONS — PAÍS Y MONEDA, RUBRO, TIENDA EN EL LINK HUB
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (6 sep 2026), en tres partes:
--
--   1. «Todo está basado en colones y no debería: se adapta a la
--      moneda de cada país. Ofrecemos desde México hasta Chile».
--      → `pais` (ISO-3166 de dos letras) y `moneda` (ISO-4217) en el
--        negocio. Los precios YA eran numeric(12,2) desde la 0230, así
--        que MXN 120.50 entra sin tocar columnas; lo que cambia es
--        cómo se muestran (src/lib/monedas.ts) y con qué prefijo se
--        arma el WhatsApp.
--
--   2. «El link hub no solo para restaurantes: lavacar, detailing, un
--      menú propio de cada página… hasta un sistema de ventas en
--      línea tipo catálogo».
--      → `rubro`: el tipo de negocio. NO crea tablas nuevas: el
--        «menú» de un restaurante y el «catálogo» de una tienda son
--        las mismas secciones e ítems (solutions_menu_*); el rubro
--        cambia el VOCABULARIO (menú / servicios / productos) y qué
--        modalidades de pedido tienen sentido (la mesa es solo de
--        comida). Ver src/lib/solutions/rubros.ts.
--
--   3. «Que sea 100 % customizable, con animaciones, tipo Linktree».
--      → `diseno` jsonb: las opciones finas del editor (animación de
--        entrada, efecto al pasar, fondo, estilo de botón, forma del
--        logo, alineación, densidad, vitrina de productos, fila de
--        redes). Un jsonb y no una columna por opción, a propósito:
--        cada opción nueva del editor sería una migración más, y la
--        lista cerrada de cada una vive en TypeScript
--        (src/lib/solutions/temas.ts → `disenoDe`), que sanea al leer
--        igual que hace con `tema` o `efecto`. La base guarda; el
--        código decide qué vale.
--      → En los enlaces, `formato`: además del botón de siempre, un
--        enlace puede ser un ÍCONO (la fila de redes bajo el nombre),
--        un TÍTULO (separa grupos de botones) o un TEXTO (un párrafo).
--        Y `descripcion`: la línea chica bajo el botón.
--
-- Todo es ADITIVO con default: una fila anterior queda como estaba
-- (Costa Rica, colones, restaurante, sin opciones finas) y el código
-- viejo la sigue leyendo igual. Por eso puede correr ANTES del deploy.

-- ────────────────────────────────────────────────────────────────────
-- 1. PAÍS Y MONEDA
-- ────────────────────────────────────────────────────────────────────
alter table public.solutions_negocios
  add column if not exists pais text not null default 'CR'
    check (pais in ('MX','GT','BZ','HN','SV','NI','CR','PA','CO','VE','EC','PE','BO','PY','UY','AR','CL','BR','DO','CU','PR')),
  add column if not exists moneda text not null default 'CRC'
    check (moneda in ('MXN','GTQ','BZD','HNL','USD','NIO','CRC','PAB','COP','VES','PEN','BOB','PYG','UYU','ARS','CLP','BRL','DOP','CUP'));

comment on column public.solutions_negocios.pais is
  'ISO-3166 alfa-2 del país del negocio (0236). Decide el prefijo telefónico del WhatsApp y la moneda sugerida. Lista: src/lib/monedas.ts.';
comment on column public.solutions_negocios.moneda is
  'ISO-4217 de la moneda en que el negocio pone sus precios (0236). Se muestra con su símbolo y decimales: src/lib/monedas.ts. Los precios siguen en numeric(12,2).';

-- ────────────────────────────────────────────────────────────────────
-- 2. RUBRO
-- ────────────────────────────────────────────────────────────────────
alter table public.solutions_negocios
  add column if not exists rubro text not null default 'restaurante'
    check (rubro in (
      'restaurante','cafeteria','bar','foodtruck','panaderia',
      'lavacar','detailing','taller',
      'barberia','salon','spa','gimnasio',
      'tienda','boutique','floristeria','farmacia','veterinaria',
      'hotel','tours','profesional','creador','otro'
    ));

comment on column public.solutions_negocios.rubro is
  'Tipo de negocio (0236). Cambia el vocabulario (menú / servicios / productos) y qué modalidades de pedido aplican; la mesa es solo de comida. Lista y vocabulario: src/lib/solutions/rubros.ts.';

-- ────────────────────────────────────────────────────────────────────
-- 3. EL DISEÑO FINO
-- ────────────────────────────────────────────────────────────────────
alter table public.solutions_negocios
  add column if not exists diseno jsonb not null default '{}'::jsonb
    check (jsonb_typeof(diseno) = 'object');

comment on column public.solutions_negocios.diseno is
  'Opciones finas del editor de Mi página (0236): animación, hover, fondo, botones, logo, alineación, densidad, vitrina, redes. Cada llave es una lista cerrada saneada en src/lib/solutions/temas.ts (disenoDe). Vacío = los defaults de siempre.';

-- ────────────────────────────────────────────────────────────────────
-- 4. LOS ENLACES: FORMATO Y DESCRIPCIÓN
-- ────────────────────────────────────────────────────────────────────
alter table public.solutions_links
  add column if not exists formato text not null default 'boton'
    check (formato in ('boton','icono','titulo','texto')),
  add column if not exists descripcion text not null default ''
    check (char_length(descripcion) <= 80);

-- Un título o un texto no llevan a ningún lado: la URL puede quedar
-- vacía. El CHECK de la 0230 exigía esquema http/mailto/tel; se
-- reemplaza por uno que lo exige SOLO en botones e íconos.
-- Los CHECK de la 0230 eran de columna (sin nombre propio): Postgres los
-- bautizó solo. Se buscan por definición y no por nombre, por si el
-- nombre generado difiere entre el proyecto local y el remoto.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.solutions_links'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%url%' or pg_get_constraintdef(oid) ilike '%icono%')
  loop
    execute format('alter table public.solutions_links drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.solutions_links
  add constraint solutions_links_url_check
  check (
    (formato in ('titulo','texto') and (url = '' or url ~* '^(https?://|mailto:|tel:)'))
    or (formato in ('boton','icono') and url ~* '^(https?://|mailto:|tel:)')
  );

-- Más íconos de redes (0236): X, LinkedIn, Spotify, Telegram, Pinterest.
alter table public.solutions_links
  add constraint solutions_links_icono_check
  check (icono in (
    'link','instagram','facebook','tiktok','whatsapp','telefono','mapa','reservar','web','correo','youtube','tienda','menu',
    'x','linkedin','spotify','telegram','pinterest'
  ));

comment on column public.solutions_links.formato is
  'Qué es este enlace en la página (0236): boton (de siempre), icono (fila de redes), titulo (separador) o texto (párrafo).';
comment on column public.solutions_links.descripcion is
  'La línea chica bajo el botón (0236). Vacía = no se dibuja.';

notify pgrst, 'reload schema';
