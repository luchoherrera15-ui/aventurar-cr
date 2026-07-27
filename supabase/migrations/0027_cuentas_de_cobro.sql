-- ============================================================
-- AVENTUREA CR — Cuentas de cobro del proveedor (SINPE / banco)
--
-- El paso 2 de la reserva ("Cómo pagar") necesita mostrarle al
-- cliente el número de SINPE o los datos bancarios reales del
-- proveedor, según el método que elija. Antes no existía dónde
-- guardar eso: cada proveedor los tiene que cargar en su panel.
--
-- Ambos bloques son independientes y opcionales — un proveedor
-- puede tener solo SINPE, solo cuenta bancaria, o los dos. La
-- página de reserva solo ofrece como opción el método que el
-- proveedor sí completó.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos add column if not exists sinpe_numero text;
alter table ranchos add column if not exists sinpe_titular text;
alter table ranchos add column if not exists cuenta_banco text;
alter table ranchos add column if not exists cuenta_numero text;
alter table ranchos add column if not exists cuenta_titular text;
alter table ranchos add column if not exists cuenta_tipo text;

notify pgrst, 'reload schema';
