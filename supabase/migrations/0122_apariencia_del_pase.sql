
-- ============================================================
-- BOOKEA — Apariencia del pase de Wallet (0122)
--
-- Lo que Bookea configura por negocio para su tarjeta de Wallet.
-- Tres columnas en `programa_lealtad` y un valor nuevo en el check de
-- `addons_negocio`. Todo anulable: ningún programa existente cambia.
--
-- ------------------------------------------------------------
-- POR QUÉ SOLO TRES COLUMNAS
-- ------------------------------------------------------------
-- Un pase de sellos muestra: el logo del negocio, N círculos de los
-- cuales M están encendidos, cuántos faltan, y qué regalía espera al
-- final. Parece mucho para configurar, pero casi todo ya existe:
--
--   cuántos sellos     `recompensas.costo_puntos` de la recompensa
--                      activa más barata (decidido en la 0121)
--   qué regalía        `recompensas.nombre` de esa misma fila
--   cuántos lleva      suma de `transacciones_puntos` (0060)
--   cómo se presenta   `programa_lealtad.modo` (0121)
--   nombre del negocio `ranchos.nombre`
--
-- Lo ÚNICO que no se puede derivar de ningún lado es cómo se ve: los
-- dos colores y el logo. Eso es lo que se guarda acá.
--
-- Guardar además la meta o el nombre de la regalía crearía un segundo
-- lugar donde dicen lo mismo, y el día que el dueño cambia la
-- recompensa el pase seguiría prometiendo lo viejo.
--
-- ------------------------------------------------------------
-- POR QUÉ VAN EN `programa_lealtad` Y NO EN UNA TABLA NUEVA
-- ------------------------------------------------------------
-- `programa_lealtad` ya es uno por negocio (tiene `unique(rancho_id)`)
-- y ya guarda el `modo` (0121). El pase ES la cara del programa: si la
-- apariencia viviera aparte habría dos filas que solo tienen sentido
-- juntas, y ninguna forma de impedir que exista una sin la otra.
--
-- LÍMITE CONOCIDO: por eso mismo, un pase que muestre el saldo de
-- `membresias` (0120) en vez de puntos no tendría dónde configurarse.
-- Hoy no hace falta —los pases son de fidelidad— y cuando haga falta
-- se mueve a su propia tabla. Se anota para que la decisión no
-- aparezca como accidente.
--
-- ------------------------------------------------------------
-- EL COMPLEMENTO `pases`
-- ------------------------------------------------------------
-- Se agrega como add-on APARTE de `lealtad`. Son cosas distintas que
-- se cobran distinto: `lealtad` es el motor de puntos que corre dentro
-- de Bookea; `pases` es la tarjeta que el cliente lleva en el
-- teléfono. Un negocio puede querer el programa sin la tarjeta.
--
-- `addons_negocio` sigue siendo solo-servidor (0077): el dueño no se
-- puede auto-activar el complemento.
-- ============================================================

-- 1) Los dos colores y el logo -------------------------------------
alter table programa_lealtad add column if not exists pase_color_fondo text;
alter table programa_lealtad add column if not exists pase_color_sello text;
alter table programa_lealtad add column if not exists pase_logo_url text;

-- Hex de 6 dígitos con almohadilla. Se valida en la base para que un
-- color mal escrito no llegue a la imagen del pase: ahí no falla, sale
-- un cuadro negro y nadie sabe por qué.
alter table programa_lealtad drop constraint if exists programa_lealtad_pase_colores_check;
alter table programa_lealtad add constraint programa_lealtad_pase_colores_check
  check (
    (pase_color_fondo is null or pase_color_fondo ~ '^#[0-9A-Fa-f]{6}$')
    and (pase_color_sello is null or pase_color_sello ~ '^#[0-9A-Fa-f]{6}$')
  );

alter table programa_lealtad drop constraint if exists programa_lealtad_pase_logo_check;
alter table programa_lealtad add constraint programa_lealtad_pase_logo_check
  check (pase_logo_url is null or pase_logo_url ~ '^https://');

comment on column programa_lealtad.pase_color_fondo is
  'Fondo de la tarjeta de Wallet (0122), hex #RRGGBB. null = el navy '
  'de Bookea. Lo configura Bookea, no el dueño.';

comment on column programa_lealtad.pase_color_sello is
  'Color del sello encendido (0122). El apagado es el mismo al 22%, '
  'para que el cliente vea cuántos le faltan y no solo cuántos lleva.';

comment on column programa_lealtad.pase_logo_url is
  'Logo del negocio para la tarjeta (0122). Va arriba a la izquierda y '
  'dentro de cada círculo. El logo de Bookea NO va ahí: aparece como '
  '"Powered by Bookea.lat" dentro de la imagen de la tira.';

-- 2) El complemento ------------------------------------------------
-- CUIDADO al tocar este check: `drop` + `add` lo reemplaza ENTERO, así
-- que hay que repetir TODOS los valores vigentes, no solo el nuevo. La
-- lista creció en dos pasos y es fácil mirar solo el primero:
--
--   0077  'agenda_ia', 'lealtad'
--   0090  + 'asistente_ia'      ← el que se olvida
--   0122  + 'pases'             (acá)
--
-- Omitir uno no falla en silencio: Postgres valida el check contra las
-- filas existentes y aborta con 23514 si algún negocio ya tiene ese
-- complemento. Es la base cuidando los datos, pero conviene no llegar
-- ahí — se comprueba antes con:
--   select distinct addon from addons_negocio;
alter table addons_negocio drop constraint if exists addons_negocio_addon_check;
alter table addons_negocio add constraint addons_negocio_addon_check
  check (addon in ('agenda_ia', 'lealtad', 'asistente_ia', 'pases'));
