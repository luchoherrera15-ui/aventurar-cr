-- ============================================================
-- BOOKEA — Canjear VARIOS premios a la vez, todo o nada (0257)
--
-- Pedido del dueño (Foorkie, 20 nov 2026): «tengo 100 puntos y canjeo 4
-- cosas de 25 puntos; si intento canjear algo superior, me tira un error
-- de que no tengo esa cantidad de puntos».
--
-- `canjear_recompensa` (0125) entrega UN premio por llamada. Entregar
-- varios con varias llamadas no sirve: si la tercera no alcanza, las dos
-- primeras ya se descontaron y el cliente se va con la mitad. Esta función
-- recibe la lista completa y la resuelve en UNA transacción:
--
--   · el MISMO lock por miembro (`lealtad:<miembro>`) que acreditar,
--     canjear y revertir: dos cajas a la vez no gastan el mismo saldo;
--   · se VALIDA TODO ANTES DE ESCRIBIR: la membresía, la tarjeta, cada
--     premio (de esta tarjeta, activo, vigente, con stock y con límite por
--     cliente teniendo en cuenta la CANTIDAD pedida) y el saldo contra el
--     TOTAL. Si algo falla devuelve `ok:false` con su `codigo` y no se
--     escribe nada;
--   · si todo vale, escribe UNA fila de `transacciones_puntos` y UNA de
--     `canjes` POR UNIDAD (así el historial, el stock y la reversión de la
--     0139 siguen siendo por premio), con el saldo encadenado
--     (`saldo_anterior` → `saldo_posterior`), y marca el espejo del pase
--     (`pases_wallet.saldo_cache`) UNA vez al final;
--   · es IDEMPOTENTE por intento: la referencia de cada unidad es
--     `<p_referencia_base>:<n>` (n = 1, 2, 3… en el orden pedido), y si ya
--     hay canjes de este miembro con esa base contesta `ya_estaba` con lo
--     que se entregó, sin descontar de nuevo. Se mira ANTES que el saldo:
--     el reintento de un canje que vació la tarjeta no puede contestar
--     «no alcanza».
--
-- `p_referencia_base` la arma el servidor (`referenciaCanjeVarios`,
-- src/lib/lealtad/canje-varios.ts): `canje:<miembro>:<intento>`. Es de la
-- forma de `canje:<miembro>:<recompensa>:<intento>` (un premio, 0125) sin
-- chocar con ella: la unidad lleva un NÚMERO al final.
--
-- `p_items` = [{"recompensa_id": uuid, "cantidad": entero}, …]. Un mismo
-- premio repetido se SUMA. Topes aquí, solo para acotar el trabajo y el
-- largo de la referencia: 100 por renglón y 100 en total; los topes de
-- negocio (10 renglones, 20 por renglón, 30 en total) los pone la API.
--
-- Devuelve:
--   {ok:false, codigo, motivo[, saldo, total]}
--   {ok:true, ya_estaba:false, saldo, total_puntos, items:[…], canjes:[…]}
--   {ok:true, ya_estaba:true,  saldo, total_puntos, items:[…]}
-- con `items` = [{recompensa_id, recompensa, sku, instrucciones, cantidad,
-- puntos (costo de UNA unidad)}] y `canjes` = [{canje_id, recompensa_id,
-- recompensa, sku, puntos, saldo (el que quedó tras esa unidad)}].
--
-- Solo service_role (como el resto del canje): quién opera y de qué negocio
-- es el miembro lo comprueba el servidor ANTES de llamar.
--
-- Es seguro correr esta migración varias veces. No toca datos ni tablas.
--
-- ── VOLVER ATRÁS ────────────────────────────────────────────
--   drop function if exists public.canjear_recompensas_varias(uuid, jsonb, uuid, text);
-- Lo canjeado con la función son filas normales de `canjes` y
-- `transacciones_puntos`: no hace falta tocarlas (se revierten con
-- `revertir_movimiento`, como cualquier canje). Sin la función, la ruta de
-- la caja contesta `sin_migracion` y no hace nada.
-- ============================================================

