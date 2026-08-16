-- ============================================================
-- WALLET V2 — Migración B: saldo canónico en `miembros` (EXPAND)
--
-- Fase 2A (decisiones-tablas.md §4): el saldo vive hoy en
-- `pases_wallet.saldo_cache`, UNA VEZ POR PLATAFORMA — un miembro con
-- pase Apple y Google tiene DOS columnas que deberían coincidir y que
-- nada garantiza que coincidan. Esta migración agrega el campo
-- canónico a `miembros` (una vez por miembro) SIN tocar todavía
-- `pases_wallet` — expand, no contract. La aprobación explícita de la
-- Fase 2B prohíbe retirar columnas legacy en esta fase.
--
-- El saldo se RECALCULA desde `transacciones_puntos` (el ledger), no
-- se copia de `pases_wallet` — es recalculable porque el ledger, no el
-- caché, es la fuente de verdad (decisiones-tablas.md §7). Recalcular
-- también corrige cualquier drift histórico entre los dos
-- `pases_wallet` de un mismo miembro en el mismo paso.
-- ============================================================

alter table miembros
  add column if not exists saldo_cache integer not null default 0,
  add column if not exists saldo_actualizado_en timestamptz;

comment on column miembros.saldo_cache is
  'Wallet V2 — proyección canónica del saldo (recalculada desde '
  'transacciones_puntos). Reemplaza, para consumidores nuevos, a '
  'pases_wallet.saldo_cache — que SIGUE existiendo sin cambios en '
  'esta fase (expand-verify-contract, Fase 2B). Ver '
  'docs/wallet-v2/reconciliacion-saldos.md.';

-- ------------------------------------------------------------
-- Vista de reconciliación — SIN PII (solo ids y números), clasifica
-- cada miembro contra las 8 categorías que pidió la Fase 2B. Se
-- recalcula en cada consulta: no es una foto vieja.
-- ------------------------------------------------------------
create or replace view public.wallet_v2_reconciliacion_saldos as
with ledger as (
  select miembro_id, sum(puntos) as saldo_ledger, count(*) as movimientos
  from transacciones_puntos
  group by miembro_id
),
pases as (
  select
    miembro_id,
    count(*) as total_pases,
    count(*) filter (where plataforma = 'apple') as pases_apple,
    count(*) filter (where plataforma = 'google') as pases_google,
    max(saldo_cache) filter (where plataforma = 'apple') as saldo_apple,
    max(saldo_cache) filter (where plataforma = 'google') as saldo_google,
    count(distinct saldo_cache) as saldos_distintos
  from pases_wallet
  where activo = true
  group by miembro_id
)
select
  m.id as miembro_id,
  m.programa_id,
  coalesce(l.saldo_ledger, 0) as saldo_ledger,
  coalesce(l.movimientos, 0) as movimientos_ledger,
  p.saldo_apple,
  p.saldo_google,
  coalesce(p.total_pases, 0) as total_pases,
  case
    -- Más severo primero: un ledger negativo importa aunque el
    -- miembro todavía no tenga pase — no debería ocurrir nunca desde
    -- las RPC reales (motor.ts/0125 no lo permiten), así que si
    -- aparece acá es evidencia de una escritura fuera de las RPC.
    when coalesce(l.saldo_ledger, 0) < 0 then 'saldo_imposible'
    -- Miembro sin ningún pase emitido todavía — normal, no es un error.
    when p.total_pases is null or p.total_pases = 0 then 'miembro_sin_pase'
    -- El ledger no tiene ninguna fila pero el pase muestra saldo > 0:
    -- imposible que el saldo haya salido de otro lado.
    when coalesce(l.movimientos, 0) = 0 and coalesce(p.saldo_apple, 0) + coalesce(p.saldo_google, 0) > 0
      then 'ledger_incompleto'
    -- Más de un pase ACTIVO en la MISMA plataforma para el mismo
    -- miembro. Estructuralmente prevenido hoy por
    -- pases_wallet_vigente_idx (0138, unique parcial) — se deja el
    -- chequeo igual, por si ese índice cambiara en el futuro.
    when p.pases_apple > 1 or p.pases_google > 1 then 'pase_duplicado'
    -- Apple y Google no coinciden entre sí.
    when p.pases_apple = 1 and p.pases_google = 1 and p.saldo_apple is distinct from p.saldo_google
      then 'plataformas_con_saldos_diferentes'
    -- Coincide exactamente con TODAS las plataformas que tenga.
    --
    -- Fase 2C, hallazgo real (ensayo con forma de producción, no de
    -- lectura de código): acá tenía que ser `coalesce(l.saldo_ledger,
    -- 0)`, no `l.saldo_ledger` a secas. Un miembro CON pase pero SIN
    -- ninguna fila de ledger (el caso más común de todos: recién
    -- afiliado, todavía sin visitas) no tiene fila en la CTE `ledger`
    -- — el LEFT JOIN deja `l.saldo_ledger` en NULL. `0 = NULL` es NULL
    -- en SQL, no verdadero, así que este WHEN nunca se cumplía para
    -- ese caso — con saldo_cache=0 en ambos lados, "coincide" de
    -- verdad, pero caía al ELSE y clasificaba como
    -- `requiere_decision`. Probado con un fixture real: un miembro con
    -- 1 pase Apple, 0 movimientos, saldo_cache=0 clasificaba mal antes
    -- de este cambio.
    when (p.pases_apple = 0 or p.saldo_apple = coalesce(l.saldo_ledger, 0))
     and (p.pases_google = 0 or p.saldo_google = coalesce(l.saldo_ledger, 0))
      then 'coincide'
    else 'requiere_decision'
  end as clasificacion
from miembros m
left join ledger l on l.miembro_id = m.id
left join pases p on p.miembro_id = m.id;

-- "Pase sin miembro" es un caso aparte: no tiene fila de `miembros`
-- que recorrer arriba, así que se detecta con su propia vista.
create or replace view public.wallet_v2_pases_sin_miembro as
select pw.id as pase_id, pw.miembro_id, pw.plataforma
from pases_wallet pw
where not exists (select 1 from miembros m where m.id = pw.miembro_id);

revoke all on public.wallet_v2_reconciliacion_saldos from public, anon, authenticated;
revoke all on public.wallet_v2_pases_sin_miembro from public, anon, authenticated;
grant select on public.wallet_v2_reconciliacion_saldos to service_role;
grant select on public.wallet_v2_pases_sin_miembro to service_role;

-- ------------------------------------------------------------
-- Backfill: escribe el saldo recalculado del ledger en TODOS los
-- miembros. Es seguro escribirlo incondicionalmente —incluso en las
-- categorías que no son 'coincide'— porque NINGÚN consumidor real lee
-- todavía `miembros.saldo_cache` (esta es la fase "expand": el
-- interruptor de lectura es una fase futura, explícitamente fuera de
-- alcance de la Fase 2B). Lo que la Fase 2B exige es que la
-- DISCREPANCIA quede visible antes de ese interruptor — y esa es la
-- vista de arriba, que no se sobrescribe ni se apaga con este UPDATE.
-- Idempotente: recalcula siempre el mismo valor a partir del ledger.
-- ------------------------------------------------------------
update miembros m
set saldo_cache = coalesce((select sum(puntos) from transacciones_puntos t where t.miembro_id = m.id), 0),
    saldo_actualizado_en = now();
