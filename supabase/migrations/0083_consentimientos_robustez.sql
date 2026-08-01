-- ============================================================
-- BOOKEA — Endurecer el consentimiento de correo (0083)
-- Cierra defectos encontrados revisando la 0082 antes de salir a
-- producción. Todos son de la misma familia: el filtro de envíos
-- resolvía la precedencia trayendo filas a memoria, y eso falla
-- ABIERTO — que en esta tabla significa mandarle la campaña justo a
-- quien pidió que no le escribieran.
--
--   1. `seq`: un desempate MONÓTONO. El estado vigente se busca con
--      `order by created_at desc` y el desempate era el uuid, que es
--      aleatorio. Dos filas insertadas en la MISMA transacción llevan
--      el mismo `created_at` (now() es transaction_timestamp), así que
--      el ganador salía a cara o cruz.
--
--   2. Los CHECK de `correo` no exigían lo mismo que normaliza el
--      código. `trim()` de Postgres recorta SOLO el espacio ASCII;
--      `.trim()` de JavaScript recorta además \t \n \r y más. Un
--      correo guardado con un \r al final pasaba el CHECK, y después
--      el filtro nunca lo encontraba: una baja registrada que jamás
--      surtía efecto.
--
--   3. `correos_bloqueados_marketing`: la precedencia completa para
--      una LISTA, resuelta en la base. Es lo que faltaba para que el
--      filtro de campañas no dependa de cuántas filas quepan en una
--      respuesta de PostgREST.
--
--   4. Ninguna función nace ejecutable por todo el mundo. El revoke de
--      la 0082 está clavado a una firma; la próxima sobrecarga de
--      `acepta_marketing` nacería con EXECUTE a PUBLIC y se volvería
--      un oráculo para preguntar si el correo de un tercero rebotó o
--      se dio de baja.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Desempate monótono del ledger
-- ------------------------------------------------------------

alter table consentimientos
  add column if not exists seq bigint generated always as identity;

comment on column consentimientos.seq is
  'Desempate monótono del ledger. El uuid es aleatorio y created_at se repite dentro de una misma transacción: sin esto, el estado vigente lo decidía el azar.';

-- El índice que sirve la búsqueda del estado vigente, ya con el
-- desempate correcto.
create index if not exists consentimientos_vigente_seq_idx
  on consentimientos (correo, rancho_id, created_at desc, seq desc);

-- ------------------------------------------------------------
-- 2. Normalización de verdad del correo
-- ------------------------------------------------------------
-- Se AGREGAN constraints nuevas en vez de reemplazar las de la 0082:
-- aquellas son anónimas y adivinar el nombre que les puso Postgres es
-- frágil. Con las dos puestas manda la más estricta, que es lo que se
-- busca.
--
-- `not valid` a propósito: aplica a todo lo que entre de ahora en
-- adelante sin fallar si quedó alguna fila vieja mal normalizada. Se
-- validan aparte, y si alguna no pasa se avisa en vez de tumbar la
-- migración entera.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'consentimientos_correo_normalizado'
  ) then
    alter table consentimientos
      add constraint consentimientos_correo_normalizado
      check (correo = lower(btrim(correo, E' \t\n\r\f\v')) and correo !~ '\s')
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'supresiones_correo_normalizado'
  ) then
    alter table supresiones_correo
      add constraint supresiones_correo_normalizado
      check (
        correo = lower(btrim(correo, E' \t\n\r\f\v'))
        and correo !~ '\s'
        and position('@' in correo) > 1
      )
      not valid;
  end if;
end $$;

do $$
begin
  alter table consentimientos validate constraint consentimientos_correo_normalizado;
exception when others then
  raise warning 'Hay correos mal normalizados en consentimientos: %', sqlerrm;
end $$;

do $$
begin
  alter table supresiones_correo validate constraint supresiones_correo_normalizado;
exception when others then
  raise warning 'Hay correos mal normalizados en supresiones_correo: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 3. La precedencia completa, para una lista, resuelta en la base
-- ------------------------------------------------------------
-- Devuelve SOLO los correos a los que NO se les puede escribir. El
-- que llama manda su lista y descarta lo que vuelva: así el resultado
-- es siempre más chico que la entrada y no hay forma de que un recorte
-- de la respuesta deje pasar a alguien que se dio de baja.
--
-- Misma precedencia que `acepta_marketing` (0082), en un solo viaje:
--   suprimido                          -> bloqueado
--   última fila de plataforma revocada -> bloqueado
--   última fila del negocio revocada   -> bloqueado

create or replace function public.correos_bloqueados_marketing(
  p_correos text[],
  p_rancho_id uuid default null
)
returns table (correo text)
language sql
stable
security definer
set search_path = public
as $$
  with entrada as (
    select distinct lower(btrim(c, E' \t\n\r\f\v')) as correo
    from unnest(coalesce(p_correos, '{}'::text[])) as c
    where c is not null and position('@' in btrim(c)) > 1
  ),
  suprimidos as (
    select e.correo
    from entrada e
    join supresiones_correo s on s.correo = e.correo
  ),
  vigente_plataforma as (
    select distinct on (c.correo) c.correo, c.estado
    from consentimientos c
    join entrada e on e.correo = c.correo
    where c.rancho_id is null
    order by c.correo, c.created_at desc, c.seq desc
  ),
  vigente_negocio as (
    select distinct on (c.correo) c.correo, c.estado
    from consentimientos c
    join entrada e on e.correo = c.correo
    where p_rancho_id is not null and c.rancho_id = p_rancho_id
    order by c.correo, c.created_at desc, c.seq desc
  )
  select s.correo from suprimidos s
  union
  select v.correo from vigente_plataforma v where v.estado = 'revocado'
  union
  select n.correo from vigente_negocio n where n.estado = 'revocado';
$$;

-- ------------------------------------------------------------
-- 4. Nada de esto lo ejecuta un usuario cualquiera
-- ------------------------------------------------------------
-- Responden sí/no sobre el correo de un tercero: con EXECUTE abierto,
-- cualquiera con una cuenta gratis podría averiguar si una dirección
-- ajena rebotó o se dio de baja — dato personal, art. 3 de la 8968.

revoke execute on function public.correos_bloqueados_marketing(text[], uuid)
  from public, anon, authenticated;
grant execute on function public.correos_bloqueados_marketing(text[], uuid)
  to service_role;

-- Y que la próxima función que alguien agregue no nazca abierta: el
-- revoke de la 0082 estaba clavado a una firma, así que una sobrecarga
-- nueva de `acepta_marketing` (un parámetro más en la Fase 4) se
-- crearía con EXECUTE a PUBLIC sin que nadie lo note.
alter default privileges in schema public revoke execute on functions from public;

notify pgrst, 'reload schema';
