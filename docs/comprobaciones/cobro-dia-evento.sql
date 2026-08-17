-- ============================================================
-- COMPROBACIÓN DE LA 0171 — el cobro que se devenga el día del evento
--
-- Pegar en el SQL Editor de Supabase DESPUÉS de correr la migración
-- 0171. Cada bloque se puede correr suelto.
--
-- Los tests de vitest (src/lib/cobro-dia-evento.test.ts) prueban el
-- ESPEJO en TypeScript de estas reglas. Esto de acá prueba lo que de
-- verdad manda: la función en la base. Las dos cosas tienen que decir
-- lo mismo.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ¿Está todo puesto?
-- ------------------------------------------------------------
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'devengar_cobros_del_dia')
    as funcion_barrido,           -- tiene que ser 1
  (select count(*) from pg_indexes
   where schemaname = 'public' and indexname = 'cobros_plataforma_reserva_concepto_idx')
    as indice_unico,              -- tiene que ser 1  ← LA IDEMPOTENCIA
  (select count(*) from pg_trigger
   where tgname = 'reservas_cobro_plataforma' and not tgisinternal)
    as trigger_cancelacion;       -- tiene que ser 1


-- ------------------------------------------------------------
-- 2. Quién puede llamar al barrido.
--
-- Mueve plata: solo `service_role` (el cron). Si acá aparece `anon` o
-- `authenticated`, cualquiera con la anon key podría devengar cobros.
-- ------------------------------------------------------------
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'devengar_cobros_del_dia'
order by grantee;


-- ------------------------------------------------------------
-- 3. El trigger ya NO cobra al confirmar.
--
-- Busca en el cuerpo de la función la rama que se eliminó. Tiene que
-- dar `false` en la primera columna y `true` en la segunda.
-- ------------------------------------------------------------
select
  prosrc like '%new.estado = ''confirmada''%' as todavia_cobra_al_confirmar,
  prosrc like '%porcentaje_deposito%'         as conserva_el_10_por_ciento
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'registrar_cobro_plataforma';


-- ------------------------------------------------------------
-- 4. Qué se devengaría AHORA MISMO (no escribe nada).
--
-- Es la misma consulta del barrido, sin el insert. `hoy_alla` es el día
-- que es hoy DONDE ESTÁ EL NEGOCIO: si un negocio de otra zona muestra
-- una fecha distinta a la de los ticos, está bien — es el punto.
-- ------------------------------------------------------------
with zonas as materialized (select name from pg_timezone_names)
select
  ra.nombre                                        as negocio,
  coalesce(z.name, 'America/Costa_Rica')           as zona,
  (now() at time zone coalesce(z.name, 'America/Costa_Rica'))::date as hoy_alla,
  res.id, res.fecha, res.estado, res.nombre as cliente, res.invitados
from public.reservas res
join public.ranchos ra on ra.id = res.rancho_id
left join zonas z on z.name = ra.zona_horaria
where res.estado in ('confirmada', 'cumplida', 'no_asistio')
  and res.fecha <= (now() at time zone coalesce(z.name, 'America/Costa_Rica'))::date
  and res.fecha >  (now() at time zone coalesce(z.name, 'America/Costa_Rica'))::date - 7
  and not exists (
    select 1 from public.cobros_plataforma c
    where c.reserva_id = res.id and c.concepto = 'reserva'
  )
order by ra.nombre, res.fecha;


-- ------------------------------------------------------------
-- 5. Que nadie haya cobrado dos veces la misma reserva.
--
-- Tiene que salir VACÍO siempre. Si algún día devuelve una fila, el
-- índice único no está puesto y hay que revisar la 0171 de inmediato.
-- ------------------------------------------------------------
select reserva_id, concepto, count(*) as veces, sum(monto) as total
from public.cobros_plataforma
where reserva_id is not null
group by reserva_id, concepto
having count(*) > 1;


-- ------------------------------------------------------------
-- 6. Los asientos nuevos, separados de los viejos.
--
-- Las filas que anotó el barrido dicen 'devengado el día del evento' en
-- `notas`. En esas, la semana tiene que coincidir con la semana del
-- evento; en las viejas (las que anotó el trigger al confirmar) puede
-- no coincidir, y está bien: son de la semántica anterior.
-- ------------------------------------------------------------
select
  case when notas = 'devengado el día del evento' then 'nuevo (día del evento)'
       else 'viejo (al confirmar)' end                       as origen,
  count(*)                                                    as asientos,
  sum(monto)                                                  as total,
  count(*) filter (
    where fecha_evento is not null
      and semana <> date_trunc('week', fecha_evento::timestamp)::date
  )                                                           as semana_no_coincide
from public.cobros_plataforma
where concepto = 'reserva'
group by 1;


-- ============================================================
-- 7. EL SIMULACRO — prueba el barrido de punta a punta.
--
-- Crea reservas de mentira con fecha de AYER (para que el barrido las
-- tenga que agarrar) y comprueba las cuatro cosas que importan:
--   a. el barrido las cobra;
--   b. correrlo DOS VECES no las cobra dos veces;
--   c. una reserva de mañana no se toca;
--   d. una reserva PENDIENTE no se cobra.
--
-- TERMINA TIRANDO UNA EXCEPCIÓN A PROPÓSITO: eso deshace TODO (las
-- reservas de mentira y sus cobros) y devuelve el reporte en el mensaje
-- de error. Ese "error" rojo es el resultado — leelo, no es una falla.
--
-- Es seguro correrlo en producción: no queda nada.
--
-- ⚠️ OJO: `devengar_cobros_del_dia` no se limita a las reservas de
-- mentira, barre TODO lo que corresponda. Dentro de esta transacción da
-- igual (se deshace entero), pero por eso el reporte cuenta solo las
-- filas de las reservas del simulacro.
-- ============================================================
do $$
declare
  v_rancho  uuid;
  v_ayer    uuid;
  v_manana  uuid;
  v_pend    uuid;
  v_reporte text := '';
  v_n       integer;
  v_n2      integer;
  v_monto   numeric;
  v_semana  date;
  v_fecha   date;
