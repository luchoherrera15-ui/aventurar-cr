-- ════════════════════════════════════════════════════════════════════
--  0231 · SOLUTIONS — TEMAS Y ESTILO DE LAS PUERTAS
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (4 sep 2026): que Solutions sea «casi un creador de
-- mini-websites» — que el negocio elija el TIPO DE CARD y el DISEÑO,
-- no solo dos colores sueltos.
--
-- Dos columnas y ninguna tabla nueva: son dos elecciones de una lista
-- cerrada, se leen siempre con el negocio y se guardan con él. Mismo
-- criterio que `tema_ficha` en restaurantes (src/app/restaurantes/
-- tipos.ts): el local DECLARA su tema y la página se arma según eso,
-- sin un `if (slug === …)` en el render y sin desplegar nada para que
-- un negocio nuevo estrene un diseño.
--
-- ── POR QUÉ LISTA CERRADA Y NO CSS LIBRE ────────────────────────────
-- Un editor que deja pegar CSS produce páginas rotas que después somos
-- nosotros los que tenemos que arreglar, y abre la puerta a inyectar
-- estilo en una página pública. Con presets auditados, todo lo que el
-- negocio puede elegir se ve bien y cumple contraste; lo que no está en
-- la lista cae al default en el propio parser (temas.ts).

-- El vestido de la página. `marca` = los dos colores que el negocio ya
-- eligió (el comportamiento de la 0230, y por eso es el default).
alter table public.solutions_negocios
  add column if not exists tema text not null default 'marca'
  check (tema in ('marca', 'noche', 'claro', 'crema', 'bosque', 'vino'));

-- Cómo se dibujan las puertas: filas anchas (una debajo de otra, con
-- descripción) o cuadrícula de íconos (más puertas visibles de un
-- vistazo, sin scroll — lo que usa la mayoría de los linktrees).
alter table public.solutions_negocios
  add column if not exists estilo_links text not null default 'lista'
  check (estilo_links in ('lista', 'grilla'));

-- Bordes de las piezas: redondeadas, suaves o rectas. Lo pidió el mismo
-- mensaje («el tipo de card, el diseño»): dos negocios con el mismo
-- tema se distinguen por esto.
alter table public.solutions_negocios
  add column if not exists redondeo text not null default 'suave'
  check (redondeo in ('recto', 'suave', 'redondo'));

comment on column public.solutions_negocios.tema is
  'Preset visual de /s/<slug>. Lista cerrada auditada en src/lib/solutions/temas.ts; marca = los colores propios del negocio.';
comment on column public.solutions_negocios.estilo_links is
  'Cómo se dibujan las puertas: lista (filas anchas) o grilla (cuadrícula de íconos).';
comment on column public.solutions_negocios.redondeo is
  'Radio de las piezas de la página: recto, suave o redondo.';

notify pgrst, 'reload schema';
