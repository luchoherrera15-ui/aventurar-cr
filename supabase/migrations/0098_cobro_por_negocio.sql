-- ============================================================
-- Tarifa de plataforma POR NEGOCIO — lo que Bookea le cobra (o le
-- cobraría) a cada negocio, configurable desde /admin/finanzas.
--
-- Sin fila => aplica el default global de siempre
-- (configuracion_plataforma.comision_por_persona, migración 0009).
-- Mientras no exista pasarela de pago, esto es CONFIGURACIÓN +
-- PROYECCIÓN, no un cobro real.
--
-- Tabla nueva a propósito (no columnas en `ranchos`): la tarifa es
-- dato interno del admin y `ranchos` es legible públicamente y
-- compartida con la app móvil. Mismo criterio que addons_negocio
-- (0077): RLS prendida sin policies => solo service_role lee/escribe.
-- Es seguro correr esta migración varias veces.
-- ============================================================

create table if not exists public.cobro_negocio (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references public.ranchos(id) on delete cascade,
  modelo text not null check (modelo in (
    'comision_por_persona',   -- valor = colones por persona reservada
    'comision_porcentaje',    -- valor = % sobre el total del evento
    'comision_fija_reserva',  -- valor = colones fijos por reserva
    'membresia_mensual',      -- valor = colones fijos por mes calendario
    'gratis'                  -- explícitamente sin cobro (distinto de "sin fila")
  )),
  valor numeric not null default 0 check (valor >= 0),
  -- Un porcentaje nunca pasa de 100.
  constraint cobro_pct_valido check (modelo <> 'comision_porcentaje' or valor <= 100),
  vigente_desde date not null default current_date,
  notas text,
  actualizado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (rancho_id)
);

alter table public.cobro_negocio enable row level security;
-- Sin policies a propósito: el dueño del negocio NO ve su tarifa por
-- ahora. Si algún día se le muestra, se agrega una policy de SELECT
-- como la de addons_negocio (0077).
