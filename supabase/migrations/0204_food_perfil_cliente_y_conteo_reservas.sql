-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — perfil del cliente (dirección/género) y conteo real
-- de reservas por negocio, para la tarjeta del directorio (0204)
--
-- ── 1. food_customer_profiles ────────────────────────────────────────
-- El perfil del CLIENTE de FOOD (dirección, género) NO va en la tabla
-- compartida `perfiles` (0008) a propósito: esa tabla es la identidad
-- de TODA la plataforma (marketplace, Lealtad, Work, admin) y estos dos
-- campos son específicos del producto FOOD — mismo criterio de
-- separación que ya sigue el resto del dominio food_* (tablas propias,
-- nunca mezcladas con `ranchos` — ver el encabezado de la 0190).
--
-- 1:1 con auth.users, no con food_businesses: es el perfil de quien
-- COME, no de quien vende. RLS: cada quien lee y escribe SOLO su
-- propia fila — nadie más necesita verla, ni siquiera el negocio.
--
-- ── 2. food_conteo_reservas(uuid) ────────────────────────────────────
-- La tarjeta del directorio quiere mostrar "cantidad de reservaciones"
-- como prueba social real — pero `food_reservations` tiene RLS que
-- solo deja ver la reserva a QUIEN LA HIZO o al negocio dueño (0190):
-- un cliente cualquiera no puede hacer `select count(*)` directo sobre
-- las reservas de otro. Esta función es la puerta angosta: devuelve
-- SOLO un número, nunca una fila, así que no hay nada que filtrar por
-- privacidad — es seguro para cualquiera, con o sin sesión.
--
-- Cuenta todo lo que NO sea 'cancelada': una reserva cancelada no es
-- prueba de que alguien de verdad fue a comer.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.food_customer_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  direccion   text,
  genero      text,
  updated_at  timestamptz not null default now()
);

alter table public.food_customer_profiles enable row level security;

drop policy if exists "El cliente ve su propio perfil de FOOD" on public.food_customer_profiles;
create policy "El cliente ve su propio perfil de FOOD" on public.food_customer_profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "El cliente crea su propio perfil de FOOD" on public.food_customer_profiles;
create policy "El cliente crea su propio perfil de FOOD" on public.food_customer_profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "El cliente edita su propio perfil de FOOD" on public.food_customer_profiles;
create policy "El cliente edita su propio perfil de FOOD" on public.food_customer_profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke all on public.food_customer_profiles from anon;
grant select, insert, update on public.food_customer_profiles to authenticated;

comment on table public.food_customer_profiles is
  'Perfil del CLIENTE de FOOD (0204) — dirección y género, aparte de `perfiles` (identidad de toda la plataforma) a propósito. 1 fila por persona, RLS solo-propia-fila.';


create or replace function public.food_conteo_reservas(p_business_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn204$
  select count(*)::integer
    from public.food_reservations
   where business_id = p_business_id
     and estado <> 'cancelada';
$fn204$;

comment on function public.food_conteo_reservas(uuid) is
  'Cuánta gente reservó de verdad en este negocio (0204) — cuenta, nunca filas: la RLS de food_reservations no deja leer reservas ajenas, así que la tarjeta del directorio pide SOLO el número por acá.';

grant execute on function public.food_conteo_reservas(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
