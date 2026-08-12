
-- ============================================================
-- BOOKEA — Cómo se presenta el programa de lealtad (0121)
--
-- Preparación del pase de Wallet. UNA columna, anulable y sin
-- backfill: ningún programa existente cambia de comportamiento.
--
-- ------------------------------------------------------------
-- POR QUÉ ALCANZA CON UNA COLUMNA
-- ------------------------------------------------------------
-- Las dos mecánicas que piden los negocios reales YA funcionan con el
-- motor de la 0060, porque son el mismo libro de puntos con distintos
-- números:
--
--   "5% de lo que compre"   puntos_por_colon = 0.05, por_visita = 0
--                           gasta ₡20.000 → gana 1.000 puntos
--
--   "8 sellos y el 9no va"  puntos_por_visita = 1, por_colon = 0
--                           cada visita → 1 punto, o sea 1 sello
--
-- El dato guardado es idéntico en los dos: filas con signo en
-- `transacciones_puntos`. Lo único que cambia es CÓMO SE MUESTRA, y
-- eso no se puede adivinar mirando los números: un saldo de 5 puede
-- ser "5 sellos", "₡5" o "5 puntos" según lo que el negocio prometió.
--
-- Por eso `modo` es presentación, NO cálculo. Ningún motor cambia de
-- comportamiento por leerla: `otorgarPuntos` sigue haciendo lo mismo.
--
-- ------------------------------------------------------------
-- LA META DE LA TARJETA DE SELLOS NO SE GUARDA
-- ------------------------------------------------------------
-- Un pase de sellos muestra "5 de 8". El 8 NO lleva columna propia: es
-- el `costo_puntos` de la recompensa activa más barata del programa.
--
-- Guardarlo aparte crearía dos números para la misma cosa —la meta y
-- el costo de la recompensa— que se separan el día que el dueño cambia
-- uno y olvida el otro, y a partir de ahí la tarjeta promete algo que
-- el canje no cumple. Derivándolo, cambiar la recompensa cambia la
-- tarjeta sola.
--
-- Es el mismo criterio del saldo de membresías (0120) y del CRM
-- (0109): lo que se puede derivar, no se guarda.
--
-- Si el programa no tiene ninguna recompensa activa todavía, no hay
-- meta y el pase cae a mostrar el saldo pelado.
-- ============================================================

alter table programa_lealtad add column if not exists modo text;

alter table programa_lealtad drop constraint if exists programa_lealtad_modo_check;
alter table programa_lealtad add constraint programa_lealtad_modo_check
  check (modo is null or modo in ('sellos', 'cashback', 'puntos'));

comment on column programa_lealtad.modo is
  'Cómo se PRESENTA el saldo (0121), no cómo se calcula: sellos = '
  '"5 de 8" con circulitos; cashback = "₡3.400 acumulados"; puntos = '
  '"340 puntos". null se comporta como puntos. La meta de la tarjeta '
  'de sellos NO se guarda: es el costo de la recompensa activa más '
  'barata.';
