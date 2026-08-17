-- ============================================================
-- EL COBRO DE PLATAFORMA SE DEVENGA EL DÍA DEL EVENTO
--
-- QUÉ CAMBIA
--   Hasta hoy la comisión que Bookea le cobra al negocio nacía en el
--   momento en que la reserva pasaba a 'confirmada' (trigger
--   `reservas_cobro_plataforma`, migración 0106). Una reserva
--   confirmada en marzo para un evento de diciembre ya aparecía como
--   cuenta por cobrar en marzo, en la semana de marzo.
--
--   Desde acá el asiento nace EL DÍA DEL EVENTO, y su semana de corte
--   es la semana del EVENTO, no la de la confirmación.
--
-- QUÉ **NO** CAMBIA (a propósito — es plata, no se toca lo que nadie
-- pidió cambiar):
--   · La fórmula del monto es EXACTAMENTE la misma que traía el
--     trigger de la 0106. Mismos cinco modelos, misma tarifa (la del
--     negocio en `cobro_negocio` o el default global de
--     `configuracion_plataforma`), mismo mínimo de una persona.
--   · La cancelación sigue igual: al cancelarse o rechazarse una
--     reserva se anula lo pendiente y entra el 10 % del depósito
--     retenido, en la semana de la cancelación. Ese pedazo del trigger
--     queda intacto — si se hubiera borrado junto con el otro, una
--     reserva que se cae antes del evento habría dejado de pagar ese
--     10 % SIN QUE NADIE LO NOTARA.
--   · Las filas ya escritas no se tocan, ni se recalculan, ni se
--     re-etiquetan. Las viejas dicen "semana de la confirmación" y las
--     nuevas "semana del evento". Se distinguen por `notas`: las
--     nuevas dicen 'devengado el día del evento'.
--
-- LA TRANSICIÓN NO PUEDE COBRAR DOS VECES
--   Una reserva confirmada ANTES de esta migración ya dejó su asiento.
--   Cuando llegue el día de su evento, el barrido intentará anotarlo
--   otra vez y chocará contra el índice único (reserva_id, concepto):
--   no escribe nada. O sea: lo ya devengado se devengó una sola vez,
--   en la semana vieja, y ahí se queda.
--
-- POR QUÉ AHORA HACE FALTA UN CRON Y NO ALCANZA EL TRIGGER
--   Un trigger necesita que alguien toque la fila. El día del evento
--   nadie la toca: la fecha simplemente llega. Por eso el disparo pasa
--   a ser un barrido diario (ver src/app/api/cobro-plataforma/route.ts
--   y .github/workflows/cobro-del-dia.yml) que llama a la función
--   `devengar_cobros_del_dia` de acá abajo.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================


-- ------------------------------------------------------------
-- 1. La red de la idempotencia, por si acaso
--
-- Este índice ya lo crea la 0106. Se repite porque es LA garantía de
-- que una reserva no se cobre dos veces, y esta migración construye
-- todo lo demás encima de él: si por lo que sea no estuviera, el
-- barrido podría duplicar plata. Es `if not exists`, así que si ya
-- está no hace nada.
-- ------------------------------------------------------------
create unique index if not exists cobros_plataforma_reserva_concepto_idx
  on public.cobros_plataforma (reserva_id, concepto)
  where reserva_id is not null;


-- ------------------------------------------------------------
-- 2. El trigger deja de cobrar al confirmar
--
-- Se conserva ENTERA la rama de cancelación. Lo único que se va es la
-- rama de 'confirmada', que ahora la hace el barrido diario.
-- ------------------------------------------------------------
create or replace function public.registrar_cobro_plataforma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana   date;
  v_deposito numeric;
