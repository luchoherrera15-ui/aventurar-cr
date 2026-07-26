-- ============================================================
-- AVENTUREA CR — Códigos de descuento y promociones automáticas
-- por día de la semana (visibles en el sitio para atraer clientes).
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Códigos de descuento (los ingresa el cliente al reservar)
-- ------------------------------------------------------------

create table if not exists codigos_descuento (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  codigo text not null,
  tipo text not null default 'porcentaje' check (tipo in ('porcentaje', 'monto_fijo')),
  valor numeric not null check (valor > 0),
  activo boolean not null default true,
  usos_maximos integer,
  usos_actuales integer not null default 0,
  valido_hasta date,
  created_at timestamptz not null default now(),
  unique (rancho_id, codigo)
);

alter table codigos_descuento enable row level security;

drop policy if exists "El dueño administra sus códigos" on codigos_descuento;
create policy "El dueño administra sus códigos" on codigos_descuento
  for all to authenticated
  using (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()))
  with check (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()));

-- A propósito no hay política de lectura pública: los códigos no se
-- listan, solo se validan uno por uno con la función de abajo.
grant select, insert, update, delete on codigos_descuento to authenticated;

-- Revisa un código sin gastarlo (para mostrar el descuento mientras
-- el cliente todavía está llenando el formulario).
create or replace function public.verificar_codigo_descuento(p_rancho_id uuid, p_codigo text)
returns table(tipo text, valor numeric)
language sql
stable
security definer
set search_path = public
as $$
  select c.tipo, c.valor
  from codigos_descuento c
  where c.rancho_id = p_rancho_id
    and upper(c.codigo) = upper(p_codigo)
    and c.activo = true
    and (c.valido_hasta is null or c.valido_hasta >= current_date)
    and (c.usos_maximos is null or c.usos_actuales < c.usos_maximos)
  limit 1;
$$;

grant execute on function public.verificar_codigo_descuento(uuid, text) to anon, authenticated;

-- Revisa el código Y le suma un uso — se llama una sola vez, cuando
-- la reserva se envía de verdad (no mientras el cliente solo escribe).
create or replace function public.redimir_codigo_descuento(p_rancho_id uuid, p_codigo text)
returns table(tipo text, valor numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tipo text;
  v_valor numeric;
begin
  select c.id, c.tipo, c.valor into v_id, v_tipo, v_valor
  from codigos_descuento c
  where c.rancho_id = p_rancho_id
    and upper(c.codigo) = upper(p_codigo)
    and c.activo = true
    and (c.valido_hasta is null or c.valido_hasta >= current_date)
    and (c.usos_maximos is null or c.usos_actuales < c.usos_maximos)
  limit 1;

  if v_id is null then
    return;
  end if;

  update codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_id;
  tipo := v_tipo;
  valor := v_valor;
  return next;
end;
$$;

grant execute on function public.redimir_codigo_descuento(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. Promociones automáticas por día de la semana (públicas, para
-- que se vean en el sitio y atraigan reservas)
-- ------------------------------------------------------------

create table if not exists promociones_dia (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  dias_semana integer[] not null,
  porcentaje_descuento numeric not null check (porcentaje_descuento > 0 and porcentaje_descuento <= 100),
  etiqueta text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table promociones_dia enable row level security;

drop policy if exists "El dueño administra sus promociones" on promociones_dia;
create policy "El dueño administra sus promociones" on promociones_dia
  for all to authenticated
  using (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()))
  with check (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()));

drop policy if exists "Todos ven las promociones activas" on promociones_dia;
create policy "Todos ven las promociones activas" on promociones_dia
  for select to anon, authenticated
  using (activo = true);

grant select on promociones_dia to anon;
grant select, insert, update, delete on promociones_dia to authenticated;

-- ------------------------------------------------------------
-- 3. Registrar qué código (si hubo) se usó en cada reserva
-- ------------------------------------------------------------

alter table reservas add column if not exists codigo_descuento text;
alter table reservas add column if not exists descuento_monto numeric;
