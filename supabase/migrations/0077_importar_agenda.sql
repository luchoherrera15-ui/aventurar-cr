-- ============================================================
-- BOOKEA — Traé tu agenda (0077)
--
-- El proveedor que llega con su agenda en papel (o en un cuaderno
-- fotografiado) puede pasarla a la plataforma. Dos caminos:
--
--   MANUAL  — pega el texto o llena la tabla a mano. GRATIS, siempre.
--   CON IA  — sube la foto de la agenda y Claude la transcribe.
--             ADD-ON DE PAGO: hay que tenerlo activo para usarlo.
--
-- Esta migración trae tres cosas:
--
--  1. `addons_negocio`: qué complementos pagos tiene encendido cada
--     negocio. CLAVE DE SEGURIDAD: el dueño solo LEE. Escribe únicamente
--     el servidor con la service key — si el dueño pudiera escribir, se
--     regalaría el add-on desde el navegador.
--
--  2. `importaciones_agenda`: la bitácora de cada corrida del
--     importador — cuántas filas salieron, si fue manual o con IA, y
--     los tokens/costo cuando fue con IA. Es lo que después permite
--     facturar el add-on por consumo real y no a ojo.
--
--  3. `reservas.importada_en` + `origen = 'importada'`: para poder
--     distinguir (y deshacer) lo que entró por el importador sin
--     tocar lo que la gente reservó por la web.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Los add-ons pagos de cada negocio
-- ------------------------------------------------------------

create table if not exists addons_negocio (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- Slug del complemento. Hoy: 'agenda_ia'. Mañana: 'lealtad', etc.
  addon text not null check (addon in ('agenda_ia', 'lealtad')),
  activo boolean not null default false,
  -- null = sin vencimiento (plan de por vida o cortesía).
  vence_en timestamptz,
  -- Para cortesías y pruebas: por qué se activó.
  notas text,
  activado_en timestamptz,
  created_at timestamptz not null default now(),
  unique (rancho_id, addon)
);

create index if not exists addons_negocio_rancho_idx on addons_negocio (rancho_id);

alter table addons_negocio enable row level security;

-- El dueño VE si su add-on está activo (lo necesita para pintar el
-- panel), pero NO puede escribir: sin política de insert/update/delete
-- para `authenticated`, la RLS niega por defecto. Solo la service key
-- (que salta RLS) activa o desactiva.
drop policy if exists "El dueño ve sus add-ons" on addons_negocio;
create policy "El dueño ve sus add-ons" on addons_negocio
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

grant select on addons_negocio to authenticated;
grant all on addons_negocio to service_role;

-- ¿Este negocio tiene el add-on encendido y vigente?
-- security definer para que se pueda llamar desde políticas y desde el
-- servidor sin depender de la RLS de la tabla.
create or replace function public.tiene_addon(p_rancho_id uuid, p_addon text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from addons_negocio a
    where a.rancho_id = p_rancho_id
      and a.addon = p_addon
      and a.activo
      and (a.vence_en is null or a.vence_en > now())
  );
$$;

grant execute on function public.tiene_addon(uuid, text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 1b. Intentos de desbloqueo (freno a la fuerza bruta)
--
-- El add-on se enciende escribiendo un código corto. Sin freno, son
-- 10.000 combinaciones que un script prueba en minutos. Se guardan los
-- intentos para poder trancar después de N fallos.
--
-- Va en la BASE y no en memoria a propósito: en Vercel cada request
-- puede caer en una instancia distinta (y las frías arrancan vacías),
-- así que un contador en RAM se reiniciaría solo y no frenaría nada.
--
-- Solo la service key lee y escribe: sin políticas para `authenticated`
-- la RLS niega por defecto. El dueño no necesita ver esta tabla — la
-- acción del servidor le devuelve cuánto le falta esperar.
-- ------------------------------------------------------------

create table if not exists intentos_desbloqueo (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  addon text not null,
  exito boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists intentos_desbloqueo_busqueda_idx
  on intentos_desbloqueo (rancho_id, addon, created_at desc);

alter table intentos_desbloqueo enable row level security;

grant all on intentos_desbloqueo to service_role;

-- ------------------------------------------------------------
-- 2. Bitácora de importaciones
-- ------------------------------------------------------------

create table if not exists importaciones_agenda (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- 'manual'  → el dueño pegó texto o llenó la tabla (gratis)
  -- 'ia_texto'→ Claude interpretó texto pegado (add-on)
  -- 'ia_foto' → Claude leyó una o varias fotos (add-on)
  metodo text not null check (metodo in ('manual', 'ia_texto', 'ia_foto')),
  filas_propuestas integer not null default 0,
  filas_guardadas integer not null default 0,
  -- Solo cuando hubo IA de por medio; sirve para facturar el add-on.
  modelo text,
  tokens_input integer,
  tokens_output integer,
  costo_usd numeric,
  tiempo_ms integer,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists importaciones_agenda_rancho_idx
  on importaciones_agenda (rancho_id, created_at desc);

alter table importaciones_agenda enable row level security;

-- El dueño lee su propio historial (para ver cuánto ha consumido del
-- add-on). Escribe solo el servidor.
drop policy if exists "El dueño ve sus importaciones" on importaciones_agenda;
create policy "El dueño ve sus importaciones" on importaciones_agenda
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

grant select on importaciones_agenda to authenticated;
grant all on importaciones_agenda to service_role;

-- ------------------------------------------------------------
-- 3. Marcar lo que entró por el importador
-- ------------------------------------------------------------

alter table reservas drop constraint if exists reservas_origen_check;
alter table reservas add constraint reservas_origen_check
  check (origen in ('web', 'movil', 'manual', 'sync', 'importada'));

alter table reservas add column if not exists importada_en timestamptz;
-- De qué corrida del importador vino, para poder deshacerla completa.
alter table reservas add column if not exists importacion_id uuid
  references importaciones_agenda(id) on delete set null;

create index if not exists reservas_importacion_idx
  on reservas (importacion_id) where importacion_id is not null;

-- ------------------------------------------------------------
-- 4. El dueño necesita poder CORREGIR una reserva ya creada
--
-- Hasta hoy la política del dueño sobre `reservas` permitía update
-- (se usa para aprobar/marcar pagos), pero el importador vuelve
-- indispensable poder cambiar monto, personas y horario después.
-- Se re-declara explícitamente para dejarlo documentado y asegurar
-- que exista en cualquier base donde se corra esta migración.
-- ------------------------------------------------------------

drop policy if exists "El dueño edita las reservas de su negocio" on reservas;
create policy "El dueño edita las reservas de su negocio" on reservas
  for update to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  )
  with check (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

notify pgrst, 'reload schema';
