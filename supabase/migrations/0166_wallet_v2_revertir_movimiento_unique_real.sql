-- ============================================================
-- FASE 2C — hallazgo real, NO causado por Wallet V2: revertir_movimiento
-- (0125, 0139 — ya en producción hoy) confía en "el unique parcial
-- sobre reversion_de garantiza UNA compensación por movimiento, aun
-- con dos clics simultáneos" (comentario textual de 0139) y CAPTURA
-- unique_violation para ese caso — pero ese índice único NUNCA se
-- creó. Se probó con sesiones reales (ver
-- docs/wallet-v2/fase-2c-resultado.md §10): sin el índice, nada impide
-- una segunda fila de reversa apuntando al mismo movimiento original —
-- el `if v_tx.reversion_de is not null` de la función valida si V_TX
-- MISMO es una reversa de otra cosa, no si V_TX YA FUE REVERTIDO por
-- alguien más. El código de manejo de "ya fue revertido" es correcto;
-- lo único que faltaba era el índice que lo activa.
--
-- Se corrige acá (dentro del lote de Wallet V2, todavía no desplegado)
-- porque es el momento correcto para pegarlo junto con el resto — pero
-- el bug en sí es independiente de Wallet V2 y ya existe en producción
-- desde 0139. Ver el reporte final de Fase 2C para la recomendación de
-- aplicarlo cuanto antes, incluso si el resto del lote se pospone.
-- ============================================================

create unique index if not exists transacciones_puntos_reversion_de_unica_idx
  on transacciones_puntos (reversion_de)
  where reversion_de is not null;

comment on index transacciones_puntos_reversion_de_unica_idx is
  'Fase 2C — el índice que revertir_movimiento (0125/0139) siempre '
  'asumió que existía. Sin él, dos llamadas concurrentes podían crear '
  'dos filas de reversa para el mismo movimiento original, acreditando '
  'el doble. Ver fase-2c-resultado.md §10.';
