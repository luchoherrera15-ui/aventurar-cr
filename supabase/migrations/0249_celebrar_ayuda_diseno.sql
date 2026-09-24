-- ═══════════════════════════════════════════════════════════════════
--  CELEBRAR — 0249 · «¿No estás contento con tu diseño?»
-- ═══════════════════════════════════════════════════════════════════
--
-- El dueño (22 sep 2026): una opción para que la persona le pida al
-- equipo una invitación de mejor calidad y diseño. Es un hilo corto:
-- la persona describe qué quiere mejorar y cómo contactarla; el equipo
-- lo ve en su bandeja del admin, lo atiende (por WhatsApp o correo, o
-- editando la invitación) y lo marca como atendido.
--
-- Tabla propia, como el patrón de la 0149 de Bookea (no se reusa el chat
-- general): un pedido = una fila, con estado y nota interna.
-- Aditiva e idempotente.

create table if not exists public.celebrar_ayuda_diseno (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  celebracion_id  uuid references public.celebrar_celebraciones(id) on delete set null,
  mensaje         text not null check (char_length(mensaje) between 5 and 2000),
  contacto        text check (contacto is null or char_length(contacto) <= 120),
  -- Qué le gustaría: un rediseño completo, ajustes, o que lo haga el equipo.
  alcance         text not null default 'ajustes' check (alcance in ('ajustes', 'rediseno', 'a_medida')),
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'atendida')),
  nota_admin      text,
  atendida_en     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists celebrar_ayuda_diseno_estado_idx on public.celebrar_ayuda_diseno (estado, created_at desc);

alter table public.celebrar_ayuda_diseno enable row level security;

drop policy if exists "La dueña ve y crea sus pedidos" on public.celebrar_ayuda_diseno;
create policy "La dueña ve y crea sus pedidos" on public.celebrar_ayuda_diseno
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "La dueña pide ayuda" on public.celebrar_ayuda_diseno;
create policy "La dueña pide ayuda" on public.celebrar_ayuda_diseno
  for insert to authenticated with check (owner_id = auth.uid() and estado = 'pendiente' and nota_admin is null);
drop policy if exists "El admin atiende" on public.celebrar_ayuda_diseno;
create policy "El admin atiende" on public.celebrar_ayuda_diseno
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.celebrar_ayuda_diseno from anon, authenticated;
grant select on public.celebrar_ayuda_diseno to authenticated;
grant insert (owner_id, celebracion_id, mensaje, contacto, alcance) on public.celebrar_ayuda_diseno to authenticated;
grant update (estado, nota_admin, atendida_en) on public.celebrar_ayuda_diseno to authenticated;
grant all on public.celebrar_ayuda_diseno to service_role;

/** La bandeja del admin, con el correo de la cuenta y la celebración. */
create or replace function public.celebrar_admin_ayuda_diseno()
returns table (
  id uuid, owner_id uuid, correo text, nombre text, celebracion_id uuid, celebracion text, celebracion_slug text,
  mensaje text, contacto text, alcance text, estado text, nota_admin text, atendida_en timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id, a.owner_id, u.email::text,
    coalesce(p.nombre_publico, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    a.celebracion_id, c.nombre, c.slug,
    a.mensaje, a.contacto, a.alcance, a.estado, a.nota_admin, a.atendida_en, a.created_at
  from public.celebrar_ayuda_diseno a
  join auth.users u on u.id = a.owner_id
  left join public.celebrar_perfiles p on p.id = a.owner_id
  left join public.celebrar_celebraciones c on c.id = a.celebracion_id
  where public.is_admin()
  order by (a.estado = 'pendiente') desc, a.created_at desc;
$$;
revoke all on function public.celebrar_admin_ayuda_diseno() from public;
grant execute on function public.celebrar_admin_ayuda_diseno() to authenticated, service_role;
