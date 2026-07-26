-- ============================================================
-- AVENTUREA CR — Protección contra bots/abuso en la reserva
-- temporal de 10 minutos: sin esto, alguien podría escribirle
-- directo al servidor (sin siquiera abrir la página) y tomar
-- todas las fechas disponibles una y otra vez para bloquearlas.
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- Guarda desde qué IP se creó cada hold, para poder limitar
-- cuántas fechas puede tomar a la vez la misma conexión.
alter table reservas add column if not exists creado_por_ip text;

-- Registro interno de intentos (no es visible ni editable desde
-- afuera — solo la función de abajo lo toca).
create table if not exists intentos_reserva (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists intentos_reserva_ip_creado_idx
  on intentos_reserva (ip, created_at);

alter table intentos_reserva enable row level security;
-- A propósito no se crea ninguna política: nadie (ni anon ni
-- authenticated) puede leer o escribir esta tabla directamente.

-- Cuenta los intentos recientes de una IP y registra uno nuevo.
-- Devuelve false si superó el límite (el llamador debe rechazar
-- la operación en ese caso).
create or replace function public.registrar_intento_reserva(
  p_ip text,
  p_max_intentos int,
  p_ventana_minutos int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteo int;
begin
  delete from intentos_reserva where created_at < now() - interval '1 day';

  select count(*) into v_conteo
  from intentos_reserva
  where ip = p_ip
    and created_at > now() - (p_ventana_minutos || ' minutes')::interval;

  if v_conteo >= p_max_intentos then
    return false;
  end if;

  insert into intentos_reserva (ip) values (p_ip);
  return true;
end;
$$;

grant execute on function public.registrar_intento_reserva(text, int, int)
  to anon, authenticated;
