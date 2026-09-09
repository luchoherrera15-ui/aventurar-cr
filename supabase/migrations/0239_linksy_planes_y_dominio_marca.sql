-- 0239 · Linksy: las dos membresías (Gratis / Pro) y el dominio de marca
--
-- Pedido del dueño (8 sep 2026): «dos membresías: el link hub básico
-- gratis, y la personalización paga; y que se pueda elegir si la página
-- se muestra en linksy.lat o en bookea.lat».
--
-- Dos columnas nuevas en solutions_negocios, aditivas y con default:
--   plan        'gratis' | 'pro'. Lo pone Bookea a mano al activar Pro
--               (no hay pasarela todavía). El servidor sanea al valor
--               gratis cualquier opción Pro de un negocio sin Pro
--               (src/lib/solutions/planes.ts).
--   host_marca  'linksy' | 'bookea'. En qué dirección se MUESTRA la
--               página (panel, compartir, QR). Las dos direcciones sirven
--               siempre; esto decide cuál se enseña.
--
-- Sin cambios de RLS: la tabla ya tiene sus políticas (0230) y estas
-- columnas se leen y escriben con las mismas. La app móvil no usa
-- solutions_negocios.

alter table public.solutions_negocios
  add column if not exists plan text not null default 'gratis'
    check (plan in ('gratis', 'pro')),
  add column if not exists host_marca text not null default 'linksy'
    check (host_marca in ('linksy', 'bookea'));

comment on column public.solutions_negocios.plan is 'Membresía de Linksy: gratis (link hub) o pro (personalización). La activa Bookea.';
comment on column public.solutions_negocios.host_marca is 'Dónde se muestra la página: linksy (linksy.lat/slug) o bookea (bookea.lat/s/slug).';
