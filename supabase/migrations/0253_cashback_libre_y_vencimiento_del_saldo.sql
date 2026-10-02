-- ============================================================
-- BOOKEA — El cashback se usa en el monto que el cliente quiera,
-- y el saldo de las tarjetas de Foorkie puede vencer (0253)
--
-- ⚠️ NO ESTÁ CORRIDA. Se escribió el 2 oct 2026 y se pega a mano en el
-- SQL Editor de Supabase (o con scripts/aplicar-migracion.mjs). Es
-- idempotente: correrla dos veces no cambia nada la segunda.
--
-- ------------------------------------------------------------
-- QUÉ PIDIÓ EL DUEÑO (desde el panel de Foorkie)
-- ------------------------------------------------------------
--   1. «¿La tarjeta del cashback cómo está funcionando, que veo que dice
--      algo de 1000? La forma correcta es que uno acumule cashback y
--      cuando la persona desee canjear, lo hará.»
--   2. «Colocar más configuraciones en la tarjeta, tipo poder setear de
--      cuándo a cuándo vencen los puntos.»
--
-- ------------------------------------------------------------
-- 1. CANJE LIBRE: `canjear_monto_lealtad`
-- ------------------------------------------------------------
-- `canjear_recompensa` (0125) descuenta un costo FIJO —el de una
-- recompensa—, y por eso el cashback se usaba en tramos de ₡1 000
-- (`TRAMO_CASHBACK`, src/lib/lealtad/mostrador.ts; el pase decía
-- «CANJEÁ POR ₡1 000 de tu cashback»). Esta función descuenta el MONTO
-- que el cliente quiera, con las MISMAS garantías que el canje de premios:
--
--   · el MISMO lock por miembro (`lealtad:<miembro>`) que acreditar,
--     canjear y revertir: dos cajas a la vez no gastan el mismo saldo;
--   · el saldo se SUMA del ledger bajo ese lock, nunca se lee de un
--     contador;
--   · IDEMPOTENTE por la referencia (`canje:<miembro>:cashback:<intento>`,
--     la arma el servidor de Bookea con el `intento_id` de Foorkie): se
--     mira PRIMERO —un reintento de algo que ya se descontó contesta
--     `ya_estaba`, aunque el saldo ya no alcance— y el índice único
--     `(miembro_id, referencia)` de la 0060 es el respaldo;
--   · un movimiento `canjeado` negativo con su motivo («Canje: Cashback
--     usado (Caja Foorkie · Ana)»): queda explicado para siempre y la
--     reversión de la 0139 lo puede deshacer como cualquier otro;
--   · el espejo del pase (`pases_wallet.saldo_cache` + `actualizado_en`)
--     se marca ADENTRO de la transacción, igual que `canjear_recompensa`;
--     el aviso a Apple y a Google lo manda el servidor después
--     (`avisarCambioDePase(miembro, "canjear")`, que además lleva el
--     mensaje automático «canjear» de las tarjetas de Foorkie).
--
-- SOLO en tarjetas de cashback con `beneficio.canjeLibre = true` (hoy, las
-- de Foorkie). El mínimo de una vez es `beneficio.minimoCanje` (colones
-- enteros; ausente = desde ₡1) y se hace cumplir ACÁ, bajo el lock. La
-- verificación de la 0138 (`exige_verificacion_para_canjear`) también:
-- este canje no inserta en `canjes` (no hay recompensa), así que su
-- trigger no lo vería.
--
-- NO escribe en `canjes`: esa tabla es de premios (`recompensa_id` es not
-- null) y el uso del cashback no es un premio. El ledger es la verdad del
-- saldo, el historial de la caja lo lee de ahí y la Actividad de Bookea
-- también.
--
-- ------------------------------------------------------------
-- 2. LAS TARJETAS DE FOORKIE QUE YA EXISTEN PASAN A CANJE LIBRE
-- ------------------------------------------------------------
-- Las tarjetas de cashback de los locales de Foorkie
-- (`foorkie_restaurantes.lealtad_por_foorkie = true`; hoy Donde George)
-- reciben `canjeLibre: true` en su `beneficio`. Las NUEVAS lo traen del
-- alta de Foorkie (`/api/plataforma/foorkie/negocio`) y las reglas que
-- guarde el restaurante lo confirman (`programa/reglas/guardar`).
--
-- Las tarjetas de Bookea —Pura Matcha y todas las propias— NO se tocan:
-- siguen canjeando en tramos y su pase sale byte por byte igual.
--
-- Los pases ya instalados cambian el texto («Usalo cuando quieras» en vez
-- de «CANJEÁ POR ₡1 000 de tu cashback») en su próximo refresco natural:
-- una compra, un canje, o guardar las Reglas de la tarjeta en Foorkie
-- (que avisa a todos los pases).
--
-- ------------------------------------------------------------
-- 3. EL VENCIMIENTO DEL SALDO (cashback y puntos, solo Foorkie)
-- ------------------------------------------------------------
-- La 0180 dejó el vencimiento por inactividad SOLO para sellos. Para las
-- tarjetas de Foorkie el restaurante ahora decide si su cashback o sus
-- puntos vencen («si el cliente no usa la tarjeta en N meses»). No hace
-- falta ninguna columna nueva: son las MISMAS de la 0180
-- (`sellos_vencen_meses` y `sellos_vencen_desde`), con el mismo reloj por
-- cliente —max(último movimiento, desde) + meses, nada retroactivo—, la
-- misma idempotencia (`venc:<fecha de corte>`) y el mismo aviso 14 días
-- antes. Para las tarjetas de Foorkie ese aviso llega como mensaje al
-- pase (Bookea no les escribe correos a sus clientes).
--
-- QUIÉN LO HACE CUMPLIR: el código (src/lib/lealtad/vencimiento-sellos.ts),
-- que SOLO deja vencer cashback o puntos cuando la tarjeta es de Foorkie
-- (`saldoTambien`). Sin la marca, un cashback no vence aunque alguien
-- escriba la columna a mano —la garantía de la 0180 sigue en pie para
-- todas las tarjetas de Bookea—. La gift card no vence nunca. Acá solo se
-- actualiza el comentario de las columnas.
--
-- ------------------------------------------------------------
-- VUELTA ATRÁS (en este orden)
-- ------------------------------------------------------------
--   -- 1) La función (la caja de Foorkie contesta «todavía no se puede»):
--   drop function if exists public.canjear_monto_lealtad(uuid, integer, uuid, text, text);
--
--   -- 2) Las tarjetas vuelven a canjear en tramos (el texto «Canjeá por…»):
--   update public.programa_lealtad
--      set beneficio = beneficio - 'canjeLibre' - 'minimoCanje'
--    where jsonb_typeof(beneficio) = 'object'
--      and (beneficio ? 'canjeLibre' or beneficio ? 'minimoCanje');
--
--   -- 3) Ningún cashback ni puntos vencen (el código ya no los mira sin
--   --    la marca de Foorkie, pero así no queda nada escrito):
--   update public.programa_lealtad
--      set sellos_vencen_meses = null, sellos_vencen_desde = null
--    where modo in ('cashback', 'puntos');
--
--   -- 4) Los comentarios de la 0180 (ver ese archivo).
--
-- Los canjes de monto libre que ya se hicieron quedan en el ledger: es
-- plata que el cliente usó, y el saldo de cada uno la sigue contando.
-- ============================================================


