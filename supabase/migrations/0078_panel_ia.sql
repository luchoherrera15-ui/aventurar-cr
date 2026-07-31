-- ============================================================
-- BOOKEA — Panel de administración de IA
--
--   1. uso_ia: una fila por CADA llamada a un modelo. Es la única
--      fuente de verdad del gasto; hoy el costo se calcula en varios
--      lados y se tira a la basura (console.log o memoria del
--      navegador).
--   2. Configuración de IA en configuracion_plataforma: qué modelo
--      usa cada agente, el tope de gasto mensual y el tipo de cambio
--      para poder mostrar todo también en colones.
--   3. conocimiento_negocio: las respuestas que el dueño le enseña
--      al asistente del chat sin que nadie toque código.
--   4. ranchos.asistente_activo: el interruptor por negocio.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bitácora de uso de IA
-- ------------------------------------------------------------
-- `agente` a propósito NO lleva check constraint: si algún día se
-- escribe mal, la fila entra igual y aparece rara en el panel — que
-- es visible. Con check, el insert fallaría y el gasto quedaría
-- invisible, justo lo que esta tabla viene a arreglar. Los valores
-- válidos los fija el tipo AgenteIA de src/lib/ia/modelos.ts:
--   invitacion_chat · invitacion_brief · invitacion_generar
--   invitacion_refinar · agenda_leer · asistente_negocio

create table if not exists uso_ia (
  id uuid primary key default gen_random_uuid(),
  agente text not null,
  modelo text not null,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  -- El caché de prompts se factura distinto; hoy no se usa en ningún
  -- llamado, pero la columna evita otra migración cuando se active.
  tokens_cache_write integer not null default 0,
  tokens_cache_read integer not null default 0,
  costo_usd numeric(12, 6) not null default 0,
  -- El tipo de cambio se congela en cada fila: si mañana sube, lo ya
  -- gastado no cambia de monto en colones.
  tipo_cambio numeric(10, 2) not null default 520,
  costo_crc numeric(14, 2)
    generated always as (round(costo_usd * tipo_cambio, 2)) stored,
  tiempo_ms integer,
  exito boolean not null default true,
  error text,
  usuario_id uuid references auth.users(id) on delete set null,
  rancho_id uuid references ranchos(id) on delete set null,
  -- La invitación, la conversación o la importación que originó la
  -- llamada. Sin foreign key: apunta a tablas distintas según agente.
  referencia_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists uso_ia_created_at_idx on uso_ia (created_at desc);
create index if not exists uso_ia_agente_idx on uso_ia (agente, created_at desc);
create index if not exists uso_ia_rancho_idx on uso_ia (rancho_id, created_at desc)
  where rancho_id is not null;

alter table uso_ia enable row level security;

-- El admin ve todo; el dueño de un negocio ve solo lo que gastó su
-- negocio (para poder cobrarle el add-on con el detalle a la vista).
drop policy if exists "El admin ve todo el uso de IA" on uso_ia;
create policy "El admin ve todo el uso de IA"
  on uso_ia for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from ranchos r
      where r.id = uso_ia.rancho_id and r.owner_id = auth.uid()
    )
  );

-- Solo el servidor escribe: cada llamada se registra con la service
-- role key desde el mismo punto donde se gastan los tokens.
grant select on uso_ia to authenticated;
grant all on uso_ia to service_role;

-- ------------------------------------------------------------
-- 2. Configuración de IA (misma fila única de la plataforma)
-- ------------------------------------------------------------
-- La tabla ya existe desde 0009 con su RLS de admin y sus grants; acá
-- solo se le suman columnas. Todas con default, así que la fila que
-- ya está queda configurada sin tocar nada.

alter table configuracion_plataforma
  -- Interruptor general: en false, ningún agente gasta un token.
  add column if not exists ia_activa boolean not null default true,
  -- Un modelo por agente. El chat conversa barato con Haiku y el
  -- brief final —el que decide cómo sale la invitación— lo cierra
  -- Opus; generar el HTML también es Opus.
  add column if not exists ia_modelo_chat text not null default 'claude-haiku-4-5',
  add column if not exists ia_modelo_brief text not null default 'claude-opus-5',
  add column if not exists ia_modelo_generar text not null default 'claude-opus-5',
  add column if not exists ia_modelo_refinar text not null default 'claude-haiku-4-5',
  add column if not exists ia_modelo_agenda text not null default 'claude-opus-5',
  add column if not exists ia_modelo_asistente text not null default 'claude-haiku-4-5',
  -- Tope de gasto del mes en dólares. 0 = sin tope.
  add column if not exists ia_tope_mensual_usd numeric not null default 0,
  -- Con cuánto se convierte a colones lo que Anthropic cobra en USD.
  add column if not exists ia_tipo_cambio numeric not null default 520;

-- ------------------------------------------------------------
-- 3. Lo que el dueño le enseña al asistente del chat
-- ------------------------------------------------------------

