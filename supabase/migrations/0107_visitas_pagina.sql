-- ============================================================
-- CONTADOR DE VISITAS POR PÁGINA DE NEGOCIO
--
-- "12 personas visitaron este sitio hoy" arriba de la página de cada
-- negocio: prueba social real, no un número inventado.
--
-- CÓMO SE CUENTA UNA PERSONA: una fila por (negocio, día, visitante).
-- `visitante` es un HASH que arma el servidor con la IP, el navegador,
-- el día y una sal secreta — la IP en claro NUNCA se guarda, y como el
-- hash cambia cada día tampoco se puede seguir a nadie entre días. El
-- índice único hace el resto: entrar diez veces el mismo día cuenta
-- UNA vez.
--
-- POR QUÉ NO SE CUENTA EN EL SERVIDOR AL RENDERIZAR: ahí también
-- contarían los robots de Google y las precargas del navegador, y el
-- número se inflaría solo. Se cuenta con un aviso que manda el
-- navegador después de cargar — eso ya deja afuera a casi todo lo que
-- no es una persona.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

create table if not exists public.visitas_pagina (
  rancho_id uuid not null references public.ranchos(id) on delete cascade,
  dia date not null,
  -- Hash de 64 caracteres. Nunca la IP, nunca el user-agent en claro.
  visitante text not null,
  created_at timestamptz not null default now(),
  primary key (rancho_id, dia, visitante)
);

create index if not exists visitas_pagina_rancho_dia_idx
  on public.visitas_pagina (rancho_id, dia desc);

alter table public.visitas_pagina enable row level security;
-- Sin policies: nadie lee las filas sueltas (serían un registro de
-- quién entró a qué). Se leen solo por el resumen de abajo, que
-- devuelve conteos y corre con permisos propios.

-- ------------------------------------------------------------
-- Anotar una visita
-- ------------------------------------------------------------
create or replace function public.registrar_visita(
  p_rancho uuid,
  p_visitante text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_rancho is null or coalesce(trim(p_visitante), '') = '' then
    return;
  end if;

  insert into public.visitas_pagina (rancho_id, dia, visitante)
  values (
    p_rancho,
    (now() at time zone 'America/Costa_Rica')::date,
    left(p_visitante, 64)
  )
  on conflict do nothing;
end;
$$;

grant execute on function public.registrar_visita(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- El resumen que se muestra
-- ------------------------------------------------------------
create or replace function public.visitas_pagina_resumen(p_rancho uuid)
returns table (hoy integer, semana integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (
      where v.dia = (now() at time zone 'America/Costa_Rica')::date
    )::int as hoy,
    count(*)::int as semana
  from public.visitas_pagina v
  where v.rancho_id = p_rancho
    and v.dia > (now() at time zone 'America/Costa_Rica')::date - 7;
$$;

grant execute on function public.visitas_pagina_resumen(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Limpieza: 90 días es más que suficiente para "hoy" y "esta semana",
-- y evita que la tabla crezca para siempre. La llama el cron diario.
-- ------------------------------------------------------------
create or replace function public.limpiar_visitas_viejas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas integer;
begin
  delete from public.visitas_pagina
  where dia < (now() at time zone 'America/Costa_Rica')::date - 90;
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;
