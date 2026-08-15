-- ============================================================
-- BOOKEA — cierra para `authenticated` lo que la 0140 dejó pendiente
-- a propósito para `anon`.
--
-- QUÉ PASABA (confirmado en vivo, no es hipótesis)
-- La 0140 ya diagnosticó y documentó esto en su propio comentario:
-- "`authenticated` conserva el permiso de tabla. O sea que cualquiera
-- con cuenta (y crearse una es gratis) todavía puede leer las cuentas
-- de cobro ajenas." Verificado: la política RLS "Todos ven los ranchos
-- aprobados" deja pasar a `authenticated` (y a `anon`) cualquier fila
-- con estado='aprobado' — o sea, CUALQUIER negocio publicado — y sin un
-- grant columna por columna, esa fila viene completa: sinpe_numero,
-- sinpe_titular, cuenta_banco, cuenta_numero, cuenta_titular,
-- cuenta_tipo incluidos. Cualquier cuenta gratuita, con su propia
-- sesión, podía pedirle a la API REST el SINPE de cualquier otro
-- proveedor.
--
-- POR QUÉ NO SE CERRÓ ANTES (y por qué SÍ se puede cerrar ahora)
-- La 0140 lo dejó así porque el panel del dueño (mi-negocio/[id]/
-- page.tsx) leía su PROPIA fila con `select("*")` usando la sesión
-- normal — cerrar el permiso de columna rompía esa lectura para todos,
-- dueños incluidos. Se resuelve en el mismo commit que esta migración:
-- esa lectura pasa a usar la llave de servicio (el panel YA verifica
-- por su cuenta que quien mira es el dueño o un colaborador antes de
-- pintar nada — `puedeEntrar` / `notFound()` —, así que leer con más
-- privilegio ahí no abre nada nuevo, solo dejan de depender del grant
-- ancho de la tabla). El flujo de reserva/depósito (crearReservaTemporal,
-- en src/app/eventos/reserva-actions.ts) ya usaba `createAdminClient()`
-- desde la 0140 — no depende de este grant y no se toca.
--
-- QUÉ HACE ESTA MIGRACIÓN
-- Exactamente lo mismo que la 0140 pero para `authenticated`: cambia el
-- permiso de tabla por uno columna por columna, con la misma lista
-- (todas menos las 6 de cobro), leída del esquema real.
-- ============================================================

do $$
declare
  columnas_publicas text;
begin
  if to_regclass('public.ranchos') is null then
    raise notice 'ranchos no existe todavía — no hay nada que revocar.';
    return;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'el rol authenticated no existe — no hay nada que revocar.';
    return;
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into columnas_publicas
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'ranchos'
     and column_name not in (
       'sinpe_numero',
       'sinpe_titular',
       'cuenta_banco',
       'cuenta_numero',
       'cuenta_titular',
       'cuenta_tipo'
     );

  if columnas_publicas is null then
    raise exception 'No se pudo leer el esquema de ranchos: no se revoca nada.';
  end if;

  -- Mismo criterio que la 0140: revoke + grant en el MISMO bloque, así
  -- o quedan los dos o no queda ninguno — nunca la tabla entera sin
  -- permiso para quien tiene sesión.
  execute 'revoke select on table public.ranchos from authenticated';
  execute format('grant select (%s) on table public.ranchos to authenticated', columnas_publicas);

  raise notice 'authenticated ahora lee ranchos columna por columna, sin las 6 de cobro.';
end $$;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- CÓMO COMPROBARLO
--
--   select column_name
--     from information_schema.column_privileges
--    where grantee = 'authenticated'
--      and table_name = 'ranchos'
--      and privilege_type = 'SELECT'
--      and column_name in (
--        'sinpe_numero', 'sinpe_titular', 'cuenta_banco',
--        'cuenta_numero', 'cuenta_titular', 'cuenta_tipo'
--      );
--
-- Tiene que devolver CERO filas.
-- ------------------------------------------------------------
