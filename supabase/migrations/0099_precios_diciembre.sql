-- ============================================================
-- BOOKEA — Precios de DICIEMBRE por temporada (0099)
--
-- Hasta ahora, diciembre era UN solo número por lugar
-- (`ranchos.tarifa_diciembre_por_persona`): una tarifa por persona que
-- reemplazaba los rangos. Eso servía solo a los lugares que cobran por
-- rango de personas, y ni siquiera les dejaba cobrar distinto según el
-- tamaño del grupo — que es justo lo que pasa en diciembre.
--
-- Ahora diciembre tiene su propia lista de precios, con la MISMA forma
-- que la de todo el año:
--
--   1. `precio_tiers.temporada`: los rangos de personas se guardan en
--      la tabla de siempre, marcados 'normal' o 'diciembre'. Un lugar
--      puede tener 0–20 → ₡X y 20–50 → ₡Y solo para diciembre, sin
--      tocar sus rangos del resto del año.
--   2. `ranchos.precio_fijo_diciembre` y `precio_hora_diciembre`: el
--      equivalente para los lugares que cobran fijo por evento o por
--      hora. NULL = ese mes cobra igual que siempre.
--
-- COMPATIBILIDAD: no se migra ningún dato y no se borra la columna
-- vieja. Las filas existentes quedan en temporada 'normal' (el
-- default), así que todo lo que ya funcionaba sigue igual. El cálculo
-- (src/lib/precio-lugar.ts y su espejo en la app) usa los rangos de
-- diciembre si existen y, si no, cae a `tarifa_diciembre_por_persona`
-- como siempre — nadie tiene que volver a cargar sus precios.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La temporada de cada rango de precios
-- ------------------------------------------------------------

alter table precio_tiers
  add column if not exists temporada text not null default 'normal';

alter table precio_tiers drop constraint if exists precio_tiers_temporada_check;
alter table precio_tiers add constraint precio_tiers_temporada_check
  check (temporada in ('normal', 'diciembre'));

-- El cálculo siempre pregunta por (rancho, temporada) y recorre los
-- rangos en orden.
create index if not exists precio_tiers_rancho_temporada_idx
  on precio_tiers (rancho_id, temporada, min_invitados);

comment on column precio_tiers.temporada is
  'normal = precios de todo el año; diciembre = precios especiales de ese mes. Ver src/lib/precio-lugar.ts.';

-- ------------------------------------------------------------
-- 2. Diciembre para las otras dos modalidades de cobro
--    (modalidad_precio_lugar = 'fijo' | 'hora'). NULL = sin precio
--    especial: ese mes se cobra igual que el resto del año.
-- ------------------------------------------------------------

alter table ranchos add column if not exists precio_fijo_diciembre numeric;
alter table ranchos drop constraint if exists ranchos_precio_fijo_diciembre_check;
alter table ranchos add constraint ranchos_precio_fijo_diciembre_check
  check (precio_fijo_diciembre is null or precio_fijo_diciembre >= 0);

alter table ranchos add column if not exists precio_hora_diciembre numeric;
alter table ranchos drop constraint if exists ranchos_precio_hora_diciembre_check;
alter table ranchos add constraint ranchos_precio_hora_diciembre_check
  check (precio_hora_diciembre is null or precio_hora_diciembre >= 0);

-- Las políticas de RLS de precio_tiers y ranchos ya cubren estas
-- columnas (son las mismas filas): no hace falta tocarlas.

notify pgrst, 'reload schema';
