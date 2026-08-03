-- ============================================================
-- BOOKEA — Citas: CRM y campañas por negocio (0094)
--
-- Fase 1 del re-acondicionamiento de Citas. El objetivo: que el
-- negocio detecte a los clientes que le fallan (no vienen a sus
-- citas) o que dejaron de venir, y pueda escribirles una promoción
-- de re-enganche desde su propio panel — con el mismo rigor de
-- consentimiento que las campañas de la plataforma (0082/0083).
--
-- Tres piezas, todas ADITIVAS (la app móvil no se entera):
--
--  1. `campanas_negocio`: la bitácora de cada campaña que un negocio
--     manda desde su panel (re-enganche a un cliente o promo a un
--     segmento). Sirve de auditoría Y de freno anti-abuso: el tope
--     diario se cuenta contra esta tabla.
--
--  2. `envios_campana`: a qué correo se le envió cada campaña. Es el
--     freno de "no escribirle al mismo cliente dos veces por semana",
--     y lo que el panel muestra como historial.
--
--     CLAVE DE SEGURIDAD (mismo modelo que addons_negocio 0077): el
--     dueño solo LEE ambas tablas. Escribe únicamente el servidor con
--     la service key, DESPUÉS de pasar la lista por el filtro de
--     consentimiento — si el dueño pudiera insertar filas desde el
--     navegador, se saltaría el filtro y los frenos.
--
--  3. `avisos_agenda`: el reclamo del aviso diario del cron ("tenés N
--     citas de ayer sin marcar", "este cliente te falló dos veces
--     seguidas"). Una fila por (negocio, día) = un aviso por día como
--     máximo, aunque el cron corra dos veces (mismo patrón que
--     avisos_finde_libre 0053).
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bitácora de campañas por negocio
-- ------------------------------------------------------------

create table if not exists campanas_negocio (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- 'reenganche' = correo individual a un cliente que faltó o dejó de
  -- venir; 'campana' = promo a un segmento (todos, inactivos...).
  tipo text not null default 'campana' check (tipo in ('reenganche', 'campana')),
  -- A quiénes se apuntó (para leer la bitácora después, no es filtro).
  segmento text check (
    segmento is null
    or segmento in ('todos', 'inactivos', 'no_show', 'manual')
  ),
  asunto text not null check (char_length(asunto) between 1 and 150),
  mensaje text not null check (char_length(mensaje) between 1 and 5000),
  -- Conteos del resultado (los llena el servidor al terminar el envío).
  total_destinatarios integer not null default 0,
  enviados integer not null default 0,
  excluidos integer not null default 0,
  fallidos integer not null default 0,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- El freno diario cuenta "campañas de este negocio de hoy": el índice
-- deja esa consulta barata aunque la bitácora crezca.
create index if not exists campanas_negocio_rancho_idx
  on campanas_negocio (rancho_id, created_at desc);

alter table campanas_negocio enable row level security;

drop policy if exists "El dueño ve sus campañas" on campanas_negocio;
create policy "El dueño ve sus campañas" on campanas_negocio
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

grant select on campanas_negocio to authenticated;
grant all on campanas_negocio to service_role;

-- ------------------------------------------------------------
-- 2. A quién le llegó cada campaña
-- ------------------------------------------------------------

create table if not exists envios_campana (
  campana_id uuid not null references campanas_negocio(id) on delete cascade,
  -- Redundante con campanas_negocio.rancho_id a propósito: el freno
  -- "¿le escribimos a este correo hace poco?" se resuelve con un solo
  -- índice sin pasar por el join.
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- Mismo criterio de normalización que consentimientos (0083).
  correo text not null check (
    correo = btrim(lower(correo), E' \t\n\r\f\v')
    and position('@' in correo) > 1
    and correo !~ '\s'
  ),
  created_at timestamptz not null default now(),
  primary key (campana_id, correo)
);

create index if not exists envios_campana_freno_idx
  on envios_campana (rancho_id, correo, created_at desc);

alter table envios_campana enable row level security;

drop policy if exists "El dueño ve sus envíos" on envios_campana;
create policy "El dueño ve sus envíos" on envios_campana
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

grant select on envios_campana to authenticated;
grant all on envios_campana to service_role;

-- ------------------------------------------------------------
-- 3. Reclamo del aviso diario de la agenda
-- ------------------------------------------------------------

create table if not exists avisos_agenda (
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- El día (en hora del negocio/CR) en que salió el aviso: el insert
  -- con esta llave ES el reclamo — si ya existe, hoy ya se avisó.
  fecha date not null,
  created_at timestamptz not null default now(),
  primary key (rancho_id, fecha)
);

alter table avisos_agenda enable row level security;

-- Solo lo consulta el cron (service key). El dueño no necesita verla,
-- y sin políticas para authenticated la RLS niega por defecto.
grant all on avisos_agenda to service_role;
