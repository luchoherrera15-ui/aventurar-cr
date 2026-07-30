-- ============================================================
-- BOOKEA — Reseñas de citas cumplidas + feed de calendario
--
-- 1. La política de reseñas (0053) exigía estado 'confirmada', pero
--    desde la 0061 las citas atendidas pasan a 'cumplida': quedaban
--    sin poder reseñarse nunca. Ahora una cita cumplida se puede
--    calificar de una vez (ya ocurrió — la marcó el negocio), y las
--    reservas confirmadas siguen esperando al día siguiente.
--
-- 2. `calendario_tokens`: el token inadivinable del feed .ics de cada
--    negocio (/api/calendario/feed/{token}), para suscribir la agenda
--    en Google Calendar / Apple Calendar. Tabla aparte a propósito:
--    `ranchos` es legible por cualquiera (directorio público) y un
--    secreto no puede vivir en una tabla pública. Solo el dueño (o un
--    admin) ve y crea su token.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- 1. Reseñas: confirmadas desde el día siguiente, cumplidas de una vez.
drop policy if exists "El cliente reseña su propia reserva confirmada" on resenas;
create policy "El cliente reseña su propia reserva confirmada" on resenas
  for insert to authenticated
  with check (
    cliente_id = auth.uid()
    and exists (
      select 1 from reservas r
      where r.id = reserva_id
        and r.cliente_id = auth.uid()
        and r.rancho_id = resenas.rancho_id
        and (
          -- El evento confirmado se califica desde el día siguiente.
          (r.estado = 'confirmada'
            and r.fecha < (now() at time zone 'America/Costa_Rica')::date)
          -- La cita cumplida ya ocurrió: se califica de una vez.
          or r.estado = 'cumplida'
        )
    )
  );

-- 2. El token del feed de calendario, uno por negocio.
create table if not exists calendario_tokens (
  rancho_id uuid primary key references ranchos(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table calendario_tokens enable row level security;

drop policy if exists "El dueño ve su token de calendario" on calendario_tokens;
create policy "El dueño ve su token de calendario" on calendario_tokens
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

drop policy if exists "El dueño crea su token de calendario" on calendario_tokens;
create policy "El dueño crea su token de calendario" on calendario_tokens
  for insert to authenticated
  with check (
    rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

grant select, insert on calendario_tokens to authenticated;
grant select on calendario_tokens to service_role;

notify pgrst, 'reload schema';
