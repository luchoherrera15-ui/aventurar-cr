-- ============================================================
-- Modalidad de precio "por persona" (pedida para Rancho Las Torres):
--
--   * Un FIJO cubre a los grupos chicos (1..baseMax, ej. 1-25).
--   * De ahí en adelante se cobra invitados × tarifa — y el cliente ve
--     SOLO el total multiplicado, nunca "₡X por persona".
--   * En diciembre el fijo depende del día (lun-jue / viernes /
--     sáb-dom) y la tarifa por persona es DESLIZANTE: anclas
--     [invitados → tarifa] con interpolación lineal entre ellas y
--     plana después de la última (ej. 30→5500, 50→4500, 100→4000).
--
-- La configuración completa vive en UNA columna jsonb para no sembrar
-- una docena de columnas: la valida el código al leer (una config
-- malformada = precio "consultar", nunca ₡0). El cálculo canónico está
-- en src/lib/precio-lugar.ts y su espejo de la app.
--
-- Es seguro correrla varias veces.
-- ============================================================

alter table ranchos add column if not exists precio_por_persona jsonb;

-- El check de la 0039 no conocía la modalidad nueva.
alter table ranchos drop constraint if exists ranchos_modalidad_precio_lugar_check;
alter table ranchos add constraint ranchos_modalidad_precio_lugar_check
  check (modalidad_precio_lugar in ('rango_personas', 'hora', 'fijo', 'por_persona'));
