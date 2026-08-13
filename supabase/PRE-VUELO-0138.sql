-- ============================================================
-- PRE-VUELO DE LA 0138 — correr ESTO antes de pegar la migración
--
-- Una revisión adversarial encontró, y REPRODUJO en un Postgres 15,
-- que la 0138 vuelve a morir si la base trae restos de un intento
-- anterior. No es una teoría: es el sexto error de la serie, y este
-- archivo existe para que no cueste otra vuelta.
--
-- ── POR QUÉ PASA ─────────────────────────────────────────────────
--
-- `create table if not exists public.personas` SALTA LA DEFINICIÓN
-- ENTERA si la tabla ya existe. El bloque de `add column if not
-- exists` que viene después repone SOLO siete columnas —las que se
-- agregaron tarde— y NO repone `origen`, `pais`, `telefono`, `correo`,
-- `nombre`, `cliente_id`, `created_at`, `updated_at`, ni ninguno de
-- los constraints.
--
-- O sea: si `personas` quedó a medias de un intento viejo, el
-- `insert into personas (… origen …)` de `resolver_persona` muere con
-- «42703: column "origen" does not exist».
--
-- Y hay una variante PEOR, silenciosa: si la tabla vieja sí tiene
-- todas las columnas pero le faltan los checks, la migración entra
-- limpia y esos checks no existen NUNCA. Nadie se entera hasta que un
-- dato malo pasa por donde debería haber rebotado.
--
-- ── CÓMO SE USA ──────────────────────────────────────────────────
-- 1. Pegá y corré el PASO 1. Son cuatro preguntas, no escribe nada.
-- 2. Según lo que responda, corré o no el PASO 2.
-- 3. Recién ahí pegá la 0138 completa.
-- ============================================================


-- ------------------------------------------------------------
-- PASO 1 — LAS CUATRO PREGUNTAS (no escribe nada)
-- ------------------------------------------------------------

select
  'personas ya existe (restos de un intento anterior)' as pregunta,
  to_regclass('public.personas') is not null as respuesta,
  'Si es TRUE → corré el PASO 2 antes de pegar la 0138' as que_hacer

union all
select
  'clientes_negocio existe (0109 pegada)',
  to_regclass('public.clientes_negocio') is not null,
  'Solo informativo: la 0138 ya lo tolera en los dos casos'

union all
select
  'programa_lealtad.estado existe (0125 pegada)',
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'programa_lealtad'
       and column_name = 'estado'
  ),
  'Si es FALSE → el alta por QR va a fallar EN EL MOSTRADOR, no al pegar. Avisá.'

union all
select
  'postgres es dueño de auth.users (hace falta para el trigger)',
  exists (
    select 1 from pg_tables
     where schemaname = 'auth' and tablename = 'users' and tableowner = 'postgres'
  ),
  'Si es FALSE → sacá las 4 líneas del trigger on_auth_user_persona de la 0138';


-- ------------------------------------------------------------
-- PASO 2 — EL RESET, solo si la primera pregunta dio TRUE
--
-- Verificado: después de correr esto, la 0138 completa entra con CERO
-- errores.
--
-- ¿Es seguro borrar? Sí, en esta situación: estas tablas son de la
-- 0138 y la 0138 NUNCA llegó a terminar, así que no hay una sola
-- persona real adentro. Lo que se borra son los restos a medio hacer
-- de cinco intentos fallidos.
--
-- >>> SI ALGUNA VEZ LLEGA A HABER DATOS DE VERDAD ACÁ, NO CORRAS ESTO. <<<
-- Comprobalo primero:
--     select count(*) from personas;   -- tiene que dar 0
-- ------------------------------------------------------------

/*  ← Borrá esta línea y la del final para habilitarlo

-- La vista primero: depende de las tablas de abajo.
drop view if exists public.vista_personas_negocio;

-- ESTA LÍNEA ES LA QUE TODOS OLVIDAN, y sin ella el re-pegado vuelve a
-- morir en el índice único de miembros. `drop table personas cascade`
-- se lleva la FOREIGN KEY, pero NO la columna: `miembros.persona_id`
-- sobrevive con datos viejos adentro.
alter table public.miembros drop column if exists persona_id;

drop table if exists public.sesiones_persona cascade;
drop table if exists public.verificaciones_canal cascade;
drop table if exists public.consentimientos_persona cascade;
drop table if exists public.personas_duplicados cascade;
drop table if exists public.personas_negocio cascade;
drop table if exists public.personas cascade;

*/  ← y esta


-- ------------------------------------------------------------
-- COMPROBACIÓN OPCIONAL — datos sucios de un backfill viejo
--
-- Si un intento anterior corrió el backfill de `miembros` con una
-- versión de `resolver_persona` que todavía no distinguía dos cuentas
-- distintas, pudo fundir a dos socios del mismo programa en una sola
-- persona. El índice único nuevo no se puede crear contra eso.
--
-- Si el PASO 2 se corrió, esto ya no aplica (la columna no existe).
-- ------------------------------------------------------------

-- select programa_id, persona_id, count(*)
--   from public.miembros
--  where persona_id is not null
--  group by 1, 2
-- having count(*) > 1;
--
-- Cero filas = limpio. Filas = corré el PASO 2.
