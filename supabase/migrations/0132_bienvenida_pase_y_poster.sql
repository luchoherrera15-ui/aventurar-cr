-- ============================================================
-- BOOKEA — Oferta de bienvenida, diseño del pase y póster (0132)
--
-- Tres cosas que el panel nuevo de lealtad necesita guardar y hoy no
-- tienen dónde. Van juntas en una sola migración porque son el mismo
-- pedido —"que el negocio arme su pass y su póster como quiera"— y
-- porque pegarlas de a una multiplica las oportunidades de dejar la
-- base a medias.
--
-- TODO ES ADITIVO. Ninguna columna existente cambia de tipo, ningún
-- dato se reescribe, y cada default deja a los programas de hoy
-- comportándose EXACTAMENTE como antes. Es seguro correrla varias
-- veces.
--
--   1. oferta_bienvenida  — el regalo de afiliarse (mecánica nueva)
--   2. programa_lealtad    — cómo se ve la tarjeta de Wallet
--   3. programa_lealtad    — cómo se ve el póster del mostrador
-- ============================================================


-- ------------------------------------------------------------
-- 1. oferta_bienvenida — "por afiliarte, esto"
-- ------------------------------------------------------------
-- La tercera mecánica, al lado de sellos/puntos/cashback. Es la única
-- que se ENTREGA SOLA: el cliente no la gana visitando, le toca por
-- afiliarse, y por eso vive en su propia tabla en vez de ser una
-- recompensa más.
--
-- POR QUÉ NO ES UNA FILA DE `recompensas`:
-- una recompensa se canjea contra el SALDO ("10 sellos = un café"). La
-- bienvenida no cuesta saldo — cuesta existir. Metida en `recompensas`
-- con costo_puntos = 0 sería la más barata del programa, y como la
-- meta de la tarjeta es "la recompensa activa más barata" (0121), cada
-- tarjeta de sellos pasaría a prometer «0 de 0». Un renglón de datos
-- mal puesto rompiendo todos los pases: exactamente lo que no.
--
-- `unique(programa_id)`: una sola oferta viva por programa. Si el
-- negocio la cambia, edita esta fila — no acumula ofertas fantasma que
-- nadie sabe cuál aplica.
create table if not exists oferta_bienvenida (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null unique references programa_lealtad(id) on delete cascade,

  -- Apagada por defecto: la mecánica nace off, igual que en la
  -- pantalla. Crear la fila NO la enciende.
  activo boolean not null default false,

  tipo text not null default 'descuento_porcentaje'
    check (tipo in ('descuento_porcentaje', 'descuento_fijo', 'producto')),

  -- % (1..100) para porcentaje, colones para fijo, null para producto.
  valor numeric check (valor is null or valor > 0),

  -- Qué se lleva, en palabras del negocio. Obligatorio para 'producto'
  -- ("Un café gratis"); en los descuentos es opcional y sirve de
  -- etiqueta ("Bienvenida 10%").
  nombre text check (nombre is null or char_length(trim(nombre)) between 1 and 120),

  -- Días de vigencia desde que se afilia. null = no vence.
  vence_dias integer check (vence_dias is null or (vence_dias between 1 and 365)),

  created_at timestamptz not null default now()
);

-- Coherencia por tipo, en la BASE y no solo en el formulario: un
-- descuento sin monto es una promesa vacía, y un producto sin nombre
-- no se puede entregar en el mostrador.
alter table oferta_bienvenida drop constraint if exists oferta_bienvenida_valor_check;
alter table oferta_bienvenida add constraint oferta_bienvenida_valor_check
  check (
    (tipo = 'descuento_porcentaje' and valor is not null and valor <= 100)
    or (tipo = 'descuento_fijo' and valor is not null)
    or (tipo = 'producto' and nombre is not null)
  );

alter table oferta_bienvenida enable row level security;