-- ── 1. La función ──────────────────────────────────────────────
create or replace function public.canjear_monto_lealtad(
  p_miembro_id uuid,
  p_monto integer,
  p_usuario_id uuid,
  p_referencia text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(trim(coalesce(p_referencia, '')), '');
  v_miembro record;
  v_programa record;
  v_estado text;
  v_minimo integer;
  v_saldo integer;
  v_previo integer;
  v_tx_id uuid;
  v_motivo text;
begin
  -- Colones enteros, con el mismo techo que una compra (`revisarMonto`).
  if p_monto is null or p_monto < 1 or p_monto > 10000000 then
    return jsonb_build_object('ok', false, 'codigo', 'monto_invalido',
      'motivo', 'El monto tiene que ser una cantidad entera de colones.');
  end if;
  -- Sin referencia no hay idempotencia: un reintento descontaría dos veces.
  if v_ref is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_referencia',
      'motivo', 'Falta la llave de la operación.');
  end if;

  -- El MISMO lock que acreditar_lealtad, canjear_recompensa y
  -- revertir_movimiento: todo lo que mueve el saldo de este miembro va
  -- de a uno.
  perform pg_advisory_xact_lock(hashtext('lealtad:' || p_miembro_id::text));

  select m.id, m.estado, m.programa_id, m.persona_id, m.cliente_id
    into v_miembro
    from miembros m
   where m.id = p_miembro_id;
  if v_miembro.id is null then
    return jsonb_build_object('ok', false, 'codigo', 'membresia_inactiva',
      'motivo', 'Esa membresía no existe.');
  end if;

  select coalesce(sum(puntos), 0) into v_saldo
    from transacciones_puntos
   where miembro_id = p_miembro_id;

  -- ── La idempotencia, PRIMERO ─────────────────────────────────
  -- Si ESTE intento ya se usó, se dice que ya estaba —con lo que usó—
  -- antes de mirar el saldo: un reintento de un canje que ya vació la
  -- tarjeta no puede contestar «no le alcanza».
  select t.puntos into v_previo
    from transacciones_puntos t
   where t.miembro_id = p_miembro_id
     and t.referencia = v_ref
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'ya_estaba', true,
      'saldo', v_saldo, 'monto', abs(v_previo));
  end if;

  if v_miembro.estado <> 'activa' then
    return jsonb_build_object('ok', false, 'codigo', 'membresia_inactiva',
      'motivo', 'Esa membresía no está activa.');
  end if;

  select p.* into v_programa
    from programa_lealtad p
   where p.id = v_miembro.programa_id;

  -- Estado efectivo: el mismo criterio que canjear_recompensa (0125).
  v_estado := coalesce(v_programa.estado,
                       case when v_programa.activo then 'activo' else 'pausado' end);
  if v_estado <> 'activo' then
    return jsonb_build_object('ok', false, 'codigo', 'programa_no_opera',
      'motivo', 'El programa está en estado ' || v_estado || ' y no canjea.');
  end if;

  -- Solo una tarjeta de cashback con canje libre. Se compara el TEXTO:
  -- un `beneficio` que no es un objeto, o un canjeLibre que no es true,
  -- es «no» — nunca un error de conversión.
  if v_programa.modo is distinct from 'cashback'
     or jsonb_typeof(v_programa.beneficio) is distinct from 'object'
     or (v_programa.beneficio ->> 'canjeLibre') is distinct from 'true' then
    return jsonb_build_object('ok', false, 'codigo', 'canje_no_libre',
      'motivo', 'Esta tarjeta no usa el cashback en el monto que se quiera.');
  end if;

  -- La perilla de la 0138: sin canal probado, no se canjea. El trigger de
  -- `canjes` no lo vería (acá no hay fila de premio), así que se mira acá.
  if coalesce(v_programa.exige_verificacion_para_canjear, false)
     and v_miembro.cliente_id is null
     and v_miembro.persona_id is not null
     and not public.persona_verificada(v_miembro.persona_id) then
    return jsonb_build_object('ok', false, 'codigo', 'verificacion_pendiente',
      'motivo', 'Falta confirmar el WhatsApp o el correo antes de canjear.');
  end if;

  -- El mínimo de una vez: solo si es un número (una config rota no
  -- inventa un mínimo), acotado a 1..10.000.000.
  if jsonb_typeof(v_programa.beneficio -> 'minimoCanje') = 'number' then
    v_minimo := least(10000000, greatest(1,
                  floor((v_programa.beneficio ->> 'minimoCanje')::numeric)))::integer;
  end if;
  if v_minimo is not null and p_monto < v_minimo then
    return jsonb_build_object('ok', false, 'codigo', 'debajo_del_minimo',
      'minimo', v_minimo, 'saldo', v_saldo,
      'motivo', 'Ese monto está por debajo del mínimo de la tarjeta.');
  end if;

  if v_saldo < p_monto then
    return jsonb_build_object('ok', false, 'codigo', 'saldo_insuficiente',
      'saldo', v_saldo,
      'motivo', 'Saldo insuficiente: tiene ' || v_saldo || ' y se quieren usar ' || p_monto || '.');
  end if;

  v_motivo := left(coalesce(nullif(trim(p_motivo), ''), 'Canje: Cashback usado'), 200);

  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, referencia,
       saldo_anterior, saldo_posterior, usuario_id)
    values
      (p_miembro_id, 'canjeado', -p_monto, v_motivo, v_ref,
       v_saldo, v_saldo - p_monto, p_usuario_id)
    returning id into v_tx_id;
  exception when unique_violation then
    -- Bajo el lock no debería pasar (la referencia se miró arriba); si un
    -- camino escribió sin el lock, el índice de la 0060 manda igual.
    return jsonb_build_object('ok', true, 'ya_estaba', true,
      'saldo', v_saldo, 'monto', p_monto);
  end;

  -- El espejo del pase, en la MISMA transacción (como canjear_recompensa):
  -- sin `actualizado_en` el iPhone pregunta «¿qué cambió?» y se lleva un 204.
  update pases_wallet
     set saldo_cache = v_saldo - p_monto, actualizado_en = now()
   where miembro_id = p_miembro_id;

  return jsonb_build_object('ok', true, 'ya_estaba', false,
    'saldo', v_saldo - p_monto, 'monto', p_monto, 'transaccion_id', v_tx_id);