begin
  -- Solo interesa el CAMBIO de estado (o el alta ya en ese estado).
  if tg_op = 'UPDATE' and old.estado is not distinct from new.estado then
    return new;
  end if;
  if new.rancho_id is null then
    return new;
  end if;

  -- ---------- Se confirma: ya NO nace nada acá ----------
  -- El asiento de la reserva lo anota `devengar_cobros_del_dia` el día
  -- del evento. Confirmar una reserva no le debe plata a nadie
  -- todavía: el servicio no se prestó.

  -- ---------- Se cae: se anula y entra el 10 % del depósito ----------
  -- Sin cambios respecto de la 0106. Ojo con una consecuencia del
  -- cambio de arriba: hoy, cuando una reserva se cancela ANTES de su
  -- evento, lo normal es que NO exista asiento de 'reserva' que anular
  -- (nunca llegó a nacer). El update de abajo simplemente no encuentra
  -- filas, y el 10 % entra igual — que es justamente lo que se quiere:
  -- el negocio se quedó con el adelanto, Bookea cobra su parte.
  if new.estado in ('cancelada', 'rechazada') then
    v_semana := date_trunc(
      'week', (now() at time zone 'America/Costa_Rica')
    )::date;

    -- Lo ya PAGADO no se toca nunca: esa plata ya se cobró.
    update public.cobros_plataforma
    set estado = 'anulado',
        notas = trim(both ' ·' from coalesce(notas, '') || ' · anulado al cancelarse la reserva')
    where reserva_id = new.id
      and concepto = 'reserva'
      and estado = 'pendiente';

    v_deposito := coalesce(new.deposito_monto, 0);

    if v_deposito > 0 and not exists (
      select 1 from public.cobros_plataforma
      where reserva_id = new.id and concepto = 'reserva' and estado = 'pagado'
    ) then
      insert into public.cobros_plataforma (
        reserva_id, rancho_id, concepto, personas, tarifa, modelo, monto,
        semana, cliente, fecha_evento, notas
      ) values (
        new.id, new.rancho_id, 'cancelacion', 0, 10, 'porcentaje_deposito',
        round(v_deposito * 0.10), v_semana, new.nombre, new.fecha,
        '10 % del depósito retenido por cancelación'
      )
      on conflict (reserva_id, concepto) where reserva_id is not null
      do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservas_cobro_plataforma on public.reservas;
create trigger reservas_cobro_plataforma
  after insert or update of estado on public.reservas
  for each row
  execute function public.registrar_cobro_plataforma();


