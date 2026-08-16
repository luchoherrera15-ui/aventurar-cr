-- ============================================================
-- WALLET V2 — Migración C: ledger endurecido + concurrencia real de canje
--
-- Parte 1: verificar (con un trigger, no una promesa) que el ledger es
--          inmutable de verdad, y ampliar su dominio de forma
--          compatible.
-- Parte 2: cerrar el hueco de concurrencia real que encontró la
--          Fase 2A — las reglas de nivel-tarjeta (0136) se validaban
--          en TypeScript, ANTES del RPC y SIN lock. Se corrige AHORA,
--          con 0 canjes reales en producción — el momento más seguro.
-- ============================================================

-- ------------------------------------------------------------
-- 1. INMUTABILIDAD REAL DEL LEDGER
-- ------------------------------------------------------------
-- Antes de esta migración, `authenticated` no tenía UPDATE/DELETE
-- (verificado contra la base real: information_schema.role_table_grants
-- no lista ninguno de los dos para ese rol) — esa mitad ya era
-- genuinamente inmutable, no solo "sin botón en la UI".
--
-- La otra mitad no lo era: `service_role` SÍ tiene UPDATE/DELETE
-- otorgado (lo necesita para el resto del esquema), y ningún código
-- de `src/` los usa contra esta tabla — pero eso es disciplina de
-- aplicación, no una garantía de la base. Un trigger cierra esa
-- brecha: ni siquiera `service_role` puede tocar una fila ya escrita,
-- sin excepción. Corregir el ledger es agregar una fila de reversa
-- (`reversion_de`), que es exactamente el mecanismo que ya existe y
-- ya se prueba.
create or replace function public.transacciones_puntos_inmutable()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'transacciones_puntos es un ledger inmutable — no se actualiza ni se borra una fila ya escrita. Para corregir, insertar una reversa (reversion_de).'
    using errcode = '23514';
  return null;
end;
$$;

drop trigger if exists transacciones_puntos_inmutable_trg on transacciones_puntos;
create trigger transacciones_puntos_inmutable_trg
  before update or delete on transacciones_puntos
  for each row
  execute function public.transacciones_puntos_inmutable();

comment on trigger transacciones_puntos_inmutable_trg on transacciones_puntos is
  'Wallet V2 — inmutabilidad real, a nivel de base, incluso para service_role. Fase 2B §7.';

-- ------------------------------------------------------------
-- 2. Ampliar el dominio de `tipo`, de forma COMPATIBLE — los 3
--    valores actuales ('ganado','canjeado','ajuste') se conservan tal
--    cual; se agregan los que hacían falta para sellos/puntos/cashback
--    explícitos y sus reversas. Ninguna fila existente se convierte:
--    los valores viejos siguen siendo válidos para siempre.
-- ------------------------------------------------------------
alter table transacciones_puntos drop constraint if exists transacciones_puntos_tipo_check;
alter table transacciones_puntos add constraint transacciones_puntos_tipo_check
  check (tipo in (
    'ganado', 'canjeado', 'ajuste',                          -- valores originales (0060) — nunca se quitan
    'ganado_reversado',
    'puntos_agregados', 'puntos_reversados',
    'cashback_pendiente', 'cashback_confirmado', 'cashback_canjeado', 'cashback_reversado',
    'canjeado_reversado',
    'expiracion'
  ));

-- El CHECK de signo (0060) solo conocía 'ganado'/'canjeado'/'ajuste'.
-- Se reescribe para cubrir los tipos nuevos con la MISMA regla de
-- fondo: lo que suma el saldo es positivo, lo que lo resta es
-- negativo, un ajuste puede ser cualquiera de los dos.
alter table transacciones_puntos drop constraint if exists transacciones_puntos_check;
alter table transacciones_puntos add constraint transacciones_puntos_signo_check
  check (
    (tipo in ('ganado', 'puntos_agregados', 'cashback_confirmado', 'ganado_reversado' /* una reversa de un canje entra como sello positivo */) and puntos > 0)
    or (tipo in ('canjeado', 'puntos_reversados', 'cashback_canjeado', 'canjeado_reversado' /* reversa de un canje: quita el crédito que ese canje había dado, si aplica */, 'expiracion') and puntos < 0)
    or (tipo in ('ajuste', 'cashback_pendiente', 'cashback_reversado') and puntos <> 0)
  );

alter table transacciones_puntos
  add column if not exists unidad text check (unidad is null or unidad in ('sellos', 'puntos', 'colones', 'usos')),
  add column if not exists correlation_id uuid,
  add column if not exists compra_base_colones bigint,
  add column if not exists basis_points integer check (basis_points is null or basis_points between 0 and 10000),
  add column if not exists moneda text check (moneda is null or moneda in ('CRC'));

comment on column transacciones_puntos.correlation_id is
  'Wallet V2 — enlaza este movimiento con el/los wallet_sync_jobs que '
  'avisan a Apple/Google del cambio (Migración D). Nullable: los '
  'movimientos previos a esta migración no lo tienen y no hace falta '
  'backfillearlo — el ledger histórico sigue siendo válido sin él.';

