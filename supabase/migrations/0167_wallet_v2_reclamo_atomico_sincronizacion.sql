-- ============================================================
-- WALLET V2 — Migración G: reclamo atómico para el worker de
-- sincronización (Fase 3/4)
--
-- `wallet-v2-cola-sincronizacion.test.ts` (Migración D/Fase 2C) ya
-- probó el patrón `SELECT ... FOR UPDATE SKIP LOCKED` que un worker
-- necesita para reclamar un lote sin pisarse con otra corrida
-- concurrente — pero lo probó con SQL crudo vía `docker exec ...
-- psql`, un atajo que solo existe en la máquina de pruebas. El worker
-- real corre en Vercel, habla con la base únicamente por
-- supabase-js/PostgREST, y PostgREST no permite componer un UPDATE
-- cuyo WHERE sea un SELECT ... FOR UPDATE SKIP LOCKED con LIMIT desde
-- el cliente REST. La única forma de que el worker reclame un lote de
-- verdad es una función de Postgres que el cliente de servicio invoque
-- por RPC — el mismo camino que ya usa `wallet_encolar_sincronizacion`
-- (0161/0164).
--
-- Dos funciones, mismo criterio de acceso que la tabla que tocan
-- (100% del servidor, RLS activa, solo `service_role`):
--
--   · `wallet_barrer_lease_expirada` — repone a `retryable` lo que un
--     worker caído dejó en `processing` con `bloqueado_en` viejo (el
--     HALLAZGO que `wallet-v2-cola-sincronizacion.test.ts` dejó
--     documentado como gap real, sin resolver, en Fase 2C).
--   · `wallet_reclamar_sincronizaciones` — el CTE de reclamo en sí:
--     candidatas por `FOR UPDATE SKIP LOCKED`, marcadas `processing`
--     en la misma sentencia, devueltas para que el worker las procese.
-- ============================================================

create or replace function public.wallet_barrer_lease_expirada(
  p_lease_minutos integer default 5
) returns integer
language sql
security definer
set search_path = public
as $$
  with expiradas as (
    update wallet_sincronizaciones
    set estado = 'retryable', bloqueado_en = null, bloqueado_por = null
    where estado = 'processing'
      and bloqueado_en < now() - (greatest(p_lease_minutos, 0)::text || ' minutes')::interval
    returning id
  )
  select count(*)::integer from expiradas;
$$;

revoke all on function public.wallet_barrer_lease_expirada(integer) from public, anon, authenticated;
grant execute on function public.wallet_barrer_lease_expirada(integer) to service_role;

comment on function public.wallet_barrer_lease_expirada is
  'Wallet V2 — repone a retryable las filas processing cuyo lease '
  '(bloqueado_en) venció: el worker que las tenía se cayó sin '
  'terminar. Devuelve cuántas filas repuso. Se llama al PRINCIPIO de '
  'cada ciclo del worker, antes de reclamar nada nuevo.';

create or replace function public.wallet_reclamar_sincronizaciones(
  p_cantidad integer,
  p_worker_id text
) returns setof wallet_sincronizaciones
language sql
security definer
set search_path = public
as $$
  with candidatas as (
    select id from wallet_sincronizaciones
    where estado in ('pending', 'retryable')
      and proximo_intento_en <= now()
      and bloqueado_en is null
    order by proximo_intento_en
    limit greatest(p_cantidad, 0)
    for update skip locked
  )
  update wallet_sincronizaciones w
  set estado = 'processing', bloqueado_en = now(), bloqueado_por = p_worker_id
  from candidatas
  where w.id = candidatas.id
  returning w.*;
$$;

revoke all on function public.wallet_reclamar_sincronizaciones(integer, text) from public, anon, authenticated;
grant execute on function public.wallet_reclamar_sincronizaciones(integer, text) to service_role;

comment on function public.wallet_reclamar_sincronizaciones is
  'Wallet V2 — reclama hasta p_cantidad filas pending/retryable '
  'listas (proximo_intento_en <= now(), sin lease) con FOR UPDATE '
  'SKIP LOCKED, las marca processing/bloqueado_por = p_worker_id en '
  'la MISMA sentencia, y las devuelve. Dos llamadas concurrentes '
  '(dos invocaciones del cron solapadas) nunca devuelven la misma '
  'fila.';
