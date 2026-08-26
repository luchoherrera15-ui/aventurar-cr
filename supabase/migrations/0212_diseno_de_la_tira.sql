
-- ─────────────────────────────────────────────────────────────────────
-- 0212: dónde va cada sello dentro de la tira del pase.
--
-- Hasta ahora el diseño de una tarjeta eran 11 columnas y NINGUNA
-- describía geometría: dos colores, cinco URLs de imagen, un enum de
-- ícono y tres banderas. La posición, el tamaño y el reparto de los
-- sellos estaban escritos a mano en el código (`layout-tira.ts`), y por
-- lo tanto eran iguales para todos los negocios.
--
-- Pedido del dueño (ago 2026): que la tarjeta sea personalizable de
-- verdad — sellos arriba, en el medio o abajo, más grandes o más
-- chicos, en una fila o en dos.
--
-- ── POR QUÉ UNA COLUMNA jsonb Y NO CINCO COLUMNAS ────────────────────
--
-- La 0132 dejó escrita la doctrina de este repo: dato que gobierna un
-- MOTOR, columna con CHECK; bolsa de configuración de UNA pantalla,
-- jsonb. Y avisa que el diseño del pase va por columnas «porque lo LEE
-- EL GENERADOR de .pkpass, código que corre lejos y necesita que la base
-- le garantice el tipo y el rango».
--
-- Esto se aparta de esa regla, con motivo:
--
--   · Los cinco valores NO tienen sentido por separado. «Alineación
--     vertical: abajo» sin «cuántas filas» no describe nada. Son un
--     objeto, no cinco datos sueltos que casualmente viven juntos.
--   · El motor NO confía en ellos aunque estén validados. `layoutDeLaTira`
--     ya acota todo lo que recibe: la escala tiene tope para que los
--     sellos no se pisen, el diámetro tiene piso, y hay un test que
--     comprueba que con CUALQUIER combinación ningún sello se sale de la
--     tira. La garantía vive en el código porque tiene que vivir ahí
--     igual — una fila vieja o una base sin el CHECK no son imposibles.
--   · Se esperan más opciones (el logo dentro de la tira, el velo de la
--     foto, el encuadre). Cada una sería otra columna, otro CHECK y otra
--     migración.
--
-- El CHECK que sí importa está: que sea un objeto y no un arreglo ni un
-- texto suelto. Es el mismo que usa `poster_config` (0132).
--
-- ── VACÍO SIGNIFICA «COMO SIEMPRE» ──────────────────────────────────
--
-- El default es `{}` y `layoutDeLaTira` cae a `CONFIG_CLASICA`, que
-- reproduce el layout viejo EXACTAMENTE (probado píxel por píxel en
-- `layout-tira.test.ts`, 11 metas × 3 escalas).
--
-- O sea: esta migración no cambia el aspecto de ninguna de las tarjetas
-- ya emitidas. Solo abre la puerta para que un negocio elija otra cosa.
-- ─────────────────────────────────────────────────────────────────────

alter table programa_lealtad
  add column if not exists pase_diseno jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'programa_lealtad_pase_diseno_obj'
  ) then
    alter table programa_lealtad
      add constraint programa_lealtad_pase_diseno_obj
      check (jsonb_typeof(pase_diseno) = 'object');
  end if;
end $$;

comment on column programa_lealtad.pase_diseno is
  'Geometría de la tira de sellos: filas, escala del sello, alineación y margen vertical. {} = el layout clásico. La forma la define ConfigTira en src/lib/wallet/layout-tira.ts, y layoutDeLaTira() acota todos los valores antes de dibujar.';
