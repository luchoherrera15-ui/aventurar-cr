-- ============================================================
-- BOOKEA — Los ocho tipos de tarjeta (0135)
--
-- El módulo pasa de tres formas de tarjeta a ocho: sellos, puntos,
-- cupón, descuento, membresía, gift card, evento y cashback.
--
-- ------------------------------------------------------------
-- SE AMPLÍA `modo`, NO SE CREA UNA COLUMNA `tipo`
-- ------------------------------------------------------------
-- `programa_lealtad.modo` ya existe (0121) y ya significa "qué clase
-- de tarjeta es". Sumar una columna `tipo` en paralelo daría DOS
-- campos para lo mismo, y se desincronizan: el día que alguien
-- escriba `tipo = 'cupon'` y olvide `modo`, la tarjeta se dibujaría
-- como puntos y se canjearía como cupón. Un solo campo no puede
-- contradecirse consigo mismo.
--
-- Los tres valores viejos siguen siendo válidos y significan lo mismo:
-- NINGÚN programa existente cambia de comportamiento, y no hay que
-- migrar una sola fila.
--
-- ------------------------------------------------------------
-- QUÉ VA EN `beneficio` (jsonb) Y QUÉ NO
-- ------------------------------------------------------------
-- En `beneficio` va lo PROPIO de cada tipo: los sellos que pide una
-- tarjeta de sellos, el valor de una gift card, la fecha de un evento.
-- Ocho formas distintas en columnas dejarían cincuenta campos nulos en
-- cada fila, y una migración por cada tipo nuevo.
--
-- FUERA queda todo lo que es igual para los ocho y que un motor tiene
-- que hacer cumplir —vencimientos, límites de uso, estado—: eso va en
-- columnas con su CHECK. Una regla que decide si un canje procede no
-- puede vivir en un campo que nadie valida.
--
-- La forma de cada `beneficio` se valida en el servidor, en
-- src/lib/lealtad/tipos-tarjeta.ts (`validarBeneficio`), que es código
-- testeado — no en un CHECK de jsonb que nadie puede leer.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table programa_lealtad drop constraint if exists programa_lealtad_modo_check;
alter table programa_lealtad add constraint programa_lealtad_modo_check
  check (
    modo is null
    or modo in (
      -- Los tres de la 0121, intactos
      'sellos', 'puntos', 'cashback',
      -- Los cinco nuevos (0135)
      'cupon', 'descuento', 'membresia', 'giftcard', 'evento'
    )
  );

comment on column programa_lealtad.modo is
  'QUÉ CLASE DE TARJETA es (0121, ampliado en 0135): sellos, puntos, '
  'cashback, cupon, descuento, membresia, giftcard, evento. null se '
  'comporta como puntos. El catálogo vivo, con la configuración y la '
  'validación de cada tipo, está en src/lib/lealtad/tipos-tarjeta.ts.';

-- La configuración propia del tipo. '{}' = todavía sin configurar; el
-- código cae a `configPorDefecto(tipo)`, que ya trae valores
-- publicables (10 sellos, 5% de cashback…) en vez de ceros que el
-- negocio tendría que adivinar.
alter table programa_lealtad add column if not exists beneficio jsonb not null default '{}'::jsonb;

alter table programa_lealtad drop constraint if exists programa_lealtad_beneficio_check;
alter table programa_lealtad add constraint programa_lealtad_beneficio_check
  check (jsonb_typeof(beneficio) = 'object');

comment on column programa_lealtad.beneficio is
  'La configuración PROPIA del tipo (0135): los sellos que pide, el '
  'valor de la gift card, la fecha del evento. Las reglas comunes a '
  'todos los tipos (vencimiento, límites, estado) NO van acá: van en '
  'columnas, porque un motor las hace cumplir. Se valida en el '
  'servidor con validarBeneficio().';
