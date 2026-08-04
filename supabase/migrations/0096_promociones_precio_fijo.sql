-- ============================================================
-- Promociones automáticas: además del % de descuento, el dueño puede
-- fijar un PRECIO FIJO para esos días con un tope opcional de
-- personas (ej. "₡55.000 de lunes a miércoles, 15 personas máximo").
-- Es mutuamente excluyente con el %: cada fila es una cosa o la otra.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table promociones_dia alter column porcentaje_descuento drop not null;

alter table promociones_dia add column if not exists tipo text not null default 'porcentaje';
alter table promociones_dia add column if not exists precio_fijo numeric;
alter table promociones_dia add column if not exists personas_max integer;

alter table promociones_dia drop constraint if exists promociones_dia_tipo_check;
alter table promociones_dia add constraint promociones_dia_tipo_check
  check (tipo in ('porcentaje', 'precio_fijo'));

alter table promociones_dia drop constraint if exists promociones_dia_personas_max_check;
alter table promociones_dia add constraint promociones_dia_personas_max_check
  check (personas_max is null or personas_max > 0);

-- Reemplaza el check inline de la 0013 (ligaba solo el %) por uno que
-- amarra los tres campos a la modalidad elegida: nunca los dos
-- precios a la vez, y cada uno obligatorio solo en su modalidad.
alter table promociones_dia drop constraint if exists promociones_dia_porcentaje_descuento_check;
alter table promociones_dia drop constraint if exists promociones_dia_tipo_datos_check;
alter table promociones_dia add constraint promociones_dia_tipo_datos_check
  check (
    (tipo = 'porcentaje'
      and porcentaje_descuento is not null
      and porcentaje_descuento > 0 and porcentaje_descuento <= 100
      and precio_fijo is null)
    or
    (tipo = 'precio_fijo'
      and precio_fijo is not null and precio_fijo > 0
      and porcentaje_descuento is null)
  );
