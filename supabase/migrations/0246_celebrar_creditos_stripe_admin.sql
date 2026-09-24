-- ═══════════════════════════════════════════════════════════════════
--  CELEBRAR — 0246 · compras con Stripe y el panel admin de créditos
-- ═══════════════════════════════════════════════════════════════════
--
-- El dueño (21 sep 2026) pidió conectar la pasarela de Stripe con los
-- créditos y un panel administrativo para ver TODOS los movimientos.
--
--   1. `monto_crc` en el libro: cuánta plata entró con cada compra (el
--      libro guardaba solo créditos; para el balance del negocio hace
--      falta el colón).
--   2. `celebrar_acreditar_creditos` gana `p_monto_crc` (opcional). Se
--      DROPea la firma vieja antes de crear la nueva: si convivieran dos
--      firmas, PostgREST no sabría a cuál llamar cuando faltan argumentos.
--   3. Dos RPC de administración, `security definer` con `is_admin()`
--      adentro (la misma función que protege el admin de Bookea):
--      el resumen (vendidos, regalados, consumidos, plata, saldo en
--      circulación) y el listado con el correo de cada cuenta —que vive
--      en auth.users, adonde PostgREST no llega.
--
-- Aditiva e idempotente. Solo tablas celebrar_*; no toca nada de Bookea.

alter table public.celebrar_creditos_movimientos
  add column if not exists monto_crc integer check (monto_crc is null or monto_crc >= 0);

comment on column public.celebrar_creditos_movimientos.monto_crc is
  'Colones que entraron con este movimiento (solo compras). Null en consumos, regalos y ajustes.';

-- ─────────────────────────────────────────────────────────────────────
-- Acreditar, ahora con el monto pagado
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.celebrar_acreditar_creditos(uuid, integer, text, text, text);

create or replace function public.celebrar_acreditar_creditos(
  p_owner uuid,
  p_cantidad integer,
  p_tipo text,
  p_concepto text,
  p_referencia text default null,
  p_monto_crc integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad tiene que ser positiva.' using errcode = '22023';
  end if;
  if p_tipo not in ('compra', 'regalo', 'ajuste', 'reembolso') then
    raise exception 'Tipo inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_owner) then
    raise exception 'Esa cuenta no existe.' using errcode = '22023';
  end if;
  -- La misma referencia (la sesión de Stripe) no acredita dos veces:
  -- el webhook y la vuelta del navegador pueden llegar los dos.
  if p_referencia is not null and exists (
    select 1 from public.celebrar_creditos_movimientos where referencia = p_referencia
  ) then
    return false;
  end if;
  insert into public.celebrar_creditos_movimientos (owner_id, tipo, cantidad, concepto, referencia, monto_crc)
  values (p_owner, p_tipo, p_cantidad, left(p_concepto, 200), p_referencia, p_monto_crc);
  return true;
exception
  -- Dos acreditaciones simultáneas con la misma referencia: la segunda
  -- choca contra el índice único y se reporta como «ya estaba».
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.celebrar_acreditar_creditos(uuid, integer, text, text, text, integer) from public;
grant execute on function public.celebrar_acreditar_creditos(uuid, integer, text, text, text, integer) to service_role;

-- ─────────────────────────────────────────────────────────────────────
-- El panel admin: resumen y listado
-- ─────────────────────────────────────────────────────────────────────

/** Los totales del negocio de créditos. Solo admin (Bookea `is_admin()`). */
create or replace function public.celebrar_admin_resumen_creditos()
returns table (
  vendidos integer,
  ingresos_crc bigint,
  regalados integer,
  ajustes integer,
  reembolsados integer,
  consumidos integer,
  en_circulacion integer,
  cuentas_con_saldo integer,
  compras integer
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select * from public.celebrar_creditos_movimientos where public.is_admin()
  ),
  saldos as (
    select owner_id, sum(cantidad) as saldo from m group by owner_id
  )
  select
    coalesce(sum(case when tipo = 'compra' then cantidad end), 0)::integer,
    coalesce(sum(case when tipo = 'compra' then monto_crc end), 0)::bigint,
    coalesce(sum(case when tipo = 'regalo' then cantidad end), 0)::integer,
    coalesce(sum(case when tipo = 'ajuste' then cantidad end), 0)::integer,
    coalesce(sum(case when tipo = 'reembolso' then cantidad end), 0)::integer,
    coalesce(-sum(case when tipo = 'consumo' then cantidad end), 0)::integer,
    coalesce(sum(cantidad), 0)::integer,
    (select count(*) from saldos where saldo > 0)::integer,
    coalesce(sum(case when tipo = 'compra' then 1 end), 0)::integer
  from m;
$$;

/**
 * Todos los movimientos, con el correo y el nombre de la cuenta y el
 * nombre de la celebración. Filtros opcionales por tipo y por correo.
 * Solo admin; para cualquier otra persona devuelve cero filas.
 */
create or replace function public.celebrar_admin_movimientos(
  p_limite integer default 300,
  p_tipo text default null,
  p_correo text default null
)
returns table (
  id uuid,
  owner_id uuid,
  correo text,
  nombre text,
  celebracion_id uuid,
  celebracion text,
  tipo text,
  cantidad integer,
  monto_crc integer,
  concepto text,
  referencia text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.owner_id,
    u.email::text,
    coalesce(p.nombre_publico, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    m.celebracion_id,
    c.nombre,
    m.tipo,
    m.cantidad,
    m.monto_crc,
    m.concepto,
    m.referencia,
    m.created_at
  from public.celebrar_creditos_movimientos m
  join auth.users u on u.id = m.owner_id
  left join public.celebrar_perfiles p on p.id = m.owner_id
  left join public.celebrar_celebraciones c on c.id = m.celebracion_id
  where public.is_admin()
    and (p_tipo is null or m.tipo = p_tipo)
    and (p_correo is null or u.email ilike '%' || p_correo || '%')
  order by m.created_at desc
  limit least(coalesce(p_limite, 300), 2000);
$$;

/** Para acreditar a mano desde el admin: la cuenta por su correo. Solo admin. */
create or replace function public.celebrar_admin_buscar_cuenta(p_correo text)
returns table (id uuid, correo text, nombre text, saldo integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.email::text,
    coalesce(p.nombre_publico, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    coalesce((select sum(m.cantidad) from public.celebrar_creditos_movimientos m where m.owner_id = u.id), 0)::integer
  from auth.users u
  left join public.celebrar_perfiles p on p.id = u.id
  where public.is_admin() and lower(u.email) = lower(trim(p_correo))
  limit 1;
$$;

revoke all on function public.celebrar_admin_resumen_creditos() from public;
revoke all on function public.celebrar_admin_movimientos(integer, text, text) from public;
revoke all on function public.celebrar_admin_buscar_cuenta(text) from public;
grant execute on function public.celebrar_admin_resumen_creditos() to authenticated, service_role;
grant execute on function public.celebrar_admin_movimientos(integer, text, text) to authenticated, service_role;
grant execute on function public.celebrar_admin_buscar_cuenta(text) to authenticated, service_role;

-- El admin también lee las tablas por RLS (para consultas directas).
drop policy if exists "El admin ve todos los movimientos" on public.celebrar_creditos_movimientos;
create policy "El admin ve todos los movimientos" on public.celebrar_creditos_movimientos
  for select to authenticated using (public.is_admin());
drop policy if exists "El admin ve todas las confirmaciones" on public.celebrar_confirmaciones;
create policy "El admin ve todas las confirmaciones" on public.celebrar_confirmaciones
  for select to authenticated using (public.is_admin());
