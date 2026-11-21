-- ============================================================
-- BOOKEA — Ajustar a mano el saldo de un cliente (0258)
--
-- Pedido del dueño de un local de Foorkie (Tostado Café Bistró, 21 nov 2026):
-- a una clienta le entregaron más puntos de los que eran por un error en
-- la caja y desde la ficha del cliente no había forma de corregirlo:
-- «habilítame poder MODIFICAR LA CANTIDAD DE PUNTOS: quitarlos, otorgar
-- puntos, etcétera».
--
-- Lo que ya existía: `revertir_movimiento` (0125/0139) deshace UN movimiento
-- entero, y acreditar suma lo que las reglas de la tarjeta calculan. Faltaba
-- lo que un dueño necesita cuando el error no es «esa compra» sino «le
-- quedaron 470 de más»: sumar o restar una cantidad a mano, con el motivo.
--
-- ── QUÉ HACE ────────────────────────────────────────────────────────
--
-- Escribe UN movimiento `ajuste` en el ledger (`transacciones_puntos`), con
-- signo (+ da, − quita), y deja el saldo del pase al día. Nada se edita ni
-- se borra: el error queda en la historia y la corrección al lado, como en
-- la reversión.
--
--   · Mismo lock que acreditar, canjear y revertir: lo que mueve el saldo de
--     un miembro va de a uno.
--   · Idempotente por `p_referencia`: un doble clic o un reintento de red con
--     la misma llave NO ajusta dos veces; contesta `ya_estaba`.
--   · No endeuda (como la 0139): si el saldo quedaría bajo cero no se escribe
--     nada y se dice cuánto tiene. Se rechaza entero, no se recorta.
--   · Un ajuste NO es una visita ni una compra: no cuenta en «ganó en
--     total», ni en visitas, ni mueve «última vez» (`agregadosPorMiembro`
--     de foorkie-panel.ts, que ya trataba así a los ajustes).
--   · `usuario_id` en null a propósito: la ruta de Foorkie opera con el
--     usuario del dueño, y poner ese id haría que la ficha dijera «Atendió:
--     <dueño>» aunque lo haya hecho un Administrador del equipo. Quién fue
--     viaja en el motivo, como en el canje libre («… (Ana)»).
--
-- Solo `service_role`: quién puede ajustar (el dueño, un Administrador, el
-- admin de Foorkie) lo comprueba el panel de Foorkie y la firma de la ruta
-- antes de llamar.
--
-- Aditiva e idempotente (`create or replace`). Para volver atrás:
--   drop function if exists public.ajustar_saldo_lealtad(uuid, integer, text, text);
-- Los ajustes ya escritos quedan en el ledger (son historia del cliente).
-- ============================================================

create or replace function public.ajustar_saldo_lealtad(
  p_miembro_id uuid,
  p_puntos integer,
  p_referencia text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(trim(coalesce(p_referencia, '')), '');
  v_motivo text := left(nullif(trim(coalesce(p_motivo, '')), ''), 200);
  v_miembro record;
  v_saldo integer;
  v_previo integer;
  v_resultante integer;
  v_tx_id uuid;
begin
  -- Con signo, sin cero, con el mismo techo que una compra (`TOPE_UNIDADES`).
  if p_puntos is null or p_puntos = 0 or abs(p_puntos) > 10000000 then
    return jsonb_build_object('ok', false, 'codigo', 'cantidad_invalida',
      'motivo', 'La cantidad tiene que ser distinta de cero.');
  end if;
  -- Sin referencia no hay idempotencia: un reintento ajustaría dos veces.
  if v_ref is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_referencia',
      'motivo', 'Falta la llave de la operación.');
  end if;
  -- El motivo es obligatorio: es lo único que explica el ajuste en el historial.
  if v_motivo is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_motivo',
      'motivo', 'Escribe por qué se modifica: queda en el historial del cliente.');
  end if;

  -- El MISMO lock que acreditar_lealtad, canjear_recompensa y revertir_movimiento.
  perform pg_advisory_xact_lock(hashtext('lealtad:' || p_miembro_id::text));

  select m.id, m.estado
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
  -- Un reintento de un ajuste que ya se hizo no puede contestar «no le
  -- alcanza»: se dice que ya estaba, con lo que se movió.
  select t.puntos into v_previo
    from transacciones_puntos t
   where t.miembro_id = p_miembro_id
     and t.referencia = v_ref
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'ya_estaba', true,
      'saldo', v_saldo, 'puntos', v_previo);
  end if;

  -- Una tarjeta en pausa SÍ se corrige (el error de ayer no espera a que
  -- vuelva); una dada de baja no.
  if v_miembro.estado not in ('activa', 'pausada') then
    return jsonb_build_object('ok', false, 'codigo', 'membresia_inactiva',
      'motivo', 'Ese cliente ya no tiene la tarjeta.');
  end if;

  v_resultante := v_saldo + p_puntos;
  -- Un saldo negativo es un cliente que debe algo que nunca contrajo
  -- (0139): no se escribe nada y se dice cuánto tiene.
  if v_resultante < 0 then
    return jsonb_build_object('ok', false, 'codigo', 'saldo_insuficiente',
      'saldo', v_saldo,
      'motivo', 'No se puede quitar tanto: el cliente tiene ' || v_saldo
                || ' y se quieren quitar ' || abs(p_puntos) || '.');
  end if;

  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, referencia,
       saldo_anterior, saldo_posterior, usuario_id)
    values
      (p_miembro_id, 'ajuste', p_puntos, v_motivo, v_ref,
       v_saldo, v_resultante, null)
    returning id into v_tx_id;
  exception when unique_violation then
    -- Bajo el lock no debería pasar (la referencia se miró arriba); si un
    -- camino escribió sin el lock, el índice de la 0060 manda igual.
    return jsonb_build_object('ok', true, 'ya_estaba', true,
      'saldo', v_saldo, 'puntos', p_puntos);
  end;

  -- El espejo del pase, en la MISMA transacción (como canjear_monto_lealtad):
  -- sin `actualizado_en` el iPhone pregunta «¿qué cambió?» y se lleva un 204.
  update pases_wallet
     set saldo_cache = v_resultante, actualizado_en = now()
   where miembro_id = p_miembro_id;

  return jsonb_build_object('ok', true, 'ya_estaba', false,
    'saldo', v_resultante, 'puntos', p_puntos, 'transaccion_id', v_tx_id);
end;
$$;

comment on function public.ajustar_saldo_lealtad(uuid, integer, text, text) is
  'Ajuste a mano del saldo de un cliente (0258): suma o resta una cantidad con '
  'su motivo, como un movimiento `ajuste` del ledger. Lock por miembro, '
  'idempotente por referencia (panel:ajuste:<miembro>:<intento>), no deja el '
  'saldo bajo cero y actualiza el espejo del pase. Solo service_role: quién '
  'puede ajustar lo comprueba el panel de Foorkie antes de llamar.';

-- Mismo criterio que la 0125 y la 0253: un RPC que mueve saldo va SOLO a service_role.
revoke all on function public.ajustar_saldo_lealtad(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.ajustar_saldo_lealtad(uuid, integer, text, text)
  to service_role;
