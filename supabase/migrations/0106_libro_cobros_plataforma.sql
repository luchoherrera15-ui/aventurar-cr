-- ============================================================
-- EL LIBRO DE COBROS DE LA PLATAFORMA
--
-- Hasta hoy lo que Bookea gana era una PROYECCIÓN que se recalculaba
-- cada vez que se abría /admin/finanzas: si mañana cambiaba la tarifa,
-- cambiaba también lo que "se había ganado" el mes pasado. Eso no es
-- una cuenta por cobrar, es una simulación.
--
-- Acá cada reserva confirmada deja una FILA con el monto CONGELADO al
-- momento de confirmarse. Esa fila se cobra, se marca pagada y queda
-- en el histórico. La tarifa puede cambiar mañana: lo ya devengado no
-- se mueve.
--
-- REGLAS (decididas por el dueño):
--  1. El cobro se anota cuando la reserva se CONFIRMA. Una solicitud
--     en aprobación todavía no debe nada; si la rechazan, nunca
--     existió.
--  2. Si una reserva confirmada se cancela después, su cobro se anula
--     y en su lugar entra uno del 10 % DEL DEPÓSITO — el negocio
--     retuvo ese adelanto, así que la plataforma cobra su parte. Si el
--     cobro original ya se había pagado, no se toca nada.
--  3. La semana de corte va de LUNES a DOMINGO (date_trunc('week')
--     en Postgres devuelve lunes), en hora de Costa Rica.
--
-- POR QUÉ UN TRIGGER Y NO CÓDIGO: una reserva se confirma desde el
-- panel del dueño, desde la agenda, desde citas, desde la importación
-- de calendarios y desde la app. Poner el asiento en cada uno de esos
-- caminos es garantizar que algún día se escape uno y la plata no se
-- cobre. En la base es un solo lugar y no se puede saltar.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

create table if not exists public.cobros_plataforma (
  id uuid primary key default gen_random_uuid(),

  -- `set null` y no `cascade`: si algún día se borra una reserva, el
  -- cobro ya devengado NO puede desaparecer del histórico contable.
  -- Por eso también se copian el cliente y la fecha del evento.
  reserva_id uuid references public.reservas(id) on delete set null,
  rancho_id uuid references public.ranchos(id) on delete set null,

  concepto text not null check (concepto in ('reserva', 'cancelacion')),

  -- Cómo salió el número, congelado: si mañana sube la tarifa, esta
  -- fila sigue diciendo lo que se devengó ese día.
  personas integer not null default 1 check (personas >= 0),
  tarifa numeric not null default 0 check (tarifa >= 0),
  modelo text not null,
  monto numeric not null check (monto >= 0),

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagado', 'anulado')),

  -- El LUNES de la semana a la que pertenece: es la unidad de cobro.
  semana date not null,

  -- Copias para que el histórico se lea solo, sin ir a `reservas`.
  cliente text,
  fecha_evento date,

  devengado_en timestamptz not null default now(),
  pagado_en timestamptz,
  notas text,
  created_at timestamptz not null default now()
);

-- Una reserva deja como mucho UN cobro de cada concepto. Es lo que
-- hace al trigger idempotente: reconfirmar no cobra dos veces.
create unique index if not exists cobros_plataforma_reserva_concepto_idx
  on public.cobros_plataforma (reserva_id, concepto)
  where reserva_id is not null;

create index if not exists cobros_plataforma_semana_idx
  on public.cobros_plataforma (semana, estado);
create index if not exists cobros_plataforma_rancho_idx
  on public.cobros_plataforma (rancho_id, estado);

alter table public.cobros_plataforma enable row level security;

drop policy if exists "El admin ve los cobros" on public.cobros_plataforma;
create policy "El admin ve los cobros" on public.cobros_plataforma
  for select to authenticated using (is_admin());

drop policy if exists "El admin marca cobros pagados" on public.cobros_plataforma;
create policy "El admin marca cobros pagados" on public.cobros_plataforma
  for update to authenticated using (is_admin()) with check (is_admin());

grant select, update on public.cobros_plataforma to authenticated;

-- ------------------------------------------------------------
-- El asiento automático
-- ------------------------------------------------------------

create or replace function public.registrar_cobro_plataforma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modelo   text;
  v_valor    numeric;
  v_personas integer;
  v_monto    numeric;
  v_semana   date;
  v_deposito numeric;
begin
  -- Solo interesa el CAMBIO de estado (o el alta ya confirmada).
  if tg_op = 'UPDATE' and old.estado is not distinct from new.estado then
    return new;
  end if;
  if new.rancho_id is null then
    return new;
  end if;

  -- La semana de corte: lunes, en hora de Costa Rica.
  v_semana := date_trunc(
    'week', (now() at time zone 'America/Costa_Rica')
  )::date;

  -- La tarifa que le aplica al negocio: la suya, o el default global.
  select cn.modelo, cn.valor into v_modelo, v_valor
  from public.cobro_negocio cn
  where cn.rancho_id = new.rancho_id;

  if v_modelo is null then
    select 'comision_por_persona', coalesce(cp.comision_por_persona, 0)
    into v_modelo, v_valor
    from public.configuracion_plataforma cp
    limit 1;
  end if;

  v_modelo := coalesce(v_modelo, 'comision_por_persona');
  v_valor := coalesce(v_valor, 0);

  -- ---------- Se confirma: nace el cobro ----------
  if new.estado = 'confirmada' then
    -- Membresía y gratis no cobran por reserva.
    if v_modelo in ('membresia_mensual', 'gratis') then
      return new;
    end if;

    -- Mínimo una persona: una cita sin invitados es UNA persona
    -- atendida, no cero (misma convención que personasDeReserva).
    v_personas := greatest(1, coalesce(new.invitados, 1));

    v_monto := case v_modelo
      when 'comision_por_persona'  then v_personas * v_valor
      when 'comision_fija_reserva' then v_valor
      when 'comision_porcentaje'   then
        round(coalesce(new.monto_cobrado_final, new.monto_total, 0) * v_valor / 100)
      else 0
    end;

    if v_monto <= 0 then
      return new;
    end if;

    insert into public.cobros_plataforma (
      reserva_id, rancho_id, concepto, personas, tarifa, modelo, monto,
      semana, cliente, fecha_evento
    ) values (
      new.id, new.rancho_id, 'reserva', v_personas, v_valor, v_modelo, v_monto,
      v_semana, new.nombre, new.fecha
    )
    on conflict (reserva_id, concepto) where reserva_id is not null
    do nothing;

  -- ---------- Se cae: se anula y entra el 10 % del depósito ----------
  elsif new.estado in ('cancelada', 'rechazada') then
    -- Lo ya PAGADO no se toca nunca: esa plata ya se cobró.
    update public.cobros_plataforma
    set estado = 'anulado',
        notas = trim(both ' ·' from coalesce(notas, '') || ' · anulado al cancelarse la reserva')
    where reserva_id = new.id
      and concepto = 'reserva'
      and estado = 'pendiente';

    v_deposito := coalesce(new.deposito_monto, 0);

    -- El 10 % solo tiene sentido si hubo depósito y si el cobro
    -- original NO se había cobrado ya (si se cobró, la plataforma ya
    -- recibió lo suyo y no corresponde sumarle nada).
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