-- ------------------------------------------------------------
-- 3. El barrido del día
--
-- Anota el cobro de todas las reservas cuyo evento YA ocurrió (hoy o
-- en los últimos `p_dias_atras` días, cada una según la hora de SU
-- negocio) y que todavía no tienen asiento.
--
-- ── IDEMPOTENCIA ───────────────────────────────────────────────
-- Todo el barrido es UNA SOLA sentencia `insert ... select ... on
-- conflict do nothing`, apoyada en el índice único
-- (reserva_id, concepto). Eso significa:
--
--   · Correrlo dos veces seguidas: la segunda corrida no escribe nada
--     y devuelve CERO filas. El correo de aviso sale de esas filas
--     devueltas, así que tampoco se avisa dos veces.
--   · Correrlo dos veces A LA VEZ (el cron se reintenta mientras la
--     primera corrida sigue viva): las dos calculan el mismo conjunto,
--     las dos intentan insertar. Postgres hace que la segunda espere
--     en el índice único hasta que la primera confirme, y ahí ve el
--     conflicto y no escribe. No hay ventana entre "consultar si ya
--     existe" y "insertar" porque nunca se consulta: el candado ES el
--     insert. Un `select ... if not exists ... then insert` en
--     TypeScript sí tendría esa ventana y podría cobrar doble.
--   · Que se caiga a la mitad: la sentencia es atómica. O entran todos
--     los asientos del día o no entra ninguno. Nunca queda medio día
--     cobrado.
--
-- ── LA ZONA HORARIA ────────────────────────────────────────────
-- "El día del evento" se evalúa con la zona de CADA negocio
-- (`ranchos.zona_horaria`, 0062), no en UTC ni en la del servidor. Un
-- negocio de Costa Rica y uno de Ciudad de México cambian de día en
-- momentos distintos, y cobrar el día anterior es un error de plata.
-- Si la zona guardada no es una zona IANA válida se cae a
-- America/Costa_Rica en vez de reventar el barrido entero.
--
-- ── LA VENTANA HACIA ATRÁS ─────────────────────────────────────
-- No barre solo "hoy" sino los últimos días, con tope de 90. Es lo que
-- salva tres casos reales:
--   · la reserva que se creó y se confirmó el mismo día del evento,
--     después de que el barrido ya había corrido;
--   · el cron que no corrió (GitHub Actions caído, deploy en curso);
--   · el salto de fecha por horario de verano en zonas que lo tienen.
-- Y el tope evita lo contrario: que una corrida a mano con un número
-- grande facture de golpe un año de histórico.
-- ------------------------------------------------------------
create or replace function public.devengar_cobros_del_dia(
  p_dias_atras integer default 7
)
returns table (
  cobro_id     uuid,
  reserva      uuid,
  negocio_id   uuid,
  negocio      text,
  cliente      text,
  fecha_evento date,
  personas     integer,
  tarifa       numeric,
  modelo       text,
  monto        numeric,
  semana       date
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_dias integer := greatest(0, least(coalesce(p_dias_atras, 7), 90));
begin
  return query
  with zonas as materialized (
    -- Una sola pasada por el catálogo de zonas: sirve para validar la
    -- `zona_horaria` de cada negocio sin arriesgar una excepción.
    -- `materialized` para que el planificador no lo meta adentro del
    -- join y termine recorriendo el catálogo una vez por reserva.
    select name from pg_timezone_names
  ),
  global_cfg as (
    select coalesce(max(cp.comision_por_persona), 0) as valor
    from public.configuracion_plataforma cp
  ),
  candidatas as (
    select
      res.id                                  as reserva_id,
      res.rancho_id                           as rancho_id,
      res.nombre                              as cliente,
      res.fecha                               as fecha_evento,
      greatest(1, coalesce(res.invitados, 1)) as personas,
      coalesce(cn.modelo, 'comision_por_persona') as modelo,
      coalesce(cn.valor, g.valor)                 as tarifa,
      coalesce(res.monto_cobrado_final, res.monto_total, 0) as total_evento
    from public.reservas res
    join public.ranchos ra on ra.id = res.rancho_id
    left join zonas z on z.name = ra.zona_horaria
    left join public.cobro_negocio cn on cn.rancho_id = res.rancho_id
    cross join global_cfg g
    where
      -- Los estados que representan un servicio efectivamente prestado.
      -- 'cumplida' y 'no_asistio' entran porque las citas pasan por ahí
      -- el MISMO día del evento: si el barrido solo mirara 'confirmada',
      -- una cita marcada a las 10am dejaría de pagar comisión para
      -- siempre. Antes de este cambio esas reservas SÍ cobraban (lo
      -- hacían al confirmarse); dejarlas fuera sería perder plata en
      -- silencio.
      res.estado in ('confirmada', 'cumplida', 'no_asistio')
      and res.fecha <= (
        now() at time zone coalesce(z.name, 'America/Costa_Rica')
      )::date
      and res.fecha > (
        now() at time zone coalesce(z.name, 'America/Costa_Rica')
      )::date - v_dias
  ),
  calculadas as (
    select
      c.reserva_id,
      c.rancho_id,
      c.cliente,
      c.fecha_evento,
      c.personas,
      c.modelo,
      c.tarifa,
      -- Espejo exacto del `case v_modelo` que traía la 0106.
      -- 'membresia_mensual' y 'gratis' caen en el else y dan 0, así que
      -- el filtro `monto > 0` de abajo los deja fuera solos.
      case c.modelo
        when 'comision_por_persona'  then c.personas * c.tarifa
        when 'comision_fija_reserva' then c.tarifa
        when 'comision_porcentaje'   then round(c.total_evento * c.tarifa / 100)
        else 0
      end as monto
    from candidatas c
  ),
  insertadas as (
    insert into public.cobros_plataforma (
      reserva_id, rancho_id, concepto, personas, tarifa, modelo, monto,
      semana, cliente, fecha_evento, notas
    )
    select
      k.reserva_id,
      k.rancho_id,
      'reserva',
      k.personas,
      k.tarifa,
      k.modelo,
      k.monto,
      -- La semana de corte es la del EVENTO, no la de la corrida. Si el
      -- barrido se atrasa dos días, el asiento igual cae en la semana
      -- en que el servicio se prestó.
      date_trunc('week', k.fecha_evento::timestamp)::date,
      k.cliente,
      k.fecha_evento,
      'devengado el día del evento'
    from calculadas k
    where k.monto > 0
    on conflict (reserva_id, concepto) where reserva_id is not null
    do nothing
    returning
      cobros_plataforma.id,
      cobros_plataforma.reserva_id,
      cobros_plataforma.rancho_id,
      cobros_plataforma.cliente,
      cobros_plataforma.fecha_evento,
      cobros_plataforma.personas,
      cobros_plataforma.tarifa,
      cobros_plataforma.modelo,
      cobros_plataforma.monto,
      cobros_plataforma.semana
  )
  select
    i.id,
    i.reserva_id,
    i.rancho_id,
    ra.nombre,
    i.cliente,
    i.fecha_evento,
    i.personas,
    i.tarifa,
    i.modelo,
    i.monto,
    i.semana
  from insertadas i
  left join public.ranchos ra on ra.id = i.rancho_id
  order by ra.nombre nulls last, i.fecha_evento;
end;
$$;

comment on function public.devengar_cobros_del_dia(integer) is
  'Anota en cobros_plataforma la comisión de las reservas cuyo evento ya ' ||
  'ocurrió (según la zona horaria de cada negocio) y que aún no la tienen. ' ||
  'Idempotente por el índice único (reserva_id, concepto). La llama el cron ' ||
  'diario /api/cobro-plataforma.';

-- Mueve plata: solo la llave de servicio (el cron) puede ejecutarla.
-- Ni el navegador anónimo, ni un usuario con sesión, ni el dueño de un
-- negocio. `security definer` sin este revoke sería un agujero.
revoke all on function public.devengar_cobros_del_dia(integer) from public;
revoke all on function public.devengar_cobros_del_dia(integer) from anon;
revoke all on function public.devengar_cobros_del_dia(integer) from authenticated;
grant execute on function public.devengar_cobros_del_dia(integer) to service_role;


-- ------------------------------------------------------------
-- 4. Comprobación rápida (opcional, no escribe nada)
--
-- Qué se devengaría si el barrido corriera AHORA MISMO. Es la misma
-- consulta de arriba sin el insert.
-- ------------------------------------------------------------
-- with zonas as (select name from pg_timezone_names)
-- select ra.nombre, res.id, res.fecha, res.estado,
--        (now() at time zone coalesce(z.name, 'America/Costa_Rica'))::date as hoy_alla
-- from public.reservas res
-- join public.ranchos ra on ra.id = res.rancho_id
-- left join zonas z on z.name = ra.zona_horaria
-- where res.estado in ('confirmada', 'cumplida', 'no_asistio')
--   and res.fecha <= (now() at time zone coalesce(z.name, 'America/Costa_Rica'))::date
--   and res.fecha >  (now() at time zone coalesce(z.name, 'America/Costa_Rica'))::date - 7
--   and not exists (
--     select 1 from public.cobros_plataforma c
--     where c.reserva_id = res.id and c.concepto = 'reserva'
--   );
