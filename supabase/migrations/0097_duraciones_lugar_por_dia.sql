-- ============================================================
-- BOOKEA — Duraciones máximas por día para lugares (0097)
-- ============================================================
-- Permite configurar horas máximas disponibles por día de la semana
-- para cada lugar/bloque de horario.
--
-- Estructura: cada rancho puede tener duraciones diferentes para:
-- - Lunes, Martes, Miércoles, Jueves (configurables individualmente)
-- - Viernes, Sábado, Domingo (compartida)
--
-- Las horas adicionales se venden a ₡20,000 cada una.
-- ============================================================

create table if not exists duraciones_lugar_por_dia (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- 0 = domingo … 6 = sábado (pero V/S/D comparten configuración)
  -- Si dow = 5,6,0 indica que aplica para Viernes, Sábado, Domingo
  dow_grupo smallint not null check (dow_grupo in (1, 2, 3, 4, 5)),
  -- Duración máxima en horas para este día/grupo
  duracion_maxima_horas numeric(5, 2) not null check (duracion_maxima_horas > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rancho_id, dow_grupo)
);

-- dow_grupo mapping:
-- 1 = Lunes
-- 2 = Martes
-- 3 = Miércoles
-- 4 = Jueves
-- 5 = Viernes/Sábado/Domingo (compartida)

create index if not exists duraciones_lugar_por_dia_rancho_idx
  on duraciones_lugar_por_dia (rancho_id, dow_grupo);

alter table duraciones_lugar_por_dia enable row level security;

-- Solo el dueño (o admin) puede leer/escribir
drop policy if exists "El dueño administra duraciones de su lugar" on duraciones_lugar_por_dia;
create policy "El dueño administra duraciones de su lugar" on duraciones_lugar_por_dia
  for all to authenticated
  using (
    exists (
      select 1 from ranchos r
      where r.id = rancho_id and (r.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from ranchos r
      where r.id = rancho_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

grant select, insert, update, delete on duraciones_lugar_por_dia to authenticated;

-- Costo fijo de horas adicionales (₡20,000)
create or replace function costo_hora_adicional()
returns numeric
language sql
immutable
as $$
  select 20000::numeric
$$;

notify pgrst, 'reload schema';
