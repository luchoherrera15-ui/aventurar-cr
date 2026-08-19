
-- ============================================================
-- BOOKEA — DESCUENTO CON FECHAS, POR ÍTEM DEL CATÁLOGO (0186)
--
-- Hoy un negocio puede poner precio a cada cosa que vende, pero no
-- puede decir «esto está 20 % off del 1 al 15 de setiembre». La única
-- forma era editar el precio a mano y acordarse de devolverlo — y
-- nadie se acuerda.
--
-- Tres columnas en `rancho_items`, nada más:
--
--   descuento_porcentaje  cuánto se rebaja (1..90)
--   descuento_desde       cuándo arranca
--   descuento_hasta       cuándo termina (null = sin fecha de fin)
--
-- ------------------------------------------------------------
-- POR QUÉ PORCENTAJE Y NO UN PRECIO REBAJADO
-- ------------------------------------------------------------
-- Con un «precio_oferta» habría DOS precios guardados y la pregunta
-- «¿cuál manda?» se contestaría distinto en cada pantalla. Con el
-- porcentaje hay un solo precio real (`precio`) y el descuento es una
-- regla que se aplica encima: el día que la promo vence, el precio
-- que queda es el de siempre, sin que nadie tenga que restaurar nada.
--
-- ------------------------------------------------------------
-- LAS FECHAS SON DÍAS DE COSTA RICA, NO INSTANTES
-- ------------------------------------------------------------
-- `date`, no `timestamptz`: una promo «del 1 al 15» empieza el 1 a las
-- 00:00 y termina el 15 a las 23:59 EN COSTA RICA. Con timestamptz,
-- un descuento que vence «el 15» se apagaría a las 6 de la tarde
-- (UTC), que es el mismo tropiezo que ya corrigió la 0125 con la
-- vigencia de las recompensas.
--
-- El helper `descuento_vigente()` de abajo hace ese corte una sola vez
-- para que la web, la app y cualquier reporte contesten igual — nunca
-- una fecha calculada a mano en TypeScript.
--
-- Aditiva e idempotente: se puede pegar dos veces.
-- ============================================================


-- ------------------------------------------------------------
-- 1. LAS TRES COLUMNAS
-- ------------------------------------------------------------

alter table rancho_items
  add column if not exists descuento_porcentaje numeric;
alter table rancho_items
  add column if not exists descuento_desde date;
alter table rancho_items
  add column if not exists descuento_hasta date;

-- El tope de 90 % no es capricho: un 100 % es «gratis», y eso no es un
-- descuento sino otro producto (o un error de tipeo que dejaría el
-- ítem en ₡0 sin que nadie lo note hasta que alguien lo reserve).
alter table rancho_items drop constraint if exists rancho_items_descuento_check;
alter table rancho_items add constraint rancho_items_descuento_check
  check (
    descuento_porcentaje is null
    or (descuento_porcentaje >= 1 and descuento_porcentaje <= 90)
  );

-- Si hay fecha de fin, no puede ser anterior al arranque.
alter table rancho_items drop constraint if exists rancho_items_descuento_fechas_check;
alter table rancho_items add constraint rancho_items_descuento_fechas_check
  check (
    descuento_hasta is null
    or descuento_desde is null
    or descuento_hasta >= descuento_desde
  );


-- ------------------------------------------------------------
-- 2. ¿ESTÁ VIGENTE HOY?  — una sola verdad para todos
-- ------------------------------------------------------------
-- `immutable` NO: depende de `now()`. `stable` es lo correcto — el
-- resultado no cambia dentro de la misma consulta, que es justo lo que
-- Postgres necesita para poder usarla en un WHERE.
create or replace function public.descuento_vigente(
  p_porcentaje numeric,
  p_desde date,
  p_hasta date
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_porcentaje is not null
    and p_porcentaje > 0
    -- El día de HOY en hora de Costa Rica, igual que el RPC de canje
    -- de la 0125: con UTC, una promo que vence hoy se apagaría a las
    -- 6 de la tarde.
    and (p_desde is null
         or p_desde <= (now() at time zone 'America/Costa_Rica')::date)
    and (p_hasta is null
         or p_hasta >= (now() at time zone 'America/Costa_Rica')::date);
$$;

-- El precio que se cobra HOY por este ítem. Si no hay promo vigente,
-- es el precio de siempre. Se redondea al colón: no existe el medio
-- colón y un 12,5 % sobre ₡8.500 da ₡7.437,50, que nadie cobra.
create or replace function public.precio_con_descuento(
  p_precio numeric,
  p_porcentaje numeric,
  p_desde date,
  p_hasta date
)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when p_precio is null then null
    when public.descuento_vigente(p_porcentaje, p_desde, p_hasta)
      then round(p_precio * (1 - p_porcentaje / 100.0))
    else p_precio
  end;
$$;


-- ------------------------------------------------------------
-- 3. QUIÉN PUEDE ESCRIBIR EL DESCUENTO
-- ------------------------------------------------------------
-- Las políticas de `rancho_items` (0050) ya acotan la escritura al
-- dueño del negocio, así que no hace falta una política nueva. Lo que
-- SÍ hace falta es sumar las tres columnas al grant: la 0050 dio
-- `grant ... on rancho_items` de tabla entera, así que las columnas
-- nuevas entran solas — pero si alguna migración futura acota ese
-- grant por columna (como hizo la 0148 con `miembros`), hay que
-- acordarse de incluirlas.
--
-- Se deja escrito acá para que no se descubra el día que deje de
-- funcionar sin explicación.


-- ------------------------------------------------------------
-- 4. QUE POSTGREST SE ENTERE YA
-- ------------------------------------------------------------
-- Sin esto, la API sigue contestando con el esquema viejo hasta el
-- próximo reinicio y las columnas nuevas dan "column does not exist"
-- desde la app aunque la migración ya haya corrido. Mismo cierre que
-- la 0068 y la 0148.
notify pgrst, 'reload schema';


-- ============================================================
-- COMPROBACIÓN — para correr después de pegar
-- ============================================================
-- select column_name from information_schema.columns
--  where table_name = 'rancho_items'
--    and column_name like 'descuento%';
-- -- Esperado: 3 filas.
--
-- select public.descuento_vigente(20, current_date, current_date);
-- -- Esperado: true (una promo de hoy a hoy está vigente hoy).
--
-- select public.precio_con_descuento(8500, 20, current_date, null);
-- -- Esperado: 6800.