-- ------------------------------------------------------------
-- 3. canjear_recompensa — con las reglas de NIVEL DE TARJETA (0136)
--    validadas DENTRO del lock, no antes en TypeScript.
--
-- Todo lo que ya funcionaba (stock, límite por recompensa, vigencia de
-- la recompensa, idempotencia por referencia) se conserva línea por
-- línea. Se agrega, después del chequeo de vigencia de la recompensa y
-- antes de tocar el saldo: uso_unico / max_por_cliente / max_global /
-- día y hora permitidos / vigencia de la TARJETA — todo bajo el mismo
-- pg_advisory_xact_lock que ya tenía la función, así que dos canjes
-- concurrentes del mismo cliente contra un cupón de un solo uso ya no
-- pueden pasar los dos.
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

  -- ── Reglas de NIVEL DE TARJETA (0136) — antes vivían solo en
  -- canje.ts, sin lock. Acá, bajo el mismo lock que todo lo demás.
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
       saldo_anterior, saldo_posterior, usuario_id)
    values
      (p_miembro_id, 'canjeado', -v_rec.costo_puntos,
       'Canje: ' || v_rec.nombre, nullif(trim(p_referencia), ''),
       v_saldo, v_saldo - v_rec.costo_puntos, p_usuario_id)
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

  return jsonb_build_object('ok', true, 'canje_id', v_canje_id,
    'saldo', v_saldo - v_rec.costo_puntos, 'recompensa', v_rec.nombre,
    'sku', v_rec.sku, 'instrucciones', v_rec.instrucciones);
end;
$$;

revoke all on function public.canjear_recompensa(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.canjear_recompensa(uuid, uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 4. FASE 2C — endurecer los FK que hoy CASCADEAN hacia el ledger.
--
-- Con el trigger de inmutabilidad de la sección 1 ya activo, un
-- CASCADE que llegue a transacciones_puntos SIEMPRE falla — Postgres
-- evalúa el trigger BEFORE DELETE de la fila hija como parte de la
-- misma operación en cascada, así que un DELETE de miembros (o de
-- programa_lealtad, dos niveles arriba) con cualquier historial de
-- ledger revienta con "ledger inmutable" en vez de completar un
-- borrado parcial silencioso. Eso ya es correcto por sí solo — nunca
-- se pierde ledger sin que la transacción entera falle — pero deja un
-- efecto secundario sin resolver: un miembro o programa SIN ledger
-- (o con canjes pero cero movimientos) todavía se borraba en cascada
-- sin que quien ejecuta el DELETE tuviera que decidirlo explícitamente.
--
-- Estrategia (mapa completo de FKs y evidencia contra datos remotos
-- reales en docs/wallet-v2/fase-2c-resultado.md §3 y
-- docs/wallet-v2/drift-remoto.md §5):
--   · Ledger y registros de valor histórico (transacciones_puntos,
--     canjes) → RESTRICT. Nunca desaparecen por cascada; el camino
--     normal es archivar al miembro (estado = 'cancelada'); un borrado
--     físico real exige un procedimiento excepcional y auditado, fuera
--     del flujo normal (no se construye en esta fase).
--   · Auditoría de intentos (intentos_canje.programa_id) → SET NULL,
--     igual que ya hace su propia columna miembro_id: el intento
--     (aprobado o no) sobrevive al programa que lo originó, sin el
--     vínculo.
--   · Registros operativos sin valor de auditoría permanente
--     (pases_wallet.miembro_id, wallet_sincronizaciones.*) se dejan en
--     CASCADE a propósito: son estado de dispositivo o cola de
--     sincronización, no historial financiero — perderlos junto con el
--     miembro es aceptable y evita tener que archivarlos aparte.
--   · recompensas.programa_id se deja en CASCADE: ya está
--     transitivamente protegida por canjes_recompensa_id_fkey (RESTRICT
--     desde antes de esta fase) — si una recompensa tiene algún canje,
--     su propio borrado ya falla, así que el CASCADE desde
--     programa_lealtad nunca puede arrastrar una recompensa con
--     historia real.
-- ------------------------------------------------------------

alter table transacciones_puntos drop constraint transacciones_puntos_miembro_id_fkey;
alter table transacciones_puntos add constraint transacciones_puntos_miembro_id_fkey
  foreign key (miembro_id) references miembros(id) on delete restrict;

alter table canjes drop constraint canjes_miembro_id_fkey;
alter table canjes add constraint canjes_miembro_id_fkey
  foreign key (miembro_id) references miembros(id) on delete restrict;

alter table miembros drop constraint miembros_programa_id_fkey;
alter table miembros add constraint miembros_programa_id_fkey
  foreign key (programa_id) references programa_lealtad(id) on delete restrict;

-- SET NULL exige que la columna admita NULL — hasta acá era NOT NULL.
alter table intentos_canje alter column programa_id drop not null;
alter table intentos_canje drop constraint intentos_canje_programa_id_fkey;
alter table intentos_canje add constraint intentos_canje_programa_id_fkey
  foreign key (programa_id) references programa_lealtad(id) on delete set null;

comment on constraint transacciones_puntos_miembro_id_fkey on transacciones_puntos is
  'Fase 2C — RESTRICT (antes CASCADE): el ledger nunca desaparece por '
  'borrar su miembro. Ver fase-2c-resultado.md §3.';
comment on constraint canjes_miembro_id_fkey on canjes is
  'Fase 2C — RESTRICT (antes CASCADE): un canje entregado es un '
  'registro de valor, no desaparece por borrar su miembro.';
comment on constraint miembros_programa_id_fkey on miembros is
  'Fase 2C — RESTRICT (antes CASCADE): borrar un programa con '
  'miembros (tengan o no ledger) exige archivarlos primero '
  '(estado=''cancelada'') o un procedimiento excepcional auditado.';
comment on constraint intentos_canje_programa_id_fkey on intentos_canje is
  'Fase 2C — SET NULL (antes CASCADE), igual que miembro_id: el '
  'registro del intento sobrevive al programa que lo originó.';
