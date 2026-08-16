-- ============================================================
-- WALLET V2 — Migración D (parte 2): las 3 RPC de movimiento encolan
-- su propia sincronización, EN LA MISMA TRANSACCIÓN que confirman el
-- movimiento — nunca en un segundo viaje que podría no ejecutarse.
--
-- También completa la Migración B (expand del saldo canónico) en los
-- dos RPC que 0160 todavía no tocaba: `acreditar_lealtad` y
-- `revertir_movimiento` ya escriben `pases_wallet.saldo_cache`; ahora
-- escriben TAMBIÉN `miembros.saldo_cache` — mismo criterio en los 3.
--
-- correlation_id: se genera UNO nuevo por movimiento y se guarda tanto
-- en la fila del ledger (transacciones_puntos.correlation_id, 0160)
-- como en cada fila de wallet_sincronizaciones que ese movimiento
-- encola — así una fila del ledger y sus intentos de push se
-- encuentran con una sola consulta.
-- ============================================================

create or replace function public.acreditar_lealtad(
  p_miembro_id uuid,
  p_monto integer,
  p_referencia text,
  p_usuario_id uuid,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_miembro record;
  v_programa record;
  v_zona text;
  v_hoy date;
  v_otorgados_hoy integer;
  v_puntos integer;
  v_saldo integer;
  v_estado text;
  v_correlation_id uuid := gen_random_uuid();
  v_tx_id uuid;
begin
  if p_monto is not null and p_monto < 0 then
    return jsonb_build_object('otorgado', false, 'motivo', 'El monto no puede ser negativo.');
  end if;

  perform pg_advisory_xact_lock(hashtext('lealtad:' || p_miembro_id::text));

  select m.id, m.estado, m.programa_id into v_miembro
  from miembros m where m.id = p_miembro_id;
  if v_miembro.id is null then
    return jsonb_build_object('otorgado', false, 'motivo', 'Esa membresía no existe.');
  end if;
  if v_miembro.estado <> 'activa' then
    return jsonb_build_object('otorgado', false, 'motivo',
      'Esa membresía está ' || v_miembro.estado || '.');
  end if;

  select p.*, r.zona_horaria into v_programa
  from programa_lealtad p join ranchos r on r.id = p.rancho_id
  where p.id = v_miembro.programa_id;

  v_estado := coalesce(v_programa.estado,
                       case when v_programa.activo then 'activo' else 'pausado' end);
  if v_estado <> 'activo' then
    return jsonb_build_object('otorgado', false, 'motivo',
      'El programa está en estado ' || v_estado || ' y no acumula.');
  end if;

  v_zona := coalesce(v_programa.zona_horaria, 'America/Costa_Rica');
  v_hoy := (now() at time zone v_zona)::date;

  if v_programa.inicio is not null and v_hoy < v_programa.inicio then
    return jsonb_build_object('otorgado', false, 'motivo', 'El programa todavía no arranca.');
  end if;
  if v_programa.fin is not null and v_hoy > v_programa.fin then
    return jsonb_build_object('otorgado', false, 'motivo', 'El programa ya terminó.');
  end if;

  if v_programa.compra_minima is not null and p_monto is not null
     and p_monto < v_programa.compra_minima then
    return jsonb_build_object('otorgado', false, 'motivo',
      'La compra mínima para acumular es ₡' || v_programa.compra_minima || '.');
  end if;

  v_puntos := v_programa.puntos_por_visita
              + coalesce(floor(v_programa.puntos_por_colon * p_monto)::int, 0);
  if v_puntos <= 0 then
    return jsonb_build_object('otorgado', false, 'motivo', 'Esta operación no genera puntos.');
  end if;
  if v_programa.max_por_transaccion is not null and v_puntos > v_programa.max_por_transaccion then
    v_puntos := v_programa.max_por_transaccion;
  end if;

  if v_programa.max_diario_cliente is not null then
    select coalesce(sum(t.puntos), 0) into v_otorgados_hoy
    from transacciones_puntos t
    where t.miembro_id = p_miembro_id and t.tipo = 'ganado'
      and (t.created_at at time zone v_zona)::date = v_hoy;
    if v_otorgados_hoy >= v_programa.max_diario_cliente then
      return jsonb_build_object('otorgado', false, 'motivo',
        'Este cliente ya llegó a su tope de hoy.');
    end if;
    v_puntos := least(v_puntos, v_programa.max_diario_cliente - v_otorgados_hoy);
  end if;

  select coalesce(sum(puntos), 0) into v_saldo
  from transacciones_puntos where miembro_id = p_miembro_id;

  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, referencia,
       saldo_anterior, saldo_posterior, usuario_id, reglas, correlation_id)
    values
      (p_miembro_id, 'ganado', v_puntos,
       coalesce(nullif(trim(p_motivo), ''), 'Acumulación'),
       nullif(trim(p_referencia), ''),
       v_saldo, v_saldo + v_puntos, p_usuario_id,
       jsonb_build_object(
         'puntos_por_visita', v_programa.puntos_por_visita,
         'puntos_por_colon', v_programa.puntos_por_colon,
         'compra_minima', v_programa.compra_minima,
         'max_por_transaccion', v_programa.max_por_transaccion,
         'max_diario_cliente', v_programa.max_diario_cliente,
         'monto', p_monto),
       v_correlation_id)
    returning id into v_tx_id;
  exception when unique_violation then
    return jsonb_build_object('otorgado', false, 'motivo', 'ya-otorgado', 'saldo', v_saldo);
  end;

  update pases_wallet
     set saldo_cache = v_saldo + v_puntos, actualizado_en = now()
   where miembro_id = p_miembro_id;

  update miembros set saldo_cache = v_saldo + v_puntos, saldo_actualizado_en = now()
   where id = p_miembro_id;

  perform public.wallet_encolar_sincronizacion(p_miembro_id, 'saldo', 'tx:' || v_tx_id::text, v_correlation_id);

  return jsonb_build_object('otorgado', true, 'puntos', v_puntos, 'saldo', v_saldo + v_puntos);
