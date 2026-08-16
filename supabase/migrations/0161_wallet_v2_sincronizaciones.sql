-- ============================================================
-- WALLET V2 — Migración D: la cola única de sincronización
--
-- NOMBRE: `wallet_sincronizaciones`, no `wallet_sync_pendiente`. La
-- tabla va a guardar filas completadas, fallidas, muertas y
-- canceladas —no solo pendientes— porque sirven para auditoría y
-- diagnóstico ("¿a este sello le llegó el push?", el hallazgo central
-- de la Fase 0). Un nombre que dice "pendiente" mentiría apenas la
-- primera fila tuviera éxito. Español, consistente con las 161
-- migraciones anteriores de este repo — ninguna usa nombres en
-- inglés.
--
-- FUSIÓN JUSTIFICADA de "evento" + "intento": una sola tabla. Con el
-- volumen actual de Bookea (un puñado de negocios, ver
-- docs/wallet-v2/modelo-existente.md), separar "el hecho de dominio"
-- de "el intento por plataforma" en dos tablas modelaría la MISMA
-- relación 1-a-como-máximo-2 (un pase tiene Apple, Google, o ambos)
-- con dos tablas en vez de una — exactamente la fragmentación que la
-- Fase 2A pidió evitar si no hace falta. Cada fila de acá YA ES un
-- intento de una plataforma concreta contra un pase concreto; el
-- "evento lógico" que las agrupa es `correlation_id`, no una tabla
-- aparte.
--
-- FAN-OUT: una operación que afecta a Apple y a Google crea DOS filas
-- independientes (mismo correlation_id, plataforma distinta) — cada
-- una puede tener éxito o fallar sola. Lo aplica
-- `wallet_encolar_sincronizacion()` más abajo, iterando los pases
-- activos del miembro.
--
-- ALCANCE DE ESTA MIGRACIÓN: la tabla, sus estados, sus índices, su
-- RLS, y la función segura para encolar. NO incluye todavía el
-- worker que de verdad llama a APNs o hace el PATCH a Google — eso
-- es Fase 3/4. Acá se demuestra que la cola encola bien, no que
-- entrega.
-- ============================================================

-- `update_tag` se introduce acá porque esta tabla ya lo necesita
-- (`version_local_esperada`, abajo); la Migración E lo completa con
-- la lógica que lo incrementa de verdad. `add column if not exists`:
-- si la Migración E ya corrió antes por algún motivo, no choca.
alter table pases_wallet add column if not exists update_tag bigint not null default 0;

