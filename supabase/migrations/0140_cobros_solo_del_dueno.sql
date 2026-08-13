-- ============================================================
-- BOOKEA — Las cuentas de cobro dejan de ser públicas
--
-- QUÉ PASABA
-- La 0008 hace `grant select on ranchos to anon`, a nivel TABLA. La
-- 0027 metió en ESA MISMA tabla los datos de cobro de cada proveedor
-- (sinpe_numero, sinpe_titular, cuenta_banco, cuenta_numero,
-- cuenta_titular, cuenta_tipo). Resultado: cualquiera con la llave
-- anónima —que es pública, viaja en el JavaScript del sitio y dentro
-- del .apk— podía pedirle a la API REST el SINPE y la cuenta bancaria
-- de TODOS los proveedores del país con un solo `curl`. Verificado.
--
-- Tapar las páginas (que fue lo primero que se hizo, con las listas de
-- src/lib/ranchos-publicos.ts) no alcanza: el permiso seguía dado y la
-- API contesta sin pasar por ninguna página.
--
-- QUÉ HACE ESTA MIGRACIÓN
-- Le cambia a `anon` el permiso de tabla por un permiso COLUMNA POR
-- COLUMNA con todas las columnas menos esas seis. El directorio, las
-- fichas y el buscador siguen leyendo lo de siempre; las cuentas de
-- cobro dejan de existir para quien no tiene sesión.
--
-- Las columnas no se enumeran a mano —olvidar una rompe una pantalla—
-- sino que se leen del esquema real en el momento de correr esto.
--
-- OJO, LO QUE ESTO **NO** ARREGLA
-- `authenticated` conserva el permiso de tabla. O sea que cualquiera
-- con cuenta (y crearse una es gratis) todavía puede leer las cuentas
-- de cobro ajenas. Se deja así a propósito: el panel del dueño en la
-- app (negocio/[id]/cobros.tsx) lee su propia fila con `select("*")`
-- autenticado, y quitarle la columna al rol lo rompe para todos —los
-- permisos de columna no distinguen filas. Cerrar eso pide un RPC
-- `security definer` que devuelva las cuentas solo del dueño y solo a
-- quien tenga una reserva viva, y toca el flujo de pago de la app: va
-- en su propia migración, con la app actualizada primero.
--
-- ORDEN DE DESPLIEGUE (importante — hay teléfonos con versiones viejas)
--   1. Publicar la web y la app SIN las columnas de cobro en las
--      pantallas públicas (ya hecho: listas explícitas).
--   2. Esperar a que la actualización de la app llegue a la gente.
--   3. Recién ahí pegar ESTE archivo.
--
-- CUANDO AGREGUES UNA COLUMNA NUEVA A `ranchos`
-- No queda pública sola: hay que volver a pegar este archivo (es
-- idempotente y recalcula la lista) o darle el permiso a mano con
-- `grant select (la_columna) on ranchos to anon`. Si una pantalla
-- pública deja de ver un campo recién agregado, es esto.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

do $$
declare
  columnas_publicas text;
begin
  -- La tabla podría no existir en una base a medio migrar.
  if to_regclass('public.ranchos') is null then
    raise notice 'ranchos no existe todavía — no hay nada que revocar.';
    return;
  end if;

  -- En una base que no sea Supabase el rol `anon` no existe.
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise notice 'el rol anon no existe — no hay nada que revocar.';
    return;
  end if;

  -- Todas las columnas MENOS las de cobro, leídas del esquema real.
  -- Si la 0027 no corrió, esos nombres simplemente no aparecen y la
  -- lista queda igual: no hay nada que esconder.
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

  -- Cinturón: si esto viniera vacío, el revoke de abajo dejaría el
  -- directorio entero a oscuras. Mejor fallar sin tocar nada.
  if columnas_publicas is null then
    raise exception 'No se pudo leer el esquema de ranchos: no se revoca nada.';
  end if;

  -- El revoke de tabla se lleva también los permisos por columna de
  -- una corrida anterior — por eso re-pegar este archivo es seguro y
  -- además recalcula la lista si aparecieron columnas nuevas.
  --
  -- Va en el MISMO bloque que el grant a propósito: un `do` es una
  -- sola sentencia, así que o quedan los dos o no queda ninguno. Si
  -- fueran dos sentencias sueltas y la segunda fallara, el sitio
  -- público se quedaba sin poder leer el directorio.
  execute 'revoke select on table public.ranchos from anon';
  execute format('grant select (%s) on table public.ranchos to anon', columnas_publicas);

  raise notice 'anon ahora lee ranchos columna por columna, sin las 6 de cobro.';
end $$;

-- PostgREST cachea el esquema y los permisos: sin esto, la API sigue
-- contestando con las reglas viejas hasta el próximo reinicio.
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- CÓMO COMPROBARLO (pegar aparte, después de correr lo de arriba)
--
--   select column_name
--     from information_schema.column_privileges
--    where grantee = 'anon'
--      and table_name = 'ranchos'
--      and privilege_type = 'SELECT'
--      and column_name in (
--        'sinpe_numero', 'sinpe_titular', 'cuenta_banco',
--        'cuenta_numero', 'cuenta_titular', 'cuenta_tipo'
--      );
--
-- Tiene que devolver CERO filas. Y desde afuera, con la llave anónima:
--
--   curl "$SUPABASE_URL/rest/v1/ranchos?select=sinpe_numero&limit=1" \
--        -H "apikey: $ANON_KEY"
--
-- tiene que contestar 403 con "permission denied for table ranchos".
-- ------------------------------------------------------------
