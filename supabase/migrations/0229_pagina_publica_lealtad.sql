-- ════════════════════════════════════════════════════════════════════
--  0229 · LA PÁGINA PÚBLICA DEL NEGOCIO DE LEALTAD («Mi página»)
-- ════════════════════════════════════════════════════════════════════
--
-- El QR de la mesa abre bookea.lat/r/<slug>: una portada con la marca
-- del RESTAURANTE (hereda logo y colores de su tarjeta de lealtad) y
-- sus puertas — el menú digital (rancho_items, que ya es público por la
-- 0035), la tarjeta de lealtad y su información. Esta tabla guarda lo
-- que NO se puede derivar de lo que ya existe: si la página está
-- publicada, su texto de portada, la promo del día y la prevista de
-- mesas.
--
-- UNA fila por negocio (PK = rancho_id): la página es del negocio, no
-- de la tarjeta — las tarjetas pueden ser varias y la página es una.
--
-- ── QUIÉN LEE, QUIÉN ESCRIBE ────────────────────────────────────────
-- Lectura pública CONDICIONAL (patrón 0189 promociones): anon solo ve
-- filas con publicada = true — apagar la página la saca de la calle al
-- instante. La escritura va SOLO por server action con la llave de
-- servicio (patrón 0228 fichas_cliente): una sola puerta, que ya pasó
-- por verificarAccesoLealtad.
--
-- ── EL QR DE PAPEL ES INMUTABLE ─────────────────────────────────────
-- Los QR /tarjeta/<slug> ya impresos NO se re-apuntan (0199 y
-- programa-principal.ts lo blindan). /r/<slug> es el destino de las
-- hojas NUEVAS; el link viejo sigue sirviendo la tarjeta para siempre.

create table if not exists public.lealtad_paginas (
  rancho_id uuid primary key references public.ranchos (id) on delete cascade,

  -- El interruptor de la calle: false = la página no existe en público.
  publicada boolean not null default true,

  -- La línea bajo el nombre («Parrilla · Santa Ana · hasta las 10 pm»).
  bajada text not null default '' check (char_length(bajada) <= 140),

  -- Foto de portada del hero (bucket ranchos-fotos, se valida en la
  -- action con esUrlDeNuestroStorage). Sin foto, pintan los colores de
  -- la tarjeta.
  foto_portada_url text,

  -- La promo del día: un renglón encendible. Sin fechas a propósito —
  -- se prende y se apaga desde el panel, y quien la olvida encendida la
  -- ve en su propia página.
  promo_titulo text not null default '' check (char_length(promo_titulo) <= 60),
  promo_detalle text not null default '' check (char_length(promo_detalle) <= 140),
  promo_activa boolean not null default false,

  -- A dónde cae el QR: la portada (con las puertas) o directo al menú.
  qr_destino text not null default 'portada' check (qr_destino in ('portada', 'menu')),

  -- El tile del menú se puede esconder sin despublicar la página
  -- (un salón de uñas de Lealtad quizá no quiere carta).
  mostrar_menu boolean not null default true,

  -- La PREVISTA de pedidos por mesa: cuántos QR de mesa imprimir
  -- (/r/<slug>?mesa=N). 0 = sin mesas. El número viaja en el link desde
  -- el día uno para no reimprimir ni un QR cuando los pedidos lleguen.
  mesas smallint not null default 0 check (mesas between 0 and 60),

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.lealtad_paginas is
  'La página pública /r/<slug> de un negocio de Lealtad: portada, promo y prevista de mesas. El menú vive en rancho_items y la marca en programa_lealtad — acá solo lo no derivable.';

alter table public.lealtad_paginas enable row level security;

-- La calle ve SOLO páginas publicadas. El panel del dueño lee con la
-- llave de servicio (ve también las apagadas), igual que escribe.
drop policy if exists "El público ve las páginas publicadas" on public.lealtad_paginas;
create policy "El público ve las páginas publicadas" on public.lealtad_paginas
  for select to anon, authenticated
  using (publicada);

grant select on public.lealtad_paginas to anon, authenticated;
grant all on public.lealtad_paginas to service_role;

notify pgrst, 'reload schema';
