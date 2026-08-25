-- ═══════════════════════════════════════════════════════════════════
-- LEALTAD — el link directo de la caja: bookea.lat/<negocio>/scan (0206)
--
-- Pedido del dueño: una ventana mínima —escanear o, si él lo prende,
-- buscar al cliente a mano— sin el resto del panel alrededor, para
-- dejarla puesta en el teléfono del mostrador.
--
-- La pantalla en sí no necesita esquema nuevo: reutiliza EXACTAMENTE
-- el mismo `ModoMostrador` que ya vive en el panel, con la misma
-- sesión y el mismo checklist de la 0127 (`verificarAccesoLealtad`).
-- Lo único nuevo es ESTA columna: si ese link, además de escanear,
-- también deja atender a mano — el dueño la prende desde Equipo, por
-- tarjeta, y arranca APAGADA (el mostrador de siempre, adentro del
-- panel, sigue con las dos opciones de siempre — esto no lo toca).
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════

alter table public.programa_lealtad
  add column if not exists permite_manual_en_link boolean not null default false;

comment on column public.programa_lealtad.permite_manual_en_link is
  '0206: si el link directo de escaneo (bookea.lat/<negocio>/scan) también deja buscar y atender clientes a mano, o solo escanear. Lo prende el dueño desde Equipo. Default false: arranca solo con el escáner.';

notify pgrst, 'reload schema';