create table if not exists wallet_sincronizaciones (
  id uuid primary key default gen_random_uuid(),

  cuenta_id uuid references cuentas(id) on delete cascade,
  programa_id uuid not null references programa_lealtad(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  pase_id uuid not null references pases_wallet(id) on delete cascade,

  plataforma text not null check (plataforma in ('apple', 'google')),
  operacion text not null check (operacion in ('saldo', 'diseno', 'pausa', 'mensaje_promocional')),

  estado text not null default 'pending'
    check (estado in ('pending', 'processing', 'retryable', 'succeeded', 'dead', 'cancelled')),

  -- Identidad del trabajo: la MISMA combinación no encola dos veces.
  idempotency_key text not null,
  correlation_id uuid not null,

  -- El update_tag (Migración E) que este intento espera reflejar —
  -- permite al worker descartar un intento viejo si el pase ya
  -- avanzó de versión por otro motivo mientras esperaba en cola.
  version_local_esperada bigint,

  intentos integer not null default 0,
  max_intentos integer not null default 8,
  proximo_intento_en timestamptz not null default now(),

  bloqueado_en timestamptz,
  bloqueado_por text,
  ultimo_intento_en timestamptz,

  error text,
  respuesta_remota jsonb,

  exitoso_en timestamptz,
  fallido_permanente_en timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ningún estado imposible: succeeded siempre con fecha de éxito,
  -- dead siempre con fecha de fallo permanente, y nunca las dos a la
  -- vez (una fila no puede haber tenido éxito Y fallado para siempre).
  constraint wallet_sincronizaciones_estado_coherente check (
    (estado = 'succeeded' and exitoso_en is not null and fallido_permanente_en is null)
    or (estado = 'dead' and fallido_permanente_en is not null and exitoso_en is null)
    or (estado not in ('succeeded', 'dead') and exitoso_en is null and fallido_permanente_en is null)
  )
);

-- La MISMA combinación evento+plataforma+pase+operación no encola dos
-- veces mientras siga sin resolver — un `ON CONFLICT` en
-- `wallet_encolar_sincronizacion()` se apoya en este índice.
create unique index if not exists wallet_sincronizaciones_activa_idx
  on wallet_sincronizaciones (idempotency_key, plataforma, pase_id, operacion)
  where estado in ('pending', 'processing', 'retryable');

create index if not exists wallet_sincronizaciones_reclamable_idx
  on wallet_sincronizaciones (proximo_intento_en)
  where estado in ('pending', 'retryable') and bloqueado_en is null;

create index if not exists wallet_sincronizaciones_miembro_idx
  on wallet_sincronizaciones (miembro_id, created_at desc);

create index if not exists wallet_sincronizaciones_correlation_idx
  on wallet_sincronizaciones (correlation_id);

-- `set_updated_at` puede no existir todavía si ningún otro módulo lo
-- creó — se define acá, defensivamente, solo si hace falta, ANTES del
-- trigger que la usa.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at' and pronamespace = 'public'::regnamespace) then
    create function public.set_updated_at() returns trigger language plpgsql as $f$
    begin
      new.updated_at := now();
      return new;
    end;
    $f$;
  end if;
end $$;

create trigger wallet_sincronizaciones_updated_at
  before update on wallet_sincronizaciones
  for each row
  execute function public.set_updated_at();

comment on table wallet_sincronizaciones is
  'Wallet V2 — la cola única de sincronización con Apple/Google. '
  'Reemplaza, cuando se complete la migración de pausa/diseño (ver '
  'docs/wallet-v2/migracion-legacy.md), a las columnas de bandera de '
  'pases_wallet. NO se borran filas completadas: sirven de auditoría.';

-- ------------------------------------------------------------
-- RLS — mismo patrón que registros_dispositivo: 100% del servidor,
-- ningún rol de aplicación la lee ni la escribe directo. Los usuarios
-- NO insertan jobs Wallet desde el navegador.
-- ------------------------------------------------------------
alter table wallet_sincronizaciones enable row level security;
revoke all on wallet_sincronizaciones from public, anon, authenticated;
grant select, insert, update, delete on wallet_sincronizaciones to service_role;

-- ------------------------------------------------------------
-- Encolar de forma segura: una fila por plataforma activa del
-- miembro. Se llama DESDE las RPC de movimiento (acreditar_lealtad,
-- canjear_recompensa, revertir_movimiento), en la MISMA transacción
-- que confirma el movimiento — nunca después, en un segundo viaje que
-- podría no llegar a ejecutarse.
-- ------------------------------------------------------------
create or replace function public.wallet_encolar_sincronizacion(
  p_miembro_id uuid,
  p_operacion text,
  p_idempotency_key text,
  p_correlation_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programa_id uuid;
  v_cuenta_id uuid;
  v_encoladas integer := 0;
  v_pase record;
begin
  select programa_id into v_programa_id from miembros where id = p_miembro_id;
  if v_programa_id is null then return 0; end if;

  select cuenta_id into v_cuenta_id from programa_lealtad where id = v_programa_id;

  for v_pase in
    select id, plataforma, update_tag from pases_wallet
    where miembro_id = p_miembro_id and activo = true
  loop
    insert into wallet_sincronizaciones (
      cuenta_id, programa_id, miembro_id, pase_id, plataforma, operacion,
      idempotency_key, correlation_id, version_local_esperada
    ) values (
      v_cuenta_id, v_programa_id, p_miembro_id, v_pase.id, v_pase.plataforma, p_operacion,
      p_idempotency_key, p_correlation_id, v_pase.update_tag
    )
    on conflict (idempotency_key, plataforma, pase_id, operacion) where estado in ('pending', 'processing', 'retryable')
    do nothing;

    if found then
      v_encoladas := v_encoladas + 1;
    end if;
  end loop;

  return v_encoladas;
end;
$$;

revoke all on function public.wallet_encolar_sincronizacion(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.wallet_encolar_sincronizacion(uuid, text, text, uuid) to service_role;

comment on function public.wallet_encolar_sincronizacion is
  'Wallet V2 — encola un intento de sync por CADA pase activo del '
  'miembro (fan-out real). Idempotente por (idempotency_key, '
  'plataforma, pase_id, operacion). Todavía no incluye el worker que '
  'entrega — eso es Fase 3/4.';
