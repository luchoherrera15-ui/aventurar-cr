-- ============================================================
-- WALLET V2 — Migración E (parte 2): update_tag monotónico real
--
-- Se incrementa DENTRO de `wallet_encolar_sincronizacion`, con
-- `update ... returning ... into` — Postgres serializa los UPDATE
-- sobre la MISMA fila (bloqueo de fila), así que dos cambios rápidos
-- sobre el mismo pase nunca pueden leer-e-incrementar al mismo tiempo
-- y terminar en el mismo número, aunque ocurran en el mismo
-- milisegundo. Es un contador por pase, no una marca de tiempo — por
-- eso no hace falta una secuencia global ni resolución de reloj.
-- ============================================================

create or replace function public.wallet_encolar_sincronizacion(
  p_miembro_id uuid,
  p_operacion text,
  p_idempotency_key text,
  p_correlation_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programa_id uuid;
  v_cuenta_id uuid;
  v_encoladas integer := 0;
  v_pase_id uuid;
  v_plataforma text;
  v_nuevo_tag bigint;
begin
  select programa_id into v_programa_id from miembros where id = p_miembro_id;
  if v_programa_id is null then return 0; end if;

  select cuenta_id into v_cuenta_id from programa_lealtad where id = v_programa_id;

  for v_pase_id, v_plataforma in
    select id, plataforma from pases_wallet
    where miembro_id = p_miembro_id and activo = true
  loop
    update pases_wallet
       set update_tag = update_tag + 1,
           motivo_ultima_generacion = p_operacion,
           ultima_generacion_en = now()
     where id = v_pase_id
    returning update_tag into v_nuevo_tag;

    insert into wallet_sincronizaciones (
      cuenta_id, programa_id, miembro_id, pase_id, plataforma, operacion,
      idempotency_key, correlation_id, version_local_esperada
    ) values (
      v_cuenta_id, v_programa_id, p_miembro_id, v_pase_id, v_plataforma, p_operacion,
      p_idempotency_key, p_correlation_id, v_nuevo_tag
    )
    on conflict (idempotency_key, plataforma, pase_id, operacion) where estado in ('pending', 'processing', 'retryable')
    do nothing;

    if found then
      v_encoladas := v_encoladas + 1;
    end if;
  end loop;

  return v_encoladas;
end;
$$;
