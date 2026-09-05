-- ════════════════════════════════════════════════════════════════════
--  0234 · SOLUTIONS — EL DOMINIO PROPIO DE CADA NEGOCIO
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (5 sep 2026): «que la gente agregue su propio
-- dominio: la idea es que nuestra página sea 100 % configurable como
-- un Linktree, y la gente tenga sus mini portales».
--
-- Un dominio por negocio, en la misma fila: es un atributo de la
-- página, no una lista. El host se guarda NORMALIZADO (minúsculas,
-- sin esquema, sin barra, sin puerto) para que la búsqueda del proxy
-- —que llega con el header Host tal cual— sea una igualdad exacta.
--
-- ── EL ESTADO LO DECIDE UNA SONDA, NO UN FORMULARIO ────────────────
-- «activo» no lo marca el negocio ni el DNS: lo marca una petición
-- HTTPS real a ese dominio que vuelve con la cabecera que pone
-- nuestro proxy. Si eso vuelve, el DNS, Vercel y el certificado están
-- bien, los tres a la vez; si no, sigue «pendiente» con una nota que
-- dice qué falta. No hay forma de tener un dominio «activo» que no
-- sirva la página.

alter table public.solutions_negocios
  add column if not exists dominio text
  check (dominio is null or dominio ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$');

-- Único: dos negocios no pueden reclamar el mismo host. Parcial, para
-- que los null (la enorme mayoría) no cuenten.
create unique index if not exists solutions_negocios_dominio_unico
  on public.solutions_negocios (dominio) where dominio is not null;

alter table public.solutions_negocios
  add column if not exists dominio_estado text not null default 'pendiente'
  check (dominio_estado in ('pendiente', 'activo', 'error'));
alter table public.solutions_negocios
  add column if not exists dominio_verificado_en timestamptz;
-- Qué falta o qué falló, en palabras para el dueño del negocio.
alter table public.solutions_negocios
  add column if not exists dominio_nota text check (dominio_nota is null or char_length(dominio_nota) <= 240);

comment on column public.solutions_negocios.dominio is
  'Host propio del negocio (casanostra.com, menu.casanostra.com), normalizado. El proxy lo resuelve a /s/<slug>.';
comment on column public.solutions_negocios.dominio_estado is
  'pendiente (guardado, falta DNS o Vercel), activo (una sonda HTTPS lo confirmó) o error.';

notify pgrst, 'reload schema';