-- La lee cualquiera: el cliente tiene que poder ver qué se gana ANTES
-- de afiliarse — es el argumento de la página /tarjeta/{slug}. Solo se
-- muestra si además está activa; la apagada es borrador del negocio.
drop policy if exists "Oferta activa visible para todos" on oferta_bienvenida;
create policy "Oferta activa visible para todos" on oferta_bienvenida
  for select to anon, authenticated
  using (
    activo
    or exists (
      select 1 from programa_lealtad pl
      join ranchos r on r.id = pl.rancho_id
      where pl.id = programa_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "El dueño administra su oferta" on oferta_bienvenida;
create policy "El dueño administra su oferta" on oferta_bienvenida
  for all to authenticated
  using (
    exists (
      select 1 from programa_lealtad pl
      join ranchos r on r.id = pl.rancho_id
      where pl.id = programa_id and (r.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from programa_lealtad pl
      join ranchos r on r.id = pl.rancho_id
      where pl.id = programa_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

grant select, insert, update, delete on oferta_bienvenida to authenticated;
grant select on oferta_bienvenida to anon;

comment on table oferta_bienvenida is
  'El regalo por afiliarse (0132). NO es una fila de `recompensas` a '
  'propósito: no se canjea contra el saldo, y como la meta de la '
  'tarjeta es la recompensa activa más barata (0121), una de costo 0 '
  'dejaría todos los pases de sellos prometiendo «0 de 0».';


-- ------------------------------------------------------------
-- 2. programa_lealtad — el diseño de la tarjeta de Wallet
-- ------------------------------------------------------------
-- Lo que hoy se puede tocar son dos colores y el logo (0122). Esto
-- suma lo que el negocio pide para que la tarjeta sea SUYA. Cada
-- columna es anulable o trae el default que reproduce el
-- comportamiento actual: un programa que no se toque sale idéntico.

-- Banda superior del pase: `strip.png` en Apple, `heroImage` en
-- Google. Va al bucket `comprobantes`, que ya es público.
alter table programa_lealtad add column if not exists pase_banner_url text;

-- Apple dibuja QR o CODE128. El QR es lo que escanea nuestro panel;
-- CODE128 existe para el negocio que ya tiene lectora de barras en la
-- caja. Default 'qr' = lo de siempre.
alter table programa_lealtad add column if not exists pase_codigo_formato text not null default 'qr';
alter table programa_lealtad drop constraint if exists programa_lealtad_codigo_formato_check;
alter table programa_lealtad add constraint programa_lealtad_codigo_formato_check
  check (pase_codigo_formato in ('qr', 'code128'));

-- El texto del reverso del pase. null = se sigue generando solo, con
-- la explicación que arma `textoDeAyuda` según el modo.
alter table programa_lealtad add column if not exists pase_texto_reverso text;
alter table programa_lealtad drop constraint if exists programa_lealtad_texto_reverso_check;
alter table programa_lealtad add constraint programa_lealtad_texto_reverso_check
  check (pase_texto_reverso is null or char_length(pase_texto_reverso) <= 500);

-- Qué campos se muestran. Los dos en true = la tarjeta de hoy.
alter table programa_lealtad add column if not exists pase_mostrar_saldo boolean not null default true;
alter table programa_lealtad add column if not exists pase_mostrar_progreso boolean not null default true;

comment on column programa_lealtad.pase_banner_url is
  'Banda superior del pase (0132): strip.png en Apple, heroImage en '
  'Google. Recomendado 1032x336. null = sin banda, como antes.';


-- ------------------------------------------------------------
-- 3. programa_lealtad — la personalización del póster
-- ------------------------------------------------------------
-- UNA columna jsonb y no doce columnas sueltas, a diferencia del
-- diseño del pase de arriba. La razón es la diferencia entre las dos:
--
--   · Las del pase las LEE EL GENERADOR de .pkpass y el de Google —
--     código que corre lejos de acá y que necesita que la base le
--     garantice el tipo y el rango. Ahí una columna con CHECK paga.
--
--   · Las del póster las lee UNA pantalla que las vuelve a dibujar
--     enteras. Ningún motor decide nada con ellas, son textos y
--     interruptores de presentación, y la lista va a crecer cada vez
--     que se agregue una plantilla. Doce columnas que solo un
--     componente lee es esquema que estorba.
--
-- Es el mismo criterio de `permisos_lealtad` (0127): bolsa de config
-- de una sola pantalla, jsonb; dato que gobierna un motor, columna.
--
-- '{}' = el póster de siempre: los textos por defecto los pone el
-- componente, no la base. Así cambiar la redacción no pide migración.
alter table programa_lealtad add column if not exists poster_config jsonb not null default '{}'::jsonb;

alter table programa_lealtad drop constraint if exists programa_lealtad_poster_config_check;
alter table programa_lealtad add constraint programa_lealtad_poster_config_check
  check (jsonb_typeof(poster_config) = 'object');

comment on column programa_lealtad.poster_config is
  'Personalización del póster del mostrador (0132): titular, bajada, '
  'llamados a la acción, interruptores de contenido, lista de '
  'beneficios y opciones de diseño (plantilla, tamaño del QR, papel, '
  'orientación). jsonb porque solo lo lee la pantalla que lo dibuja: '
  'ningún motor decide nada con esto. {} = los textos por defecto.';
