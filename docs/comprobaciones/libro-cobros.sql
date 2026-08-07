-- ============================================================
-- ESTO NO ES UNA MIGRACIÓN. NO HACE FALTA CORRERLO.
--
-- Son las consultas para COMPROBAR que la 0106 quedó bien puesta y que
-- el trigger cobra lo que tiene que cobrar. Todo lo de acá es de solo
-- lectura, menos el simulacro del final — que se deshace solo, a
-- propósito, y termina tirando un "error" que en realidad es el reporte.
--
-- Se corre en el SQL Editor de Supabase DESPUÉS de pegar
-- 0106_libro_cobros_plataforma.sql. Se puede correr las veces que sea.
--
-- Orden sugerido:
--   1 y 2  →  ¿quedó instalado?
--   3 y 4  →  ¿qué dice el libro hoy?
--   5      →  ¿qué falta recuperar? (el mismo criterio que
--              scripts/backfill-cobros-plataforma.mjs, en SQL: sirve
--              para contrastar el total ANTES de aplicar el script)
--   6 y 7  →  cuadres de integridad
--   8      →  el simulacro: prueba el trigger de punta a punta
-- ============================================================


-- ------------------------------------------------------------
-- 1. ¿Existe la tabla, con sus índices y su RLS?
-- ------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'cobros_plataforma') as tabla,
  (select relrowsecurity from pg_class where oid = 'public.cobros_plataforma'::regclass) as rls_prendida,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'cobros_plataforma') as policies,
  (select count(*) from pg_indexes
    where schemaname = 'public' and tablename = 'cobros_plataforma') as indices;


-- ------------------------------------------------------------
-- 2. ¿Está el trigger colgado de `reservas`?
-- ------------------------------------------------------------
select tgname, tgenabled, pg_get_triggerdef(oid) as definicion
from pg_trigger
where tgrelid = 'public.reservas'::regclass
  and not tgisinternal
order by tgname;


-- ------------------------------------------------------------
-- 3. El libro de un vistazo
-- ------------------------------------------------------------
select
  estado,
  concepto,
  count(*)      as asientos,
  sum(monto)    as colones,
  min(semana)   as semana_mas_vieja,
  max(semana)   as semana_mas_nueva
from public.cobros_plataforma
group by estado, concepto
order by estado, concepto;


-- ------------------------------------------------------------
-- 4. La cuenta como la ve la pantalla: semana × negocio, lo pendiente
--    primero y de la semana más vieja a la más nueva.
-- ------------------------------------------------------------
select
  c.semana,
  to_char(c.semana, 'DD/MM') || ' → ' || to_char(c.semana + 6, 'DD/MM') as corte,
  coalesce(r.nombre, '(negocio dado de baja)') as negocio,
  count(*) filter (where c.concepto = 'reserva') as reservas,
  sum(c.personas)                               as personas,
  sum(c.monto)                                  as total
from public.cobros_plataforma c
left join public.ranchos r on r.id = c.rancho_id
where c.estado = 'pendiente'
group by c.semana, r.nombre
order by c.semana, negocio;


-- ------------------------------------------------------------
-- 5. LO QUE FALTA RECUPERAR — el espejo en SQL del script
--    scripts/backfill-cobros-plataforma.mjs.
--
--    Sirve para contrastar: el total de acá tiene que dar IGUAL que el
--    "Plata" que imprime el script en simulación. Si no da igual, algo
--    cambió en el trigger o en el script y hay que mirarlo antes de
--    aplicar nada.
--
--    OJO CON LA SEMANA: sale de `created_at` porque `reservas` no
--    guarda cuándo se confirmó. Es una aproximación (la misma que toma
--    el script) y solo aplica a lo viejo: de acá en adelante el trigger
--    usa la semana de la confirmación de verdad.
-- ------------------------------------------------------------
with tarifa_global as (
  -- Siempre una fila, aunque `configuracion_plataforma` esté vacía:
  -- si no, el cross join se comería el resultado entero.
  select coalesce(
    (select comision_por_persona from public.configuracion_plataforma limit 1),
    0
  ) as valor
),
pendientes as (
  select
    r.id,
    r.nombre,
    r.fecha,
    r.rancho_id,
    greatest(1, coalesce(r.invitados, 1))                         as personas,
    coalesce(cn.modelo, 'comision_por_persona')                   as modelo,
    coalesce(cn.valor, g.valor, 0)                                as tarifa,
    coalesce(r.monto_cobrado_final, r.monto_total, 0)             as total_evento,
    date_trunc('week', r.created_at at time zone 'America/Costa_Rica')::date as semana
  from public.reservas r
  cross join tarifa_global g
  left join public.cobro_negocio cn on cn.rancho_id = r.rancho_id
  where r.estado = 'confirmada'
    and r.rancho_id is not null
    and not exists (
      select 1 from public.cobros_plataforma c
      where c.reserva_id = r.id and c.concepto = 'reserva'
    )
),
calculadas as (
  select
    p.*,
    case p.modelo
      when 'comision_por_persona'  then p.personas * p.tarifa
      when 'comision_fija_reserva' then p.tarifa
      when 'comision_porcentaje'   then round(p.total_evento * p.tarifa / 100)
      else 0  -- membresía y gratis no cobran por reserva
    end as monto
  from pendientes p
)
select
  coalesce(ra.nombre, '(sin negocio)') as negocio,
  c.modelo,
  count(*)     as reservas,
  sum(c.personas) as personas,
  sum(c.monto) as se_recuperaria
