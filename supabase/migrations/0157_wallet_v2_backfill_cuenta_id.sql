-- ============================================================
-- WALLET V2 — Migración A (parte 2): backfill de programa_lealtad.cuenta_id
--
-- Resuelve el hueco real que dejó la 0134: programas creados DESPUÉS
-- de que esa migración corriera su backfill original nunca recibieron
-- `cuenta_id`, porque `crearGratisAlInstante` seguía sin tocar
-- `cuentas`. La 0156 ya cierra eso hacia adelante; esta migración
-- resuelve el histórico.
--
-- REGLA DE SEGURIDAD DEL BACKFILL: solo se vincula automáticamente
-- cuando la relación es INEQUÍVOCA — una `cuenta` cuyo `rancho_id`
-- coincide exactamente con el `rancho_id` del programa (la misma
-- relación fuerte que ya usó el backfill original de 0134). Nunca se
-- vincula por coincidencia de nombre comercial, ni cuando existe más
-- de un candidato posible por dueño — esos casos quedan en la vista
-- `wallet_v2_backfill_pendientes` para revisión humana, sin tocar la
-- fila.
--
-- IDEMPOTENTE: el UPDATE solo toca filas con `cuenta_id is null`, así
-- que correrla dos veces no repite trabajo ni lo deshace. La vista de
-- pendientes se recalcula sola en cada consulta — no hay una tabla de
-- reporte que pueda quedar desincronizada del estado real.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Vincular donde la relación es inequívoca
-- ------------------------------------------------------------
with candidato_fuerte as (
  select p.id as programa_id, c.id as cuenta_id, c.owner_id as owner_cuenta, r.owner_id as owner_rancho
  from programa_lealtad p
  join ranchos r on r.id = p.rancho_id
  join cuentas c on c.rancho_id = p.rancho_id
  where p.cuenta_id is null
)
update programa_lealtad p
set cuenta_id = cf.cuenta_id
from candidato_fuerte cf
where p.id = cf.programa_id
  -- Verificación de ownership, no solo de relación: si algún día una
  -- cuenta y su rancho terminaran con dueños distintos (no debería
  -- pasar dado el esquema actual, pero "no asumir, demostrar"), este
  -- backfill se abstiene en vez de vincular igual.
  and cf.owner_cuenta = cf.owner_rancho;

-- ------------------------------------------------------------
-- 2. Vista de diagnóstico — todo lo que el paso 1 NO resolvió,
--    clasificado por motivo. Sin PII: solo ids y conteos.
-- ------------------------------------------------------------
create or replace view public.wallet_v2_backfill_pendientes as
with base as (
  select p.id as programa_id, p.rancho_id, r.owner_id as owner_rancho
  from programa_lealtad p
  join ranchos r on r.id = p.rancho_id
  where p.cuenta_id is null
),
-- La cuenta enlazada directo a ESTE rancho, si existe — a lo sumo una,
-- porque `cuentas.rancho_id` es `unique`. Si existe pero el dueño no
-- coincide, el paso 1 de esta migración la descartó a propósito.
enlace_directo as (
  select b.programa_id, c.id as cuenta_id, c.owner_id as owner_cuenta
  from base b
  join cuentas c on c.rancho_id = b.rancho_id
),
-- Candidatas por dueño, EXCLUYENDO la de enlace directo (esa ya se
-- evaluó aparte) — para no contar la misma cuenta dos veces.
candidatas_por_owner as (
  select b.programa_id, array_agg(c.id order by c.created_at) as ids, count(*) as n
  from base b
  join cuentas c on c.owner_id = b.owner_rancho
  where not exists (
    select 1 from enlace_directo ed where ed.programa_id = b.programa_id and ed.cuenta_id = c.id
  )
  group by b.programa_id
)
select
  b.programa_id,
  b.rancho_id,
  b.owner_rancho,
  case
    when ed.cuenta_id is not null then 'ownership_contradictorio'
    when coalesce(cpo.n, 0) = 0 then 'sin_candidato'
    when cpo.n = 1 then 'candidato_debil_un_owner_sin_vincular'
    else 'dos_o_mas_candidatos_posibles'
  end as motivo,
  case when ed.cuenta_id is not null then array[ed.cuenta_id] else cpo.ids end as cuentas_candidatas,
  now() as calculado_en
from base b
left join enlace_directo ed on ed.programa_id = b.programa_id
left join candidatas_por_owner cpo on cpo.programa_id = b.programa_id;

comment on view public.wallet_v2_backfill_pendientes is
  'Wallet V2 — programas de lealtad sin cuenta_id que el backfill de '
  '0157 no pudo vincular automáticamente, con el motivo. Se recalcula '
  'en cada consulta: no es una foto vieja. Sin PII — solo ids.';

-- Solo lectura para service_role — es una herramienta de diagnóstico
-- interno, no una superficie de producto.
revoke all on public.wallet_v2_backfill_pendientes from public, anon, authenticated;
grant select on public.wallet_v2_backfill_pendientes to service_role;