begin
  -- Un negocio que tenga libres los días de alrededor: desde la 0049 hay
  -- un cupo por día (`reservas_respeta_cupo_dia`) y meter una reserva de
  -- mentira en un día ya ocupado haría reventar el simulacro con un
  -- error de cupo en vez de con su reporte.
  select r.id into v_rancho
  from public.ranchos r
  where not exists (
    select 1 from public.reservas res
    where res.rancho_id = r.id
      and res.estado = 'confirmada'
      and res.fecha between current_date - 2 and current_date + 2
  )
  limit 1;

  if v_rancho is null then
    raise exception 'SIMULACRO 0171: no hay ningún negocio con los días de alrededor libres.';
  end if;

  -- Ayer y mañana en la zona del negocio, no en UTC.
  select (now() at time zone coalesce(
           (select name from pg_timezone_names where name = r.zona_horaria),
           'America/Costa_Rica'))::date
    into v_fecha
  from public.ranchos r where r.id = v_rancho;

  -- ---------- Las tres reservas de mentira ----------
  insert into public.reservas
    (fecha, nombre, contacto, tipo_evento, invitados, estado,
     monto_total, deposito_monto, rancho_id)
  values
    (v_fecha - 1, 'SIMULACRO 0171 ayer', 'simulacro', 'Prueba', 10, 'confirmada',
     500000, 25000, v_rancho)
  returning id into v_ayer;

  insert into public.reservas
    (fecha, nombre, contacto, tipo_evento, invitados, estado,
     monto_total, deposito_monto, rancho_id)
  values
    (v_fecha + 1, 'SIMULACRO 0171 mañana', 'simulacro', 'Prueba', 10, 'confirmada',
     500000, 25000, v_rancho)
  returning id into v_manana;

  insert into public.reservas
    (fecha, nombre, contacto, tipo_evento, invitados, estado,
     monto_total, deposito_monto, rancho_id)
  values
    (v_fecha - 1, 'SIMULACRO 0171 pendiente', 'simulacro', 'Prueba', 10, 'pendiente',
     500000, 25000, v_rancho)
  returning id into v_pend;

  -- a. Confirmar YA NO cobra.
  select count(*) into v_n from public.cobros_plataforma
  where reserva_id in (v_ayer, v_manana);
  v_reporte := v_reporte || E'\n  ' ||
    case when v_n = 0 then '✓' else '✗ FALLA' end ||
    ' confirmar ya NO anota cobro (asientos: ' || v_n || ')';

  -- b. El barrido cobra la de ayer.
  perform public.devengar_cobros_del_dia(7);

  select count(*), max(monto), max(semana) into v_n, v_monto, v_semana
  from public.cobros_plataforma where reserva_id = v_ayer and concepto = 'reserva';
  v_reporte := v_reporte || E'\n  ' ||
    case when v_n = 1 then '✓' else '✗ FALLA' end ||
    ' el barrido cobra el evento de AYER (asientos: ' || v_n ||
    ', monto: ' || coalesce(v_monto::text, '—') || ')';

  v_reporte := v_reporte || E'\n  ' ||
    case when v_semana = date_trunc('week', (v_fecha - 1)::timestamp)::date
         then '✓' else '✗ FALLA' end ||
    ' la semana es la del EVENTO (' || coalesce(v_semana::text, '—') ||
    ', se esperaba ' || date_trunc('week', (v_fecha - 1)::timestamp)::date || ')';

  -- c. IDEMPOTENCIA: correrlo otra vez no cobra de nuevo.
  perform public.devengar_cobros_del_dia(7);
  perform public.devengar_cobros_del_dia(7);
  select count(*) into v_n2
  from public.cobros_plataforma where reserva_id = v_ayer and concepto = 'reserva';
  v_reporte := v_reporte || E'\n  ' ||
    case when v_n2 = 1 then '✓' else '✗ FALLA' end ||
    ' correr el barrido TRES veces no cobra de más (asientos: ' || v_n2 || ')';

  -- d. La de mañana no se toca.
  select count(*) into v_n
  from public.cobros_plataforma where reserva_id = v_manana;
  v_reporte := v_reporte || E'\n  ' ||
    case when v_n = 0 then '✓' else '✗ FALLA' end ||
    ' el evento de MAÑANA no se cobra todavía (asientos: ' || v_n || ')';

  -- e. La pendiente no se cobra.
  select count(*) into v_n
  from public.cobros_plataforma where reserva_id = v_pend;
  v_reporte := v_reporte || E'\n  ' ||
    case when v_n = 0 then '✓' else '✗ FALLA' end ||
    ' una reserva PENDIENTE cuyo día llegó no se cobra (asientos: ' || v_n || ')';

  -- f. La cancelación sigue cobrando el 10 % del depósito.
  update public.reservas set estado = 'cancelada' where id = v_manana;
  select monto into v_monto
  from public.cobros_plataforma where reserva_id = v_manana and concepto = 'cancelacion';
  v_reporte := v_reporte || E'\n  ' ||
    case when v_monto = 2500 then '✓' else '✗ FALLA' end ||
    ' al cancelar entra el 10 % del depósito de 25.000: ' ||
    coalesce(v_monto::text, '(no entró)') || ' (se esperaba 2500)';

  raise exception E'SIMULACRO 0171 — TODO DESHECHO, no quedó nada guardado.%',
    E'\n' || v_reporte || E'\n';
end $$;
