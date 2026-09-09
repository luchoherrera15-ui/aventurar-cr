-- 0240 · Reuniones de ayuda para armar la tarjeta de Lealtad
--
-- Pedido del dueño (8 sep 2026): en bookea.lat/lealtad, antes de elegir
-- el plan, dos caminos: «¿Querés crear tu tarjeta vos mismo?» o
-- «¿Necesitás ayuda para configurar el sistema?». El segundo abre una
-- agenda chica (día y hora) para PROGRAMAR una reunión; Bookea la ve en
-- el admin y recibe un correo al instante.
--
-- Una tabla propia y no un hilo de chat: la reunión tiene fecha, hora y
-- estado, que es lo que el admin necesita para verla como calendario.
-- Escribe SOLO el servidor (service_role, desde la server action que
-- valida todo); el admin la lee y cambia el estado con su sesión
-- (public.is_admin(), la misma función de la 0182).

create table if not exists public.reuniones_lealtad (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 2 and 80),
  correo text not null check (position('@' in correo) > 1 and char_length(correo) <= 160),
  telefono text check (telefono is null or char_length(telefono) <= 20),
  negocio text check (negocio is null or char_length(negocio) <= 80),
  fecha date not null,
  hora time not null,
  notas text check (notas is null or char_length(notas) <= 500),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmada', 'hecha', 'cancelada')),
  origen text not null default 'lealtad-alta',
  user_id uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now()
);

comment on table public.reuniones_lealtad is 'Reuniones pedidas desde el alta de Lealtad («necesito ayuda»). Las ve el admin.';

-- Un horario no se da dos veces mientras la reunión siga viva.
create unique index if not exists reuniones_lealtad_horario_unico
  on public.reuniones_lealtad (fecha, hora)
  where estado in ('pendiente', 'confirmada');

create index if not exists reuniones_lealtad_fecha_idx on public.reuniones_lealtad (fecha, hora);

alter table public.reuniones_lealtad enable row level security;

create policy "Bookea lee las reuniones" on public.reuniones_lealtad
  for select to authenticated
  using (public.is_admin());

create policy "Bookea cambia el estado" on public.reuniones_lealtad
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.reuniones_lealtad to authenticated;
grant update (estado) on public.reuniones_lealtad to authenticated;
grant all on public.reuniones_lealtad to service_role;
