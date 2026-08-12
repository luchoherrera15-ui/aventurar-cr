
-- ─────────────────────────────────────────────────────────────────────
-- 0126: solicitudes del plan de lealtad.
--
-- El programa ya NO se lo crea el negocio solo: elige un paquete en
-- /lealtad/planes, deja una solicitud, y Bookea lo genera desde el
-- panel administrativo "para que se haga bien". Esta tabla es esa cola.
--
-- El correo de aviso a los administradores sale del servidor al crear
-- la fila; la fila es la fuente de verdad (si el correo se pierde, la
-- solicitud sigue visible en /admin/complementos).
-- ─────────────────────────────────────────────────────────────────────

create table if not exists solicitudes_lealtad (
  id             uuid primary key default gen_random_uuid(),
  rancho_id      uuid not null references ranchos(id) on delete cascade,
  solicitante_id uuid not null references auth.users(id) on delete cascade,

  -- El paquete pedido. Mismos ids que src/lib/lealtad/planes.ts (0124).
  plan     text not null check (plan in ('basico', 'estandar', 'enterprise')),

  -- Para contactar al que pide sin ir a buscar el perfil.
  telefono text check (telefono is null or char_length(telefono) <= 30),
  mensaje  text check (mensaje is null or char_length(mensaje) <= 500),

  estado       text not null default 'pendiente'
               check (estado in ('pendiente', 'atendida', 'rechazada')),
  atendida_por uuid references auth.users(id) on delete set null,
  atendida_en  timestamptz,

  created_at timestamptz not null default now()
);

comment on table solicitudes_lealtad is
  'Cola de solicitudes del plan de lealtad: el negocio pide, Bookea activa desde /admin/complementos.';

create index if not exists solicitudes_lealtad_rancho_idx
  on solicitudes_lealtad (rancho_id);

-- UNA solicitud pendiente por negocio: el botón repetido o el doble
-- clic no llenan la cola (ni la casilla de correo) de duplicados.
create unique index if not exists solicitudes_lealtad_pendiente_unq
  on solicitudes_lealtad (rancho_id)
  where estado = 'pendiente';

alter table solicitudes_lealtad enable row level security;

-- Quien gestiona el negocio ve sus solicitudes (para pintar "en
-- revisión"); el admin de la plataforma las ve todas.
drop policy if exists "Ver las solicitudes del negocio" on solicitudes_lealtad;
create policy "Ver las solicitudes del negocio" on solicitudes_lealtad
  for select using (gestiona_rancho(rancho_id) or is_admin());

-- Solicita quien gestiona el negocio, siempre a su propio nombre y
-- siempre naciendo pendiente: el estado lo mueve solo Bookea.
drop policy if exists "Pedir el plan del propio negocio" on solicitudes_lealtad;
create policy "Pedir el plan del propio negocio" on solicitudes_lealtad
  for insert with check (
    gestiona_rancho(rancho_id)
    and solicitante_id = auth.uid()
    and estado = 'pendiente'
  );

-- Atender (aprobar/rechazar) es del admin de la plataforma.
drop policy if exists "Solo Bookea atiende solicitudes" on solicitudes_lealtad;
create policy "Solo Bookea atiende solicitudes" on solicitudes_lealtad
  for update using (is_admin()) with check (is_admin());

-- Sin grants la RLS más perfecta da "permission denied" (lección 0119).
-- El UPDATE es SOLO de las columnas de atención: ni un admin reescribe
-- por esta vía qué plan se pidió ni quién lo pidió — eso es el registro.
grant select, insert on solicitudes_lealtad to authenticated;
grant update (estado, atendida_por, atendida_en) on solicitudes_lealtad to authenticated;
grant all on solicitudes_lealtad to service_role;