create or replace function public.canjear_recompensas_varias(
  p_miembro_id uuid,
  p_items jsonb,
  p_usuario_id uuid,
  p_referencia_base text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := nullif(trim(p_referencia_base), '');
  v_prefijo text;
  v_el jsonb;
  v_txt text;
  v_cant_txt text;
  v_cant integer;
  v_uuid uuid;
  v_pos integer;
  v_ids uuid[] := '{}';
  v_cants integer[] := '{}';
  v_unidades integer := 0;
  v_previos integer;
  v_total_previo bigint;
  v_items_previos jsonb;
  v_miembro record;
  v_programa record;
  v_estado text;
  v_hoy date;
  v_rec record;
  v_canjeados integer;
  v_del_cliente integer;
  v_saldo bigint;
  v_total bigint := 0;
  v_actual bigint;
  v_plan jsonb := '[]'::jsonb;
  v_canjes jsonb := '[]'::jsonb;
  v_i integer;
  v_u integer;
  v_n integer := 0;
  v_ref text;
  v_tx_id uuid;
  v_canje_id uuid;
begin
  -- ── La forma del pedido (no lee nada de la base) ──────────────
  if p_miembro_id is null or v_base is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_referencia',
      'motivo', 'Falta la llave de la operación.');
  end if;
  if char_length(v_base) > 90 then
    return jsonb_build_object('ok', false, 'codigo', 'sin_referencia',
      'motivo', 'La llave de la operación es demasiado larga.');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'datos',
      'motivo', 'No hay premios para canjear.');
  end if;

  -- Un renglón por premio; el mismo premio repetido se suma (el stock y el
  -- límite por cliente se miran contra la cantidad TOTAL de ese premio).
  for v_el in select e.v from jsonb_array_elements(p_items) with ordinality as e(v, ord) order by e.ord
  loop
    if jsonb_typeof(v_el) is distinct from 'object' then
      return jsonb_build_object('ok', false, 'codigo', 'datos',
        'motivo', 'Cada renglón tiene que traer el premio y la cantidad.');
    end if;
    v_txt := v_el ->> 'recompensa_id';
    v_cant_txt := v_el ->> 'cantidad';
    if v_txt is null
       or v_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or v_cant_txt is null
       or v_cant_txt !~ '^[0-9]{1,3}$' then
      return jsonb_build_object('ok', false, 'codigo', 'datos',
        'motivo', 'Cada renglón tiene que traer el premio y una cantidad entera.');
    end if;
    v_cant := v_cant_txt::integer;
    if v_cant < 1 or v_cant > 100 then
      return jsonb_build_object('ok', false, 'codigo', 'datos',
        'motivo', 'La cantidad de cada premio tiene que ser de 1 a 100.');
    end if;
    v_uuid := v_txt::uuid;
    v_pos := array_position(v_ids, v_uuid);
    if v_pos is null then
      v_ids := v_ids || v_uuid;
      v_cants := v_cants || v_cant;
    else
      v_cants[v_pos] := v_cants[v_pos] + v_cant;
    end if;
    v_unidades := v_unidades + v_cant;
    if v_unidades > 100 then
      return jsonb_build_object('ok', false, 'codigo', 'datos',
        'motivo', 'Son demasiados premios en un solo canje.');
    end if;
  end loop;

  -- El MISMO lock que acreditar_lealtad, canjear_recompensa y
  -- revertir_movimiento: todo lo que mueve el saldo de este miembro va de
  -- a uno.
  perform pg_advisory_xact_lock(hashtext('lealtad:' || p_miembro_id::text));

  -- ── La idempotencia, PRIMERO ──────────────────────────────────
  -- Las unidades de un intento llevan `<base>:<n>`. Se compara el texto
  -- (`starts_with`, sin comodines de LIKE) y se exige que lo que sigue sea
  -- solo el número: así `canje:<miembro>:<recompensa>:<intento>` (un
  -- premio, 0125) nunca se confunde con una unidad de acá.
  v_prefijo := v_base || ':';
  with u as (
    select c.recompensa_id, c.puntos,
           substr(c.referencia, char_length(v_prefijo) + 1)::integer as n
      from canjes c
     where c.miembro_id = p_miembro_id
       and c.referencia is not null
       and starts_with(c.referencia, v_prefijo)
       and substr(c.referencia, char_length(v_prefijo) + 1) ~ '^[0-9]{1,4}$'
  )
  select count(*), coalesce(sum(u.puntos), 0),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'recompensa_id', g.recompensa_id,
                    'recompensa', coalesce(r.nombre, ''),
                    'sku', r.sku,
                    'instrucciones', r.instrucciones,
                    'cantidad', g.cantidad,
                    'puntos', g.puntos
                  ) order by g.primero)
             from (
               select u2.recompensa_id, u2.puntos, count(*)::integer as cantidad, min(u2.n) as primero
                 from u u2
                group by u2.recompensa_id, u2.puntos
             ) g
             left join recompensas r on r.id = g.recompensa_id
         ), '[]'::jsonb)
    into v_previos, v_total_previo, v_items_previos
    from u;

  select coalesce(sum(puntos), 0) into v_saldo
    from transacciones_puntos
   where miembro_id = p_miembro_id;

  if v_previos > 0 then
    return jsonb_build_object('ok', true, 'ya_estaba', true, 'saldo', v_saldo,
      'total_puntos', v_total_previo, 'items', v_items_previos);
  end if;

  -- ── La membresía y la tarjeta ─────────────────────────────────
  select m.id, m.estado, m.programa_id, m.persona_id, m.cliente_id
    into v_miembro
    from miembros m
   where m.id = p_miembro_id;
  if v_miembro.id is null or v_miembro.estado <> 'activa' then
    return jsonb_build_object('ok', false, 'codigo', 'membresia_inactiva',
      'motivo', 'Esa membresía no está activa.');
  end if;

  select p.*, r.zona_horaria into v_programa
    from programa_lealtad p
    join ranchos r on r.id = p.rancho_id
   where p.id = v_miembro.programa_id;

  -- Estado efectivo: el mismo criterio que canjear_recompensa (0125).
  v_estado := coalesce(v_programa.estado,
                       case when v_programa.activo then 'activo' else 'pausado' end);
  if v_estado <> 'activo' then
    return jsonb_build_object('ok', false, 'codigo', 'programa_no_opera',
      'motivo', 'El programa está en estado ' || v_estado || ' y no canjea.');
  end if;

  -- La perilla de la 0138 (el trigger de `canjes` también la frena, pero
  -- con una excepción): sin canal probado no se canjea.
  if coalesce(v_programa.exige_verificacion_para_canjear, false)
     and v_miembro.cliente_id is null
     and v_miembro.persona_id is not null
     and not public.persona_verificada(v_miembro.persona_id) then
    return jsonb_build_object('ok', false, 'codigo', 'verificacion_pendiente',
      'motivo', 'Falta confirmar el WhatsApp o el correo antes de canjear.');
  end if;

  -- ── Cada premio, con su cantidad ──────────────────────────────
  v_hoy := (now() at time zone coalesce(v_programa.zona_horaria, 'America/Costa_Rica'))::date;

  for v_i in 1 .. array_length(v_ids, 1)
  loop
    select * into v_rec from recompensas where id = v_ids[v_i];
    if v_rec.id is null or v_rec.programa_id <> v_miembro.programa_id then
      -- El mismo mensaje para «no existe» y «es de otra tarjeta»: no se
      -- delata qué premios existen fuera de este negocio.
      return jsonb_build_object('ok', false, 'codigo', 'recompensa_ajena',
        'motivo', 'Alguno de esos premios no es de esta tarjeta.');
    end if;
    if not v_rec.activo then
      return jsonb_build_object('ok', false, 'codigo', 'recompensa_no_disponible',
        'motivo', format('«%s» está desactivada.', v_rec.nombre));
    end if;
    if v_rec.vigencia_desde is not null and v_hoy < v_rec.vigencia_desde then
      return jsonb_build_object('ok', false, 'codigo', 'recompensa_no_disponible',
        'motivo', format('«%s» todavía no está vigente.', v_rec.nombre));
    end if;
    if v_rec.vigencia_hasta is not null and v_hoy > v_rec.vigencia_hasta then
      return jsonb_build_object('ok', false, 'codigo', 'recompensa_no_disponible',
        'motivo', format('«%s» ya venció.', v_rec.nombre));
    end if;

    -- Stock y límite por cliente se CUENTAN bajo el lock, no se descuentan
    -- de un contador (el número nunca se desincroniza); los anulados no
    -- ocupan stock. Lo pedido cuenta: canjeados + cantidad ≤ tope.
    if v_rec.stock_total is not null then
      select count(*) into v_canjeados from canjes
       where recompensa_id = v_rec.id and estado <> 'anulado';
      if v_canjeados + v_cants[v_i] > v_rec.stock_total then
        return jsonb_build_object('ok', false, 'codigo', 'agotada',
          'motivo', case
            when v_canjeados >= v_rec.stock_total
              then format('«%s» se agotó.', v_rec.nombre)
            else format('De «%s» solo quedan %s y el pedido lleva %s.',
                        v_rec.nombre, v_rec.stock_total - v_canjeados, v_cants[v_i])
          end);
      end if;
    end if;
    if v_rec.limite_por_cliente is not null then
      select count(*) into v_del_cliente from canjes
       where recompensa_id = v_rec.id and miembro_id = p_miembro_id
         and estado <> 'anulado';
      if v_del_cliente + v_cants[v_i] > v_rec.limite_por_cliente then
        return jsonb_build_object('ok', false, 'codigo', 'limite_alcanzado',
          'motivo', case
            when v_del_cliente >= v_rec.limite_por_cliente
              then format('Este cliente ya canjeó su máximo de «%s».', v_rec.nombre)
            else format('Este cliente solo puede canjear %s más de «%s» y el pedido lleva %s.',
                        v_rec.limite_por_cliente - v_del_cliente, v_rec.nombre, v_cants[v_i])
          end);
      end if;
    end if;

    v_total := v_total + v_rec.costo_puntos::bigint * v_cants[v_i];
    v_plan := v_plan || jsonb_build_object(
      'recompensa_id', v_rec.id,
      'recompensa', v_rec.nombre,
      'sku', v_rec.sku,
      'instrucciones', v_rec.instrucciones,
      'cantidad', v_cants[v_i],
      'puntos', v_rec.costo_puntos
    );
  end loop;

  -- ── El saldo, contra el TOTAL ─────────────────────────────────
  -- Lo último: es lo único que el cliente puede resolver volviendo con más
  -- puntos. `v_saldo` se sumó del ledger BAJO el lock, no de un contador.
  if v_saldo < v_total then
    return jsonb_build_object('ok', false, 'codigo', 'saldo_insuficiente',
      'saldo', v_saldo, 'total', v_total,
      'motivo', 'Saldo insuficiente: tiene ' || v_saldo || ' y el total cuesta ' || v_total || '.');
  end if;

  -- ── Ya está todo validado: se escribe ─────────────────────────
  -- Cualquier error de acá para abajo revienta la llamada entera y la
  -- transacción deshace TODO lo escrito (no queda un canje a medias).
  v_actual := v_saldo;
  for v_i in 1 .. jsonb_array_length(v_plan)
  loop
    v_el := v_plan -> (v_i - 1);
    for v_u in 1 .. (v_el ->> 'cantidad')::integer
    loop
      v_n := v_n + 1;
      v_ref := v_prefijo || v_n::text;

      insert into transacciones_puntos
        (miembro_id, tipo, puntos, motivo, referencia,
         saldo_anterior, saldo_posterior, usuario_id)
      values
        (p_miembro_id, 'canjeado', -(v_el ->> 'puntos')::integer,
         left('Canje: ' || (v_el ->> 'recompensa'), 200), v_ref,
         v_actual, v_actual - (v_el ->> 'puntos')::integer, p_usuario_id)
      returning id into v_tx_id;

      insert into canjes
        (miembro_id, recompensa_id, puntos, estado, transaccion_id,
         entregado_en, entregado_por, referencia)
      values
        (p_miembro_id, (v_el ->> 'recompensa_id')::uuid, (v_el ->> 'puntos')::integer,
         'entregado', v_tx_id, now(), p_usuario_id, v_ref)
      returning id into v_canje_id;

      v_actual := v_actual - (v_el ->> 'puntos')::integer;
      v_canjes := v_canjes || jsonb_build_object(
        'canje_id', v_canje_id,
        'recompensa_id', v_el ->> 'recompensa_id',
        'recompensa', v_el ->> 'recompensa',
        'sku', v_el -> 'sku',
        'puntos', (v_el ->> 'puntos')::integer,
        'saldo', v_actual
      );
    end loop;
  end loop;

  -- El espejo del pase, UNA vez y en la MISMA transacción (como
  -- canjear_recompensa): sin `actualizado_en` el iPhone pregunta «¿qué
  -- cambió?» y se lleva un 204.
  update pases_wallet
     set saldo_cache = v_actual, actualizado_en = now()
   where miembro_id = p_miembro_id;

  return jsonb_build_object(
    'ok', true, 'ya_estaba', false,
    'saldo', v_actual, 'total_puntos', v_total,
    'items', v_plan, 'canjes', v_canjes
  );
end;
$$;

comment on function public.canjear_recompensas_varias(uuid, jsonb, uuid, text) is
  'Canje de VARIOS premios a la vez, todo o nada (0257): valida todo y el saldo '
  'contra el total antes de escribir, y entonces escribe una fila de ledger y una '
  'de canjes por unidad, con el saldo encadenado. Lock por miembro; idempotente '
  'por p_referencia_base (canje:<miembro>:<intento>, cada unidad lleva :<n>). '
  'Solo service_role: la tarjeta y quién opera los comprueba el servidor antes '
  'de llamar.';

-- Mismo criterio que la 0125 y la 0253: la 0083 revocó EXECUTE por defecto,
-- y un RPC que mueve saldo va SOLO a service_role.
revoke all on function public.canjear_recompensas_varias(uuid, jsonb, uuid, text)
  from public, anon, authenticated;
grant execute on function public.canjear_recompensas_varias(uuid, jsonb, uuid, text)
  to service_role;