end;
$$;

-- ------------------------------------------------------------
-- canjear_recompensa: agrega el encolado. El resto (reglas de 0136
-- bajo lock) ya lo dejó la 0160 — no se repite acá.
-- ------------------------------------------------------------
create or replace function public.canjear_recompensa(
  p_miembro_id uuid,
  p_recompensa_id uuid,
  p_usuario_id uuid,
  p_referencia text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_miembro record;
  v_programa record;
  v_rec record;
  v_estado text;
  v_hoy date;
  v_ahora_local timestamp;
  v_dow smallint;
  v_hora time;
  v_saldo integer;
  v_canjeados integer;
  v_del_cliente integer;
  v_canjes_tarjeta_cliente integer;
  v_canjes_tarjeta_global integer;
  v_tx_id uuid;
  v_canje_id uuid;
  v_correlation_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtext('lealtad:' || p_miembro_id::text));

  select m.id, m.estado, m.programa_id into v_miembro
  from miembros m where m.id = p_miembro_id;
  if v_miembro.id is null or v_miembro.estado <> 'activa' then
    return jsonb_build_object('ok', false, 'motivo', 'Esa membresía no está activa.');
  end if;

  select p.*, r.zona_horaria into v_programa
  from programa_lealtad p join ranchos r on r.id = p.rancho_id
  where p.id = v_miembro.programa_id;

  v_estado := coalesce(v_programa.estado,
                       case when v_programa.activo then 'activo' else 'pausado' end);
  if v_estado <> 'activo' then
    return jsonb_build_object('ok', false, 'motivo',
      'El programa está en estado ' || v_estado || ' y no canjea.');
  end if;

  v_ahora_local := now() at time zone coalesce(v_programa.zona_horaria, 'America/Costa_Rica');
  v_hoy := v_ahora_local::date;
  v_hora := v_ahora_local::time;

  if v_programa.vigente_desde is not null and v_hoy < v_programa.vigente_desde then
    return jsonb_build_object('ok', false, 'motivo', 'Esta tarjeta todavía no está vigente.');
  end if;
  if v_programa.vigente_hasta is not null and v_hoy > v_programa.vigente_hasta then
    return jsonb_build_object('ok', false, 'motivo', 'Esta tarjeta ya venció.');
  end if;

  v_dow := extract(dow from v_hoy);
  if v_programa.dias_permitidos is not null and array_length(v_programa.dias_permitidos, 1) > 0
     and not (v_dow = any(v_programa.dias_permitidos)) then
    return jsonb_build_object('ok', false, 'motivo', 'Esta tarjeta no se puede canjear hoy.');
  end if;
  if v_programa.hora_desde is not null and v_programa.hora_hasta is not null
     and not (v_hora between v_programa.hora_desde and v_programa.hora_hasta) then
    return jsonb_build_object('ok', false, 'motivo', 'Esta tarjeta no se puede canjear a esta hora.');
  end if;

  if v_programa.uso_unico or v_programa.max_por_cliente is not null then
    select count(*) into v_canjes_tarjeta_cliente from canjes c
    join recompensas r2 on r2.id = c.recompensa_id
    where r2.programa_id = v_miembro.programa_id and c.miembro_id = p_miembro_id and c.estado <> 'anulado';
    if v_programa.uso_unico and v_canjes_tarjeta_cliente >= 1 then
      return jsonb_build_object('ok', false, 'motivo', 'Esta tarjeta es de un solo uso y ya se canjeó.');
    end if;
    if v_programa.max_por_cliente is not null and v_canjes_tarjeta_cliente >= v_programa.max_por_cliente then
      return jsonb_build_object('ok', false, 'motivo', 'Este cliente ya alcanzó el máximo de canjes de esta tarjeta.');
    end if;
  end if;

  if v_programa.max_global is not null then
    select count(*) into v_canjes_tarjeta_global from canjes c
    join recompensas r2 on r2.id = c.recompensa_id
    where r2.programa_id = v_miembro.programa_id and c.estado <> 'anulado';
    if v_canjes_tarjeta_global >= v_programa.max_global then
      return jsonb_build_object('ok', false, 'motivo', 'Esta tarjeta alcanzó su máximo global de canjes.');
    end if;
  end if;

  select * into v_rec from recompensas where id = p_recompensa_id;
  if v_rec.id is null or v_rec.programa_id <> v_miembro.programa_id then
    return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa no está disponible.');
  end if;
  if not v_rec.activo then
    return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa está desactivada.');
  end if;

  if v_rec.vigencia_desde is not null and v_hoy < v_rec.vigencia_desde then
    return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa todavía no está vigente.');
  end if;
  if v_rec.vigencia_hasta is not null and v_hoy > v_rec.vigencia_hasta then
    return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa ya venció.');
  end if;

  if v_rec.stock_total is not null then
    select count(*) into v_canjeados from canjes
    where recompensa_id = p_recompensa_id and estado <> 'anulado';
    if v_canjeados >= v_rec.stock_total then
      return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa se agotó.');
    end if;
  end if;
  if v_rec.limite_por_cliente is not null then
    select count(*) into v_del_cliente from canjes
    where recompensa_id = p_recompensa_id and miembro_id = p_miembro_id
      and estado <> 'anulado';
    if v_del_cliente >= v_rec.limite_por_cliente then
      return jsonb_build_object('ok', false, 'motivo',
        'Este cliente ya canjeó su máximo de esa recompensa.');
    end if;
  end if;

  select coalesce(sum(puntos), 0) into v_saldo
  from transacciones_puntos where miembro_id = p_miembro_id;
  if v_saldo < v_rec.costo_puntos then
    return jsonb_build_object('ok', false, 'motivo',
      'Saldo insuficiente: tiene ' || v_saldo || ' y la recompensa cuesta '
      || v_rec.costo_puntos || '.');
  end if;

  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, referencia,
       saldo_anterior, saldo_posterior, usuario_id, correlation_id)
    values
      (p_miembro_id, 'canjeado', -v_rec.costo_puntos,
       'Canje: ' || v_rec.nombre, nullif(trim(p_referencia), ''),
       v_saldo, v_saldo - v_rec.costo_puntos, p_usuario_id, v_correlation_id)
    returning id into v_tx_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'ya-canjeado', 'saldo', v_saldo);
  end;

  insert into canjes
    (miembro_id, recompensa_id, puntos, estado, transaccion_id,
     entregado_en, entregado_por, referencia)
  values
    (p_miembro_id, p_recompensa_id, v_rec.costo_puntos, 'entregado', v_tx_id,
     now(), p_usuario_id, nullif(trim(p_referencia), ''))
  returning id into v_canje_id;

  update pases_wallet
     set saldo_cache = v_saldo - v_rec.costo_puntos, actualizado_en = now()
   where miembro_id = p_miembro_id;

  update miembros set saldo_cache = v_saldo - v_rec.costo_puntos, saldo_actualizado_en = now()
   where id = p_miembro_id;

  perform public.wallet_encolar_sincronizacion(p_miembro_id, 'saldo', 'tx:' || v_tx_id::text, v_correlation_id);

  return jsonb_build_object('ok', true, 'canje_id', v_canje_id,
    'saldo', v_saldo - v_rec.costo_puntos, 'recompensa', v_rec.nombre,
    'sku', v_rec.sku, 'instrucciones', v_rec.instrucciones);
