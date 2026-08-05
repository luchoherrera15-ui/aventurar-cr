-- ============================================================
-- El adelanto de una reserva cancelada, en la contabilidad del dueño.
--
-- Hasta ahora el motor de finanzas (src/lib/finanzas.ts) excluía por
-- ESTADO: al cancelar una reserva, su adelanto ya validado desaparecía
-- retroactivamente de "entró este mes" — aunque la plata siga en el
-- banco (la política vigente de los términos es no devolver).
--
-- El arreglo separa los dos ejes: lo prospectivo (por cobrar) sigue
-- mirando el estado, y lo retrospectivo (ya cobrado) mira los flags de
-- pago. Esta columna cubre la excepción: si el negocio SÍ devuelve un
-- adelanto, se marca acá y esa plata sale de todos los números.
--
-- Aditiva con default: cero impacto en la app móvil y en las RLS
-- existentes de `reservas`. Es seguro correrla varias veces.
-- ============================================================

alter table reservas add column if not exists adelanto_devuelto boolean not null default false;