end;
$$;

comment on function public.canjear_monto_lealtad(uuid, integer, uuid, text, text) is
  'Canje LIBRE del cashback (0253): descuenta el monto que el cliente quiera '
  '(entre beneficio.minimoCanje y su saldo) en una tarjeta de cashback con '
  'beneficio.canjeLibre = true. Lock por miembro, idempotente por referencia '
  '(canje:<miembro>:cashback:<intento>), movimiento canjeado en el ledger y '
  'espejo del pase. Solo service_role: la tarjeta de Foorkie y quién opera los '
  'comprueba el servidor antes de llamar.';

-- Mismo criterio que la 0125 y la 0197: la 0083 revocó EXECUTE por
-- defecto, y un RPC que mueve saldo va SOLO a service_role.
revoke all on function public.canjear_monto_lealtad(uuid, integer, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.canjear_monto_lealtad(uuid, integer, uuid, text, text)
  to service_role;


-- ── 2. Las tarjetas de cashback de Foorkie pasan a canje libre ──
-- Solo si la tabla y la marca de Foorkie existen (una base sin Foorkie
-- no tiene nada que marcar). EXECUTE para que el bloque ni se planee
-- contra una tabla que no está.
do $$
begin
  if to_regclass('public.foorkie_restaurantes') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'foorkie_restaurantes'
          and column_name = 'lealtad_por_foorkie'
     ) then
    raise notice '0253: no está la marca de Foorkie (lealtad_por_foorkie); no hay tarjetas que pasar a canje libre.';
    return;
  end if;

  execute $sql$
    update public.programa_lealtad p
       set beneficio = p.beneficio || jsonb_build_object('canjeLibre', true)
     where p.modo = 'cashback'
       and jsonb_typeof(p.beneficio) = 'object'
       and p.beneficio ->> 'tipo' = 'cashback'
       and (p.beneficio ->> 'canjeLibre') is distinct from 'true'
       and exists (
         select 1
           from public.foorkie_restaurantes f
          where f.bookea_programa_id::text = p.id::text
            -- El mismo par que exige `vinculoConFoorkie`: una fila que
            -- apunta esta tarjeta con OTRO negocio no cuenta.
            and (f.bookea_rancho_id is null or f.bookea_rancho_id::text = p.rancho_id::text)
            and f.lealtad_por_foorkie is true
       )
  $sql$;
end $$;


-- ── 3. El vencimiento: lo que dicen las columnas de la 0180 ─────
comment on column programa_lealtad.sellos_vencen_meses is
  'Meses de inactividad tras los cuales el saldo del cliente vence (0180). '
  'NULL = no vence nunca, el comportamiento de siempre. Aplica a modo = ''sellos'' '
  'y, desde la 0253, también a ''cashback'' y ''puntos'' SOLO en tarjetas de '
  'Foorkie (lealtad_por_foorkie): el código no lo mira en ninguna otra. '
  'La gift card no vence nunca.';

comment on column programa_lealtad.sellos_vencen_desde is
  'Cuándo se ENCENDIÓ la regla de vencimiento (0180). El reloj de cada cliente '
  'arranca en max(su último movimiento, esta fecha), para que encenderla no le '
  'quite nada en el acto a quien hace rato que no viene. NULL cuando la regla '
  'está apagada. Vale igual para los sellos y, en las tarjetas de Foorkie '
  '(0253), para el cashback y los puntos.';

notify pgrst, 'reload schema';