end;
$$;

-- ------------------------------------------------------------
-- revertir_movimiento: agrega el encolado + escribe miembros.saldo_cache.
-- ------------------------------------------------------------
create or replace function public.revertir_movimiento(
  p_transaccion_id uuid,
  p_usuario_id uuid,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_saldo integer;
  v_correlation_id uuid := gen_random_uuid();
  v_reversa_id uuid;
begin
  select * into v_tx from transacciones_puntos where id = p_transaccion_id;
  if v_tx.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'Ese movimiento no existe.');
  end if;
  if v_tx.reversion_de is not null then
    return jsonb_build_object('ok', false, 'motivo',
      'Una reversión no se revierte: se registra el movimiento correcto.');
  end if;

  perform pg_advisory_xact_lock(hashtext('lealtad:' || v_tx.miembro_id::text));

  select coalesce(sum(puntos), 0) into v_saldo
  from transacciones_puntos where miembro_id = v_tx.miembro_id;

  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, saldo_anterior, saldo_posterior,
       usuario_id, reversion_de, correlation_id)
    values
      (v_tx.miembro_id, 'ajuste', -v_tx.puntos,
       coalesce(nullif(trim(p_motivo), ''), 'Reversión'),
       v_saldo, v_saldo - v_tx.puntos, p_usuario_id, v_tx.id, v_correlation_id)
    returning id into v_reversa_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'Ese movimiento ya fue revertido.');
  end;

  update canjes
     set estado = 'anulado',
         anulado_motivo = coalesce(nullif(trim(p_motivo), ''), 'Movimiento revertido')
   where transaccion_id = v_tx.id and estado <> 'anulado';

  update pases_wallet
     set saldo_cache = v_saldo - v_tx.puntos, actualizado_en = now()
   where miembro_id = v_tx.miembro_id;

  update miembros set saldo_cache = v_saldo - v_tx.puntos, saldo_actualizado_en = now()
   where id = v_tx.miembro_id;

  perform public.wallet_encolar_sincronizacion(v_tx.miembro_id, 'saldo', 'tx:' || v_reversa_id::text, v_correlation_id);

  return jsonb_build_object('ok', true, 'saldo', v_saldo - v_tx.puntos);
end;
$$;

revoke all on function public.acreditar_lealtad(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.canjear_recompensa(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.revertir_movimiento(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.acreditar_lealtad(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.canjear_recompensa(uuid, uuid, uuid, text) to service_role;
grant execute on function public.revertir_movimiento(uuid, uuid, text) to service_role;
