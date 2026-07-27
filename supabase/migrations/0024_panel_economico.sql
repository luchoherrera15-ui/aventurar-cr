-- ============================================================
-- AVENTUREA CR — Panel económico del propietario
--
-- El negocio cobra en dos tiempos: un adelanto al reservar y el
-- saldo el día del evento. Para poder decir "esta semana entraron
-- ₡X" hacía falta saber CUÁNDO entró cada plata, no solo si
-- entró: `deposito_validado` y `evento_pagado` son sí/no sin
-- fecha, y agrupar por la fecha del evento no es lo mismo que
-- agrupar por la fecha de cobro.
--
-- También hacía falta el monto realmente cobrado: `monto_total`
-- es la cotización al reservar, y el día del evento cambian cosas
-- (más invitados, horas extra). Sin eso los números se despegan
-- de la caja real.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Fechas de cobro y monto final
-- ------------------------------------------------------------

alter table reservas add column if not exists deposito_pagado_en timestamptz;
alter table reservas add column if not exists saldo_pagado_en timestamptz;
alter table reservas add column if not exists monto_cobrado_final numeric;

-- Las que ya estaban marcadas como cobradas quedan con la fecha más
-- razonable que tenemos: el adelanto, cuando se creó la reserva; el
-- saldo, el día del evento. Es una aproximación de una sola vez para
-- que el histórico no arranque vacío.
update reservas
set deposito_pagado_en = created_at
where deposito_validado and deposito_pagado_en is null;

update reservas
set saldo_pagado_en = fecha::timestamptz
where evento_pagado and saldo_pagado_en is null;

create index if not exists reservas_cobros_idx
  on reservas (rancho_id, fecha);

-- ------------------------------------------------------------
-- 2. Gastos del negocio
--
-- Sin esto el panel diría cuánto facturó, no cuánto ganó.
-- ------------------------------------------------------------

create table if not exists gastos_rancho (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  fecha date not null,
  concepto text not null,
  categoria text not null default 'otro'
    check (categoria in (
      'personal', 'insumos', 'mantenimiento',
      'servicios', 'publicidad', 'otro'
    )),
  monto numeric not null check (monto >= 0),
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists gastos_rancho_fecha_idx
  on gastos_rancho (rancho_id, fecha);

alter table gastos_rancho enable row level security;
grant select, insert, update, delete on gastos_rancho to authenticated;

-- Los gastos son privados: cada dueño ve y toca únicamente los suyos.
drop policy if exists "Cada dueño administra sus gastos" on gastos_rancho;
create policy "Cada dueño administra sus gastos" on gastos_rancho
  for all to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  )
  with check (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

notify pgrst, 'reload schema';
