-- ============================================================
-- BOOKEA — Rangos de precio propios para diciembre (0099)
--
-- La tarifa de diciembre "por persona" (tarifa_diciembre_por_persona)
-- no le sirve a los lugares que cobran por rangos: en diciembre
-- quieren los MISMOS márgenes de tanto-a-tanto de siempre, pero con
-- montos más altos (ej. hasta 20 personas ₡150.000; hasta 80,
-- ₡250.000).
--
-- Cada fila de precio_tiers ahora dice a qué temporada pertenece:
--   'normal'    → todo el año (las filas existentes quedan así)
--   'diciembre' → solo fechas de diciembre
--
-- La cotización usa los rangos de diciembre si existen; si no,
-- cae a la tarifa por persona; y si tampoco hay, cobra los rangos
-- normales (antes, sin tarifa configurada, diciembre cotizaba ₡0).
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table precio_tiers
  add column if not exists temporada text not null default 'normal';

do $$ begin
  alter table precio_tiers
    add constraint precio_tiers_temporada_chk
    check (temporada in ('normal', 'diciembre'));
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