from calculadas c
left join public.ranchos ra on ra.id = c.rancho_id
where c.monto > 0
group by rollup (coalesce(ra.nombre, '(sin negocio)'), c.modelo)
order by se_recuperaria desc nulls last;


-- ------------------------------------------------------------
-- 6. Lo recuperado a mano vs. lo que anotó el trigger.
--    Las filas del script quedan marcadas en `notas`.
-- ------------------------------------------------------------
select
  case when notas like 'recuperado%' then 'recuperado por el script'
       else 'anotado por el trigger' end as origen,
  count(*)   as asientos,
  sum(monto) as colones
from public.cobros_plataforma
where concepto = 'reserva'
group by 1;


-- ------------------------------------------------------------
-- 7. Cuadres de integridad (las tres tienen que dar CERO filas)
-- ------------------------------------------------------------

-- 7a. Ninguna reserva con dos cobros del mismo concepto.
select reserva_id, concepto, count(*)
from public.cobros_plataforma
where reserva_id is not null
group by reserva_id, concepto
having count(*) > 1;

-- 7b. Ningún cobro pendiente de una reserva que se canceló (el trigger
--     tiene que haberlo anulado).
select c.id, c.monto, r.estado
from public.cobros_plataforma c
join public.reservas r on r.id = c.reserva_id
where c.concepto = 'reserva'
  and c.estado = 'pendiente'
  and r.estado in ('cancelada', 'rechazada');

-- 7c. Ningún cobro con semana que no sea lunes.
select id, semana, extract(isodow from semana) as dia_semana
from public.cobros_plataforma
where extract(isodow from semana) <> 1;

-- 7d. (informativa, puede dar filas) Cobros de reservas ya borradas:
--     tienen que seguir en el histórico, con el cliente y la fecha
--     copiados. Si esto se vacía solo, algo está borrando plata.
select id, cliente, fecha_evento, monto, estado, semana
from public.cobros_plataforma
where reserva_id is null
order by semana desc;


-- ============================================================
-- 8. EL SIMULACRO — prueba el trigger de punta a punta.
--
-- Crea dos reservas de mentira en una fecha del año 2099, las confirma,
-- las cancela y revisa que el libro haya hecho lo que tiene que hacer.
-- TERMINA TIRANDO UNA EXCEPCIÓN A PROPÓSITO: eso deshace TODO lo que
-- hizo (las reservas de mentira y sus cobros) y de paso devuelve el
-- reporte en el mensaje de error. Ese "error" rojo es el resultado —
-- leelo, no es una falla.
--
-- Es seguro correrlo en producción: no queda nada.
-- ============================================================
do $$
declare
  v_rancho   uuid;
  v_reserva  uuid;
  v_otra     uuid;
  v_reporte  text := '';
  v_monto    numeric;
  v_estado   text;
  v_semana   date;
  v_n        integer;