create table if not exists conocimiento_negocio (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  pregunta text not null,
  respuesta text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conocimiento_negocio_rancho_idx
  on conocimiento_negocio (rancho_id, orden);

alter table conocimiento_negocio enable row level security;

drop policy if exists "El dueño administra el conocimiento de su negocio" on conocimiento_negocio;
create policy "El dueño administra el conocimiento de su negocio"
  on conocimiento_negocio for all to authenticated
  using (
    is_admin()
    or exists (
      select 1 from ranchos r
      where r.id = conocimiento_negocio.rancho_id and r.owner_id = auth.uid()
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from ranchos r
      where r.id = conocimiento_negocio.rancho_id and r.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on conocimiento_negocio to authenticated;
grant all on conocimiento_negocio to service_role;

-- ------------------------------------------------------------
-- 4. El interruptor del asistente por negocio
-- ------------------------------------------------------------
-- Nullable a propósito: null = "seguí la regla de siempre" (activo
-- para la categoría Lugares y para los slugs de ASISTENTE_IA_SLUGS).
-- true lo fuerza encendido, false lo apaga aunque sea de Lugares. Así
-- ningún negocio cambia de comportamiento al correr esta migración.

alter table ranchos
  add column if not exists asistente_activo boolean,
  add column if not exists asistente_instrucciones text;

comment on column ranchos.asistente_activo is
  'null = regla por defecto (categoría lugares o slug en ASISTENTE_IA_SLUGS); true = forzado activo; false = apagado.';
comment on column ranchos.asistente_instrucciones is
  'Tono e indicaciones extra que el dueño le da al asistente del chat.';

-- ------------------------------------------------------------
-- 5. El gasto se suma en la base, no en memoria
-- ------------------------------------------------------------
-- Traer las filas del mes a Node para sumarlas no escala: PostgREST
-- recorta la respuesta (db-max-rows, mil por defecto) y el total se
-- congela justo cuando hay volumen — que es exactamente cuando el tope
-- de gasto tiene que frenar. Estas funciones suman en Postgres.
--
-- El día se recorta en hora de Costa Rica, igual que el resto del
-- sitio: el servidor corre en UTC y sin esto el 1 de cada mes las
-- primeras seis horas caían en el mes equivocado.

create or replace function public.gasto_ia_usd(
  p_desde timestamptz,
  p_hasta timestamptz default null
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(costo_usd), 0)
  from uso_ia
  where created_at >= p_desde
    and (p_hasta is null or created_at < p_hasta);
$$;

create or replace function public.gasto_ia_resumen(
  p_desde timestamptz,
  p_hasta timestamptz
)
returns table (
  agente text,
  modelo text,
  llamadas bigint,
  tokens_input bigint,
  tokens_output bigint,
  costo_usd numeric,
  costo_crc numeric,
  fallidas bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.agente,
    u.modelo,
    count(*)::bigint,
    coalesce(sum(u.tokens_input), 0)::bigint,
    coalesce(sum(u.tokens_output), 0)::bigint,
    coalesce(sum(u.costo_usd), 0),
    coalesce(sum(u.costo_crc), 0),
    count(*) filter (where not u.exito)::bigint
  from uso_ia u
  where u.created_at >= p_desde and u.created_at < p_hasta
  group by u.agente, u.modelo;
$$;

create or replace function public.gasto_ia_por_dia(
  p_desde timestamptz,
  p_hasta timestamptz
)
returns table (
  dia date,
  llamadas bigint,
  tokens_input bigint,
  tokens_output bigint,
  costo_usd numeric,
  costo_crc numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (u.created_at at time zone 'America/Costa_Rica')::date as dia,
    count(*)::bigint,
    coalesce(sum(u.tokens_input), 0)::bigint,
    coalesce(sum(u.tokens_output), 0)::bigint,
    coalesce(sum(u.costo_usd), 0),
    coalesce(sum(u.costo_crc), 0)
  from uso_ia u
  where u.created_at >= p_desde and u.created_at < p_hasta
  group by 1
  order by 1;
$$;

-- Solo el servidor las llama (el panel usa la service role key). Se
-- revoca el execute que Postgres le da a public por defecto.
revoke all on function public.gasto_ia_usd(timestamptz, timestamptz) from public;
revoke all on function public.gasto_ia_resumen(timestamptz, timestamptz) from public;
revoke all on function public.gasto_ia_por_dia(timestamptz, timestamptz) from public;
grant execute on function public.gasto_ia_usd(timestamptz, timestamptz) to service_role;
grant execute on function public.gasto_ia_resumen(timestamptz, timestamptz) to service_role;
grant execute on function public.gasto_ia_por_dia(timestamptz, timestamptz) to service_role;

-- ------------------------------------------------------------
-- 6. Rescate de generaciones trabadas
-- ------------------------------------------------------------
-- El guard de concurrencia marca estado_generacion = 'generando' y solo
-- lo vuelve a mover el final feliz o el catch. Si el proceso muere en
-- el medio (timeout de Vercel, un redeploy a mitad de camino), la fila
-- quedaba en 'generando' para siempre y el cliente recibía 409 sin
-- ninguna forma de salir. La tabla solo tenía created_at, que es de
-- cuando se creó la invitación y no sirve para esto.

alter table invitaciones
  add column if not exists generacion_iniciada_en timestamptz;

comment on column invitaciones.generacion_iniciada_en is
  'Cuándo arrancó la generación en curso. Permite dar por muerta una generación trabada en estado_generacion = generando.';
