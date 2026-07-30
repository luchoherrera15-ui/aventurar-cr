-- ============================================================
-- BOOKEA — Invitaciones digitales (0066)
--
-- Producto que vende Bookea directamente: el equipo crea la
-- invitación desde el panel admin y la asigna a un cliente; el
-- cliente comparte el link público (/i/{slug}) y los invitados
-- confirman asistencia ahí mismo, sin cuenta.
--
--  - `html_personalizado`: si viene, la página pública lo renderiza
--    tal cual dentro del lienzo (diseños a la medida).
--  - Estados: borrador → activa (visible al público) → archivada.
--  - Solo el service role escribe en `invitaciones` (el panel admin
--    usa el cliente admin del servidor); no hay políticas de
--    insert/update para usuarios.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

create table if not exists invitaciones (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  cliente_id uuid references auth.users(id) on delete set null,
  titulo text not null,
  anfitriones text,
  mensaje text,
  fecha_evento date not null,
  hora text,
  lugar_nombre text,
  direccion text,
  maps_url text,
  portada_url text,
  html_personalizado text,
  tema text not null default 'clasico',
  estado text not null default 'activa'
    check (estado in ('borrador', 'activa', 'archivada')),
  created_at timestamptz not null default now()
);

create index if not exists invitaciones_cliente_idx
  on invitaciones (cliente_id, created_at desc);

create table if not exists invitacion_rsvp (
  id uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references invitaciones(id) on delete cascade,
  nombre text not null,
  acompanantes int not null default 0 check (acompanantes >= 0),
  asistira boolean not null,
  mensaje text,
  created_at timestamptz not null default now()
);

create index if not exists invitacion_rsvp_invitacion_idx
  on invitacion_rsvp (invitacion_id, created_at desc);

alter table invitaciones enable row level security;
alter table invitacion_rsvp enable row level security;

-- La invitación activa es pública: cualquiera con el link la ve.
drop policy if exists "Cualquiera ve las invitaciones activas" on invitaciones;
create policy "Cualquiera ve las invitaciones activas" on invitaciones
  for select to anon, authenticated
  using (estado = 'activa');

-- El cliente dueño ve las suyas en /cuenta (aunque estén archivadas).
drop policy if exists "El cliente ve sus invitaciones" on invitaciones;
create policy "El cliente ve sus invitaciones" on invitaciones
  for select to authenticated
  using (cliente_id = auth.uid());

-- Los invitados confirman sin cuenta, pero solo en invitaciones activas.
drop policy if exists "Cualquiera confirma asistencia" on invitacion_rsvp;
create policy "Cualquiera confirma asistencia" on invitacion_rsvp
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from invitaciones i
      where i.id = invitacion_id and i.estado = 'activa'
    )
  );

-- El dueño de la invitación (o un admin) ve quién confirmó.
drop policy if exists "El dueño ve las confirmaciones" on invitacion_rsvp;
create policy "El dueño ve las confirmaciones" on invitacion_rsvp
  for select to authenticated
  using (
    exists (
      select 1 from invitaciones i
      where i.id = invitacion_id
        and (i.cliente_id = auth.uid() or is_admin())
    )
  );

grant select on invitaciones to anon, authenticated;
grant insert on invitacion_rsvp to anon, authenticated;
grant select on invitacion_rsvp to authenticated;

-- ------------------------------------------------------------
-- Demo para la landing de venta (/invitaciones → /i/demo-invitacion).
-- Sin cliente asignado: es material de muestra, no datos reales.
-- ------------------------------------------------------------
insert into invitaciones (
  slug, titulo, anfitriones, mensaje, fecha_evento, hora,
  lugar_nombre, direccion, estado
)
values (
  'demo-invitacion',
  'La boda de Sofía & Andrés',
  'Familias Jiménez Mora y Vargas Solano',
  'Nos hace muchísima ilusión celebrar este día con las personas que más queremos. ¡Esperamos contar con vos!',
  '2026-12-12',
  '4:00 p. m.',
  'Hacienda Los Sueños',
  'San Rafael de Escazú, 800 m oeste del Vivero Exótica',
  'activa'
)
on conflict (slug) do nothing;
