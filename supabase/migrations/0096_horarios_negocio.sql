-- ============================================================
-- BOOKEA — Horarios del negocio con precios por día (0096)
-- ============================================================
-- Extensión del sistema de horarios para soportar precios
-- distintos por día de semana (weekday vs weekend, por ejemplo).
--
-- Los horarios del negocio viven en ranchos.detalles.horario_citas;
-- esta tabla complementa eso con precios opcionales por día.
-- Si no hay fila para un día, se usa el precio base del catálogo.
-- ============================================================

create table if not exists horarios_negocio (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- 0 = domingo … 6 = sábado
  dow smallint not null check (dow between 0 and 6),
  -- Horarios (heredan de detalles.horario_citas si no están acá)
  abre time,
  cierra time,
  -- Precio especial para este día (en colones)
  precio_especial numeric(12, 2),
  -- Modalidad de precio opcional por día (rango_personas, hora, fijo)
  modalidad text check (modalidad is null or modalidad in ('rango_personas', 'hora', 'fijo')),
  -- Precio por hora si modalidad = 'hora'
  precio_hora numeric(12, 2),
  -- Precio fijo si modalidad = 'fijo'
  precio_fijo numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rancho_id, dow)
);

create index if not exists horarios_negocio_rancho_idx
  on horarios_negocio (rancho_id, dow);

alter table horarios_negocio enable row level security;

-- Solo el dueño del negocio (o un admin) puede leer/escribir
drop policy if exists "El dueño administra sus horarios de negocio" on horarios_negocio;
create policy "El dueño administra sus horarios de negocio" on horarios_negocio
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

grant select, insert, update, delete on horarios_negocio to authenticated;

notify pgrst, 'reload schema';