begin
  select id into v_rancho from public.ranchos limit 1;
  if v_rancho is null then
    raise exception 'SIMULACRO: no hay ningún negocio en `ranchos`, no se puede probar.';
  end if;

  -- ---------- Caso 1: se confirma y después se cancela ----------
  insert into public.reservas
    (fecha, nombre, contacto, tipo_evento, invitados, estado,
     monto_total, deposito_monto, rancho_id)
  values
    ('2099-12-31', 'SIMULACRO 0106', 'simulacro', 'Prueba', 100, 'pendiente',
     1000000, 25000, v_rancho)
  returning id into v_reserva;

  select count(*) into v_n from public.cobros_plataforma where reserva_id = v_reserva;
  v_reporte := v_reporte || E'\n  ' ||
    case when v_n = 0 then '✓' else '✗ FALLA' end ||
    ' una reserva PENDIENTE no debe nada (asientos: ' || v_n || ')';

  update public.reservas set estado = 'confirmada' where id = v_reserva;

  select monto, estado, semana into v_monto, v_estado, v_semana
  from public.cobros_plataforma
  where reserva_id = v_reserva and concepto = 'reserva';

  v_reporte := v_reporte || E'\n  ' ||
    case when v_monto is not null and v_estado = 'pendiente' then '✓' else '✗ FALLA' end ||
    ' al CONFIRMAR nace el cobro: ' || coalesce(v_monto::text, '(no se creó)') ||
    ' colones, estado ' || coalesce(v_estado, '—') ||
    ', semana ' || coalesce(v_semana::text, '—') ||
    ' (lunes: ' || coalesce((extract(isodow from v_semana) = 1)::text, '—') || ')';

  -- Idempotencia: volver a confirmarla no puede cobrar dos veces.
  update public.reservas set estado = 'pendiente'  where id = v_reserva;
  update public.reservas set estado = 'confirmada' where id = v_reserva;
  select count(*) into v_n
  from public.cobros_plataforma where reserva_id = v_reserva and concepto = 'reserva';
  v_reporte := v_reporte || E'\n  ' ||
    case when v_n = 1 then '✓' else '✗ FALLA' end ||
    ' reconfirmar NO cobra de nuevo (asientos: ' || v_n || ')';

  -- Cancelar: se anula lo pendiente y entra el 10 % del depósito.
  update public.reservas set estado = 'cancelada' where id = v_reserva;

  select estado into v_estado
  from public.cobros_plataforma where reserva_id = v_reserva and concepto = 'reserva';
  v_reporte := v_reporte || E'\n  ' ||
    case when v_estado = 'anulado' then '✓' else '✗ FALLA' end ||
    ' al CANCELAR el cobro original queda ' || coalesce(v_estado, '(no está)');

  select monto into v_monto
  from public.cobros_plataforma where reserva_id = v_reserva and concepto = 'cancelacion';
  v_reporte := v_reporte || E'\n  ' ||
    case when v_monto = 2500 then '✓' else '✗ FALLA' end ||
    ' entra el 10 % del depósito de 25.000: ' || coalesce(v_monto::text, '(no entró)') ||
    ' (se esperaba 2500)';

  -- ---------- Caso 2: el cobro YA estaba pagado ----------
  -- Lo cobrado no se toca: ni se anula ni suma un 10 % encima.
  insert into public.reservas
    (fecha, nombre, contacto, tipo_evento, invitados, estado,
     monto_total, deposito_monto, rancho_id)
  values
    ('2099-12-30', 'SIMULACRO 0106 pagado', 'simulacro', 'Prueba', 40, 'pendiente',
     500000, 50000, v_rancho)
  returning id into v_otra;

  update public.reservas set estado = 'confirmada' where id = v_otra;
  update public.cobros_plataforma
    set estado = 'pagado', pagado_en = now()
    where reserva_id = v_otra and concepto = 'reserva';

  update public.reservas set estado = 'cancelada' where id = v_otra;

  select estado into v_estado
  from public.cobros_plataforma where reserva_id = v_otra and concepto = 'reserva';
  select count(*) into v_n
  from public.cobros_plataforma where reserva_id = v_otra and concepto = 'cancelacion';

  v_reporte := v_reporte || E'\n  ' ||
    case when v_estado = 'pagado' and v_n = 0 then '✓' else '✗ FALLA' end ||
    ' lo YA PAGADO no se toca al cancelar (quedó ' || coalesce(v_estado, '—') ||
    ', cobros de cancelación: ' || v_n || ')';

  raise exception E'SIMULACRO 0106 — TODO DESHECHO, no quedó nada guardado.%',
    E'\n' || v_reporte || E'\n';
end $$;
