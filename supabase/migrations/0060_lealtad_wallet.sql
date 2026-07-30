-- ============================================================
-- BOOKEA — Programa de lealtad + pases de Wallet (0060) — FASE 1
--
-- La capa de afiliación con puntos/sellos y tarjeta digital para
-- Apple Wallet y Google Wallet. El corazón es el LEDGER
-- (transacciones_puntos): el saldo de un miembro se CALCULA sumando
-- sus transacciones — nunca hay un saldo mutable como fuente de
-- verdad (pases_wallet.saldo_cache es solo un espejo para pintar el
-- pase rápido).
--
-- Seguridad (resumen por tabla, el detalle va en cada política):
--  - Ledger y canjes: el cliente solo LEE lo suyo; escribe únicamente
--    el servidor con la service key (que salta RLS). El dueño del
--    negocio lee lo de su programa.
--  - Pases y registros de dispositivos: solo servidor — Apple habla
--    server-a-server con el auth_token del pase, el navegador nunca
--    toca estas tablas (salvo leer su propio pase).
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. programa_lealtad — la config del programa de cada negocio
-- ------------------------------------------------------------
create table if not exists programa_lealtad (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null unique references ranchos(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  -- Cuántos puntos gana una visita/cita cumplida.
  puntos_por_visita integer not null default 1 check (puntos_por_visita >= 0),
  -- Puntos por cada colón gastado (0 = el programa es solo por visitas).
  puntos_por_colon numeric not null default 0 check (puntos_por_colon >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table programa_lealtad enable row level security;

-- Lee cualquiera (el programa activo es parte de la página pública del
-- negocio); administra el dueño o un admin.
drop policy if exists "Programa activo visible para todos" on programa_lealtad;
create policy "Programa activo visible para todos" on programa_lealtad
  for select to anon, authenticated
  using (
    activo
    or exists (
      select 1 from ranchos r
      where r.id = rancho_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "El dueño administra su programa" on programa_lealtad;
create policy "El dueño administra su programa" on programa_lealtad
  for all to authenticated
  using (
    exists (
      select 1 from ranchos r
      where r.id = rancho_id and (r.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from ranchos r
      where r.id = rancho_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

grant select, insert, update, delete on programa_lealtad to authenticated;
grant select on programa_lealtad to anon;

-- ------------------------------------------------------------
-- 2. paquetes_afiliacion — los niveles/tiers de membresía
-- ------------------------------------------------------------
create table if not exists paquetes_afiliacion (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programa_lealtad(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  -- Lista de beneficios en texto plano, uno por elemento.
  beneficios text[] not null default '{}',
  -- Precio del paquete en colones (0 = gratuito).
  precio numeric not null default 0 check (precio >= 0),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists paquetes_afiliacion_programa_idx
  on paquetes_afiliacion (programa_id, orden);

alter table paquetes_afiliacion enable row level security;

-- Lee cualquiera (se muestran en la página del negocio); administra el
-- dueño del programa o un admin.
drop policy if exists "Paquetes visibles para todos" on paquetes_afiliacion;
create policy "Paquetes visibles para todos" on paquetes_afiliacion
  for select to anon, authenticated
  using (true);

drop policy if exists "El dueño administra sus paquetes" on paquetes_afiliacion;
create policy "El dueño administra sus paquetes" on paquetes_afiliacion
  for all to authenticated
  using (
    exists (
      select 1 from programa_lealtad p
      join ranchos r on r.id = p.rancho_id
      where p.id = programa_id and (r.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from programa_lealtad p
      join ranchos r on r.id = p.rancho_id
      where p.id = programa_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

grant select, insert, update, delete on paquetes_afiliacion to authenticated;
grant select on paquetes_afiliacion to anon;

-- ------------------------------------------------------------
-- 3. miembros — quién pertenece a qué programa
-- ------------------------------------------------------------
create table if not exists miembros (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programa_lealtad(id) on delete cascade,
  cliente_id uuid not null references auth.users(id) on delete cascade,
  paquete_id uuid references paquetes_afiliacion(id) on delete set null,
  estado text not null default 'activa'
    check (estado in ('activa', 'pausada', 'cancelada')),
  created_at timestamptz not null default now(),
  unique (programa_id, cliente_id)
);

create index if not exists miembros_cliente_idx on miembros (cliente_id);

alter table miembros enable row level security;

-- El cliente ve SU membresía; el dueño ve las de su programa.
drop policy if exists "Cada quien ve su membresía" on miembros;
create policy "Cada quien ve su membresía" on miembros
  for select to authenticated
  using (
    cliente_id = auth.uid()
    or exists (
      select 1 from programa_lealtad p
      join ranchos r on r.id = p.rancho_id
      where p.id = programa_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

-- Afiliarse: el cliente se registra a sí mismo en un programa activo.
-- Cambios de estado o de paquete (pagos) entran por el servidor.
drop policy if exists "El cliente se afilia a sí mismo" on miembros;
create policy "El cliente se afilia a sí mismo" on miembros
  for insert to authenticated
  with check (
    cliente_id = auth.uid()
    and exists (select 1 from programa_lealtad p where p.id = programa_id and p.activo)
  );

grant select, insert on miembros to authenticated;

-- ------------------------------------------------------------
-- 4. transacciones_puntos — EL LEDGER (la fuente de verdad)
-- ------------------------------------------------------------
create table if not exists transacciones_puntos (
  id uuid primary key default gen_random_uuid(),
  miembro_id uuid not null references miembros(id) on delete cascade,
  tipo text not null check (tipo in ('ganado', 'canjeado', 'ajuste')),
  -- Con signo: ganado > 0, canjeado < 0, ajuste cualquier valor ≠ 0.
  -- El saldo del miembro es sum(puntos) de sus filas.
  puntos integer not null check (
    (tipo = 'ganado' and puntos > 0)
    or (tipo = 'canjeado' and puntos < 0)
    or (tipo = 'ajuste' and puntos <> 0)
  ),
  motivo text not null check (char_length(motivo) <= 200),
  -- Referencia externa (ej. id de la cita cumplida) para auditar y
  -- para que el mismo evento no otorgue puntos dos veces.
  referencia text,
  created_at timestamptz not null default now()
);

create index if not exists transacciones_puntos_miembro_idx
  on transacciones_puntos (miembro_id, created_at desc);
-- El mismo evento no puede otorgar puntos dos veces.
create unique index if not exists transacciones_puntos_referencia_unica
  on transacciones_puntos (miembro_id, referencia)
  where referencia is not null;

alter table transacciones_puntos enable row level security;

-- SOLO LECTURA y solo lo propio: el cliente ve sus transacciones y el
-- dueño las de su programa. NADIE escribe desde el navegador — los
-- puntos entran únicamente por el servidor con la service key
-- (otorgarPuntos, Fase 2). Por eso no hay política de insert/update
-- y el grant es solo select.
drop policy if exists "Cada quien lee sus puntos" on transacciones_puntos;
create policy "Cada quien lee sus puntos" on transacciones_puntos
  for select to authenticated
  using (
    exists (
      select 1 from miembros m
      where m.id = miembro_id
        and (
          m.cliente_id = auth.uid()
          or exists (
            select 1 from programa_lealtad p
            join ranchos r on r.id = p.rancho_id
            where p.id = m.programa_id and (r.owner_id = auth.uid() or is_admin())
          )
        )
    )
  );

grant select on transacciones_puntos to authenticated;

-- ------------------------------------------------------------
-- 5. recompensas — el catálogo de premios canjeables
-- ------------------------------------------------------------
create table if not exists recompensas (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programa_lealtad(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 120),
  descripcion text check (descripcion is null or char_length(descripcion) <= 300),
  costo_puntos integer not null check (costo_puntos > 0),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists recompensas_programa_idx on recompensas (programa_id, orden);

alter table recompensas enable row level security;

-- Lee cualquiera; administra el dueño del programa o un admin.
drop policy if exists "Recompensas visibles para todos" on recompensas;
create policy "Recompensas visibles para todos" on recompensas
  for select to anon, authenticated
  using (true);

drop policy if exists "El dueño administra sus recompensas" on recompensas;
create policy "El dueño administra sus recompensas" on recompensas
  for all to authenticated
  using (
    exists (
      select 1 from programa_lealtad p
      join ranchos r on r.id = p.rancho_id
      where p.id = programa_id and (r.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from programa_lealtad p
      join ranchos r on r.id = p.rancho_id
      where p.id = programa_id and (r.owner_id = auth.uid() or is_admin())
    )
  );

grant select, insert, update, delete on recompensas to authenticated;
grant select on recompensas to anon;

-- ------------------------------------------------------------
-- 6. canjes — las redenciones de recompensas
-- ------------------------------------------------------------
create table if not exists canjes (
  id uuid primary key default gen_random_uuid(),
  miembro_id uuid not null references miembros(id) on delete cascade,
  recompensa_id uuid not null references recompensas(id) on delete restrict,
  -- El costo al momento del canje (por si la recompensa cambia después).
  puntos integer not null check (puntos > 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'entregado', 'anulado')),
  created_at timestamptz not null default now()
);

create index if not exists canjes_miembro_idx on canjes (miembro_id, created_at desc);

alter table canjes enable row level security;

-- Lectura: el cliente ve sus canjes, el dueño los de su programa.
-- Escritura: solo el servidor — el canje descuenta del ledger y las
-- dos escrituras van juntas en la misma operación server-side.
drop policy if exists "Cada quien lee sus canjes" on canjes;
create policy "Cada quien lee sus canjes" on canjes
  for select to authenticated
  using (
    exists (
      select 1 from miembros m
      where m.id = miembro_id
        and (
          m.cliente_id = auth.uid()
          or exists (
            select 1 from programa_lealtad p
            join ranchos r on r.id = p.rancho_id
            where p.id = m.programa_id and (r.owner_id = auth.uid() or is_admin())
          )
        )
    )
  );

grant select on canjes to authenticated;

-- ------------------------------------------------------------
-- 7. pases_wallet — un pase por miembro y plataforma
-- ------------------------------------------------------------
create table if not exists pases_wallet (
  id uuid primary key default gen_random_uuid(),
  miembro_id uuid not null references miembros(id) on delete cascade,
  plataforma text not null check (plataforma in ('apple', 'google')),
  serial_number text not null unique,
  -- El secreto con el que Apple se autentica al pedir el pase
  -- actualizado (Authorization: ApplePass <token>). Server-a-server.
  auth_token text not null,
  -- Espejo del saldo para pintar el pase sin sumar el ledger cada vez.
  -- La verdad SIEMPRE es transacciones_puntos.
  saldo_cache integer not null default 0,
  actualizado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (miembro_id, plataforma)
);

alter table pases_wallet enable row level security;

-- El cliente puede ver SU pase (para saber si ya lo agregó y con qué
-- serial); crearlo, actualizarlo y firmar es del servidor. El
-- auth_token que ve es el de su propio pase — no abre nada ajeno.
drop policy if exists "Cada quien ve su pase" on pases_wallet;
create policy "Cada quien ve su pase" on pases_wallet
  for select to authenticated
  using (
    exists (
      select 1 from miembros m
      where m.id = miembro_id and m.cliente_id = auth.uid()
    )
  );

grant select on pases_wallet to authenticated;

-- ------------------------------------------------------------
-- 8. registros_dispositivo — push de Apple Wallet (PassKit)
-- ------------------------------------------------------------
create table if not exists registros_dispositivo (
  device_library_id text not null,
  push_token text not null,
  pass_type_id text not null,
  serial_number text not null references pases_wallet(serial_number) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (device_library_id, serial_number)
);

create index if not exists registros_dispositivo_serial_idx
  on registros_dispositivo (serial_number);

alter table registros_dispositivo enable row level security;

-- Sin políticas ni grants a propósito: esta tabla es 100% del
-- servidor. Apple registra y consulta dispositivos server-a-server
-- autenticándose con el auth_token del pase — el navegador y la app
-- jamás la tocan.
