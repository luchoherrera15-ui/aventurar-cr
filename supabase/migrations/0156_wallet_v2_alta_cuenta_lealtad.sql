-- ============================================================
-- WALLET V2 — Migración A (parte 1): alta transaccional de cuenta+programa
--
-- Fase 2A (docs/wallet-v2/decisiones-tablas.md §2) encontró, con datos
-- reales, que el alta activa (`/lealtad/nuevo/actions.ts`) nunca crea
-- una fila en `cuentas` — sigue usando `ranchos` como si fuera la raíz
-- de identidad. Esta migración crea la ÚNICA función que de acá en
-- adelante hace esa alta, atómica y segura ante llamadas concurrentes.
--
-- No reemplaza el resto de `crearGratisAlInstante` (crear el rancho,
-- apagar módulos operativos, crear la recompensa, el addon) — esas
-- piezas siguen en TypeScript tal como están. Esta función resuelve
-- ÚNICAMENTE la identidad (cuenta + equipo + programa vinculado), que
-- es la parte que de verdad necesita atomicidad real: dos pestañas del
-- mismo dueño no deben poder terminar con dos cuentas.
--
-- `returns jsonb` y no `returns table(...)`: mismo patrón que
-- `acreditar_lealtad`/`canjear_recompensa`/`revertir_movimiento`
-- (0125) — y no es solo estilo. `returns table(cuenta_id uuid, ...)`
-- declara esos nombres como parámetros OUT, que DENTRO de la función
-- compiten por nombre con las columnas reales de `cuentas`/
-- `cuentas_equipo` (ambas tienen una columna `cuenta_id`). Se probó en
-- local: con `returns table` el `on conflict (cuenta_id, usuario_id)`
-- de más abajo falla con "column reference cuenta_id is ambiguous" —
-- error real, no hipotético, que esta forma evita de raíz.
--
-- SEGURIDAD: `p_owner_id` NUNCA debe venir del navegador — el llamador
-- (server action) lo resuelve de `supabase.auth.getUser()` en el
-- servidor, igual que ya hace `crearGratisAlInstante` hoy. Por eso el
-- EXECUTE de esta función es exclusivo de `service_role`: un usuario
-- autenticado normal no puede invocarla directo con un owner_id ajeno.
-- ============================================================

create or replace function public.alta_cuenta_lealtad(
  p_owner_id uuid,
  p_rancho_id uuid,
  p_limite_programas integer,
  p_programa jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta_id uuid;
  v_cuenta_creada boolean := false;
  v_programa_id uuid;
  v_plan_cuenta text;
  v_programas_actuales integer;
begin
  if p_owner_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'falta_owner_id');
  end if;
  if p_rancho_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'falta_rancho_id');
  end if;

  -- Lock por owner: serializa altas concurrentes DEL MISMO usuario
  -- (dos pestañas, doble tap, un retry de red). No frena a otros
  -- usuarios entre sí — mismo patrón que `pg_advisory_xact_lock` de
  -- `acreditar_lealtad` (0125), aplicado acá a la identidad en vez de
  -- al saldo.
  perform pg_advisory_xact_lock(hashtext('alta_cuenta_lealtad:' || p_owner_id::text));

  -- 1-2) Buscar cuenta compatible (por el rancho, que es la relación
  -- fuerte — dos cuentas para el mismo rancho no tendría sentido y ya
  -- está prohibido por el unique de 0134) antes de crear.
  select id, plan into v_cuenta_id, v_plan_cuenta
  from cuentas
  where rancho_id = p_rancho_id;

  -- 3) Crear solo si hace falta.
  if v_cuenta_id is null then
    insert into cuentas (nombre, slug, owner_id, rancho_id, plan)
    select r.nombre, coalesce(r.slug, 'cuenta-' || replace(gen_random_uuid()::text, '-', '')),
           p_owner_id, p_rancho_id, nullif(p_programa->>'plan', '')
    from ranchos r
    where r.id = p_rancho_id
    on conflict (rancho_id) do nothing
    returning id, plan into v_cuenta_id, v_plan_cuenta;

    if v_cuenta_id is null then
      -- Carrera real: otra sesión ganó el `on conflict`. Releer en vez
      -- de fallar — es exactamente lo que "segura ante concurrencia"
      -- pide: la segunda llamada no debe reventar, debe converger al
      -- mismo resultado que la primera.
      select id, plan into v_cuenta_id, v_plan_cuenta from cuentas where rancho_id = p_rancho_id;
    else
      v_cuenta_creada := true;
    end if;
  end if;

  if v_cuenta_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_se_pudo_resolver_cuenta');
  end if;

  -- 4) Garantizar al propietario en cuentas_equipo (idempotente por el
  -- unique(cuenta_id, usuario_id) de 0134).
  insert into cuentas_equipo (cuenta_id, usuario_id, rol)
  values (v_cuenta_id, p_owner_id, 'propietario')
  on conflict (cuenta_id, usuario_id) do nothing;

  -- 6) Validar el límite de programas del plan ANTES de crear —
  -- dentro de la misma transacción y del mismo lock que ya serializa
  -- las altas de este owner, no como un chequeo previo en JS que una
  -- llamada concurrente podría esquivar.
  select count(*) into v_programas_actuales
  from programa_lealtad
  where cuenta_id = v_cuenta_id and activo = true;

  if p_limite_programas is not null and v_programas_actuales >= p_limite_programas then
    return jsonb_build_object(
      'ok', false, 'motivo', 'limite_de_programas_alcanzado',
      'cuenta_id', v_cuenta_id, 'cuenta_creada', v_cuenta_creada
    );
  end if;

  -- 5) Crear el programa, YA con cuenta_id — nunca en dos pasos
  -- separados que puedan quedar a medias.
  insert into programa_lealtad (
    rancho_id, cuenta_id, nombre, modo, puntos_por_visita, puntos_por_colon,
    activo, estado, pase_color_fondo, pase_logo_url
  ) values (
    p_rancho_id, v_cuenta_id,
    coalesce(nullif(p_programa->>'nombre', ''), 'Programa de lealtad'),
    coalesce(nullif(p_programa->>'modo', ''), 'sellos'),
    coalesce((p_programa->>'puntos_por_visita')::integer, 1),
    coalesce((p_programa->>'puntos_por_colon')::numeric, 0),
    coalesce((p_programa->>'activo')::boolean, true),
    coalesce(nullif(p_programa->>'estado', ''), 'activo'),
    nullif(p_programa->>'pase_color_fondo', ''),
    nullif(p_programa->>'pase_logo_url', '')
  )
  returning id into v_programa_id;

  -- Si la cuenta no tenía plan (recién creada sin uno, o backfill
  -- viejo sin plan asignado), este alta se lo pone — nunca lo pisa si
  -- ya tenía uno.
  if v_plan_cuenta is null and nullif(p_programa->>'plan', '') is not null then
    update cuentas set plan = p_programa->>'plan' where id = v_cuenta_id and plan is null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'motivo', 'ok',
    'cuenta_id', v_cuenta_id,
    'programa_id', v_programa_id,
    'cuenta_creada', v_cuenta_creada,
    'programa_creado', true
  );
end;
$$;

comment on function public.alta_cuenta_lealtad(uuid, uuid, integer, jsonb) is
  'Alta atómica de cuenta+equipo+programa de Lealtad (Wallet V2, Fase 2B). '
  'p_owner_id nunca debe venir del navegador. Solo service_role.';

revoke all on function public.alta_cuenta_lealtad(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.alta_cuenta_lealtad(uuid, uuid, integer, jsonb) to service_role;
