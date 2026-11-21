-- ============================================================
-- BOOKEA — Pasar una tarjeta de puntos a puntos CON DECIMALES (0259)
--
-- Pedido del dueño de Tostado (21 nov 2026): «necesitamos poder poner
-- decimales» (una compra de $4.75 a 1 punto por dólar son 4.75 puntos). El
-- motor ya sabe contar así (etapa 1, `moneda-tarjeta.ts`): una tarjeta de
-- puntos cuyo `beneficio` guarda `moneda` y `escala: 100` cuenta CENTÉSIMOS de
-- punto en el ledger, en los premios y en las columnas de reglas, igual que el
-- cashback cuenta centavos. Esta migración trae las DOS funciones que mueven
-- una tarjeta que ya existe de un lado al otro. No se corre sola sobre nada: se
-- llaman a mano, tarjeta por tarjeta.
--
--   convertir_puntos_a_decimales(programa, moneda)
--     Multiplica por 100 todo lo que está en unidades de puntos y declara
--     `moneda` y `escala: 100` en el beneficio. Lo que el cliente VE no cambia
--     (475 centésimos se dicen «4.75»; los 5 puntos de hoy son 500
--     centésimos y se dicen «5»).
--
--   revertir_puntos_a_enteros(programa)
--     El «volver atrás»: divide por 100 y quita la moneda y la escala. Solo si
--     NADA quedó con decimales (todo múltiplo de 100); si ya hay saldos como
--     4.75, no se puede volver sin perder lo que hay, y lo dice sin tocar nada.
--
-- ── QUÉ SE MULTIPLICA (todo lo que cuenta puntos en unidades) ───────
--   transacciones_puntos  puntos, saldo_anterior, saldo_posterior
--   pases_wallet          saldo_cache (y `actualizado_en`)
--   recompensas           costo_puntos
--   canjes                puntos
--   programa_lealtad      puntos_por_visita, max_por_transaccion,
--                         max_diario_cliente (puntos) y compra_minima (dinero:
--                         desde ahora la compra entra en centavos)
--   beneficio (jsonb)     porVisita, inicial, minimoCanje, maximo + moneda/escala
--
-- `puntos_por_colon` NO cambia: es la tasa por unidad de la compra, y como la
-- compra entra en centavos y el saldo sale en centésimos, «1 punto por dólar»
-- sigue siendo `1` (475 centavos × 1 = 475 centésimos = 4.75 puntos).
--
-- ── CÓMO SE CUIDA ───────────────────────────────────────────────────
--   · UNA transacción: o se convierte todo o no se toca nada.
--   · Toma el mismo lock por miembro que acreditar, canjear, ajustar y revertir
--     (`lealtad:<miembro>`), de todos los miembros de la tarjeta, hasta el
--     final: ninguna operación se mete a la mitad.
--   · Solo tarjetas de PUNTOS que todavía no tienen `escala`, y solo en
--     monedas con centavos (la misma lista que el motor, `MONEDAS_TARJETA`).
--   · Solo service_role (Foorkie no las llama: las corre una persona).
--
-- Aditiva e idempotente (`create or replace`). Para quitarlas:
--   drop function if exists public.convertir_puntos_a_decimales(uuid, text);
--   drop function if exists public.revertir_puntos_a_enteros(uuid);
-- Quitar las funciones NO deshace una conversión ya hecha: eso lo hace
-- `revertir_puntos_a_enteros`, ANTES de quitarlas.
-- ============================================================

create or replace function public.convertir_puntos_a_decimales(
  p_programa_id uuid,
  p_moneda text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moneda text := upper(trim(coalesce(p_moneda, '')));
  v_prog record;
  v_b jsonb;
  v_miembro uuid;
  n_ledger integer;
  n_pases integer;
  n_premios integer;
  n_canjes integer;
begin
  -- Las monedas con centavos de `MONEDAS_TARJETA` (moneda-tarjeta.ts).
  if v_moneda not in ('BOB', 'BRL', 'USD', 'GTQ', 'HNL', 'NIO', 'PEN', 'VES', 'EUR', 'GBP', 'CAD') then
    raise exception 'Esa moneda no usa centavos: los puntos con decimales necesitan una que sí (USD, EUR…).'
      using errcode = '22023';
  end if;

  select * into v_prog from programa_lealtad where id = p_programa_id for update;
  if v_prog.id is null then
    raise exception 'Esa tarjeta no existe.' using errcode = '22023';
  end if;
  if v_prog.modo is distinct from 'puntos' then
    raise exception 'Esa tarjeta no es de puntos.' using errcode = '22023';
  end if;
  v_b := v_prog.beneficio;
  if jsonb_typeof(v_b) is distinct from 'object' or (v_b ->> 'tipo') is distinct from 'puntos' then
    raise exception 'El beneficio de esa tarjeta no es de puntos.' using errcode = '22023';
  end if;
  if v_b ? 'escala' or v_b ? 'moneda' then
    raise exception 'Esa tarjeta ya declara su moneda o su escala: no se convierte dos veces.' using errcode = '22023';
  end if;

  -- El mismo lock de acreditar/canjear/ajustar/revertir, de TODOS los miembros, hasta el final de la transacción.
  for v_miembro in select m.id from miembros m where m.programa_id = p_programa_id order by m.id loop
    perform pg_advisory_xact_lock(hashtext('lealtad:' || v_miembro::text));
  end loop;

  update transacciones_puntos t
     set puntos = t.puntos * 100,
         saldo_anterior = t.saldo_anterior * 100,
         saldo_posterior = t.saldo_posterior * 100
    from miembros m
   where m.id = t.miembro_id and m.programa_id = p_programa_id;
  get diagnostics n_ledger = row_count;

  -- El espejo del pase: sin `actualizado_en` el iPhone no vuelve a preguntar «¿qué cambió?».
  update pases_wallet w
     set saldo_cache = w.saldo_cache * 100, actualizado_en = now()
    from miembros m
   where m.id = w.miembro_id and m.programa_id = p_programa_id;
  get diagnostics n_pases = row_count;

  update recompensas r set costo_puntos = r.costo_puntos * 100 where r.programa_id = p_programa_id;
  get diagnostics n_premios = row_count;

  update canjes c
     set puntos = c.puntos * 100
    from miembros m
   where m.id = c.miembro_id and m.programa_id = p_programa_id;
  get diagnostics n_canjes = row_count;

  -- Las columnas que lee `acreditar_lealtad`: puntos en centésimos y la compra mínima en centavos.
  -- `puntos_por_colon` queda igual (ver arriba).
  update programa_lealtad p
     set puntos_por_visita = p.puntos_por_visita * 100,
         max_por_transaccion = p.max_por_transaccion * 100,
         max_diario_cliente = p.max_diario_cliente * 100,
         compra_minima = p.compra_minima * 100,
         beneficio = p.beneficio
           || jsonb_build_object('moneda', v_moneda, 'escala', 100)
           || jsonb_build_object(
                'porVisita', coalesce((p.beneficio ->> 'porVisita')::numeric, 0) * 100,
                'inicial', coalesce((p.beneficio ->> 'inicial')::numeric, 0) * 100,
                'minimoCanje', coalesce((p.beneficio ->> 'minimoCanje')::numeric, 1) * 100)
           || case when (p.beneficio ->> 'maximo') is null
                   then '{}'::jsonb
                   else jsonb_build_object('maximo', (p.beneficio ->> 'maximo')::numeric * 100) end
   where p.id = p_programa_id;

  return jsonb_build_object(
    'ok', true,
    'moneda', v_moneda,
    'filas_del_ledger', n_ledger,
    'pases', n_pases,
    'premios', n_premios,
    'canjes', n_canjes);
end;
$$;

comment on function public.convertir_puntos_a_decimales(uuid, text) is
  'Pasa una tarjeta de puntos a puntos con decimales (0259): multiplica por 100 el ledger, '
  'los saldos del pase, los premios, los canjes y las columnas de reglas, y declara moneda '
  'y escala 100 en el beneficio. Una transacción, con el lock de todos los miembros. '
  'Solo service_role. El camino de vuelta es revertir_puntos_a_enteros.';


create or replace function public.revertir_puntos_a_enteros(p_programa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prog record;
  v_miembro uuid;
  n_ledger integer;
  n_pases integer;
  n_premios integer;
  n_canjes integer;
begin
  select * into v_prog from programa_lealtad where id = p_programa_id for update;
  if v_prog.id is null then
    raise exception 'Esa tarjeta no existe.' using errcode = '22023';
  end if;
  if v_prog.modo is distinct from 'puntos'
     or jsonb_typeof(v_prog.beneficio) is distinct from 'object'
     or (v_prog.beneficio ->> 'tipo') is distinct from 'puntos'
     or (v_prog.beneficio ->> 'escala') is distinct from '100' then
    raise exception 'Esa tarjeta no cuenta puntos con decimales.' using errcode = '22023';
  end if;

  for v_miembro in select m.id from miembros m where m.programa_id = p_programa_id order by m.id loop
    perform pg_advisory_xact_lock(hashtext('lealtad:' || v_miembro::text));
  end loop;

  -- Solo se vuelve si NADA quedó con decimales: dividir 4.75 puntos por 100 los perdería.
  if exists (
       select 1
         from transacciones_puntos t
         join miembros m on m.id = t.miembro_id
        where m.programa_id = p_programa_id
          and (t.puntos % 100 <> 0 or t.saldo_anterior % 100 <> 0 or t.saldo_posterior % 100 <> 0))
     or exists (
       select 1 from recompensas r where r.programa_id = p_programa_id and r.costo_puntos % 100 <> 0)
     or exists (
       select 1 from canjes c join miembros m on m.id = c.miembro_id
        where m.programa_id = p_programa_id and c.puntos % 100 <> 0)
     or exists (
       select 1 from pases_wallet w join miembros m on m.id = w.miembro_id
        where m.programa_id = p_programa_id and w.saldo_cache % 100 <> 0)
     or coalesce(v_prog.puntos_por_visita % 100, 0) <> 0
     or coalesce(v_prog.max_por_transaccion % 100, 0) <> 0
     or coalesce(v_prog.max_diario_cliente % 100, 0) <> 0
     or coalesce(v_prog.compra_minima % 100, 0) <> 0 then
    raise exception 'Ya hay saldos o premios con decimales: volver a enteros los perdería. No se tocó nada.'
      using errcode = '22023';
  end if;

  update transacciones_puntos t
     set puntos = t.puntos / 100,
         saldo_anterior = t.saldo_anterior / 100,
         saldo_posterior = t.saldo_posterior / 100
    from miembros m
   where m.id = t.miembro_id and m.programa_id = p_programa_id;
  get diagnostics n_ledger = row_count;

  update pases_wallet w
     set saldo_cache = w.saldo_cache / 100, actualizado_en = now()
    from miembros m
   where m.id = w.miembro_id and m.programa_id = p_programa_id;
  get diagnostics n_pases = row_count;

  update recompensas r set costo_puntos = r.costo_puntos / 100 where r.programa_id = p_programa_id;
  get diagnostics n_premios = row_count;

  update canjes c
     set puntos = c.puntos / 100
    from miembros m
   where m.id = c.miembro_id and m.programa_id = p_programa_id;
  get diagnostics n_canjes = row_count;

  update programa_lealtad p
     set puntos_por_visita = p.puntos_por_visita / 100,
         max_por_transaccion = p.max_por_transaccion / 100,
         max_diario_cliente = p.max_diario_cliente / 100,
         compra_minima = p.compra_minima / 100,
         beneficio = (p.beneficio - 'moneda' - 'escala')
           || jsonb_build_object(
                'porVisita', trunc(coalesce((p.beneficio ->> 'porVisita')::numeric, 0) / 100),
                'inicial', trunc(coalesce((p.beneficio ->> 'inicial')::numeric, 0) / 100),
                'minimoCanje', trunc(coalesce((p.beneficio ->> 'minimoCanje')::numeric, 100) / 100))
           || case when (p.beneficio ->> 'maximo') is null
                   then '{}'::jsonb
                   else jsonb_build_object('maximo', trunc((p.beneficio ->> 'maximo')::numeric / 100)) end
   where p.id = p_programa_id;

  return jsonb_build_object(
    'ok', true,
    'filas_del_ledger', n_ledger,
    'pases', n_pases,
    'premios', n_premios,
    'canjes', n_canjes);
end;
$$;

comment on function public.revertir_puntos_a_enteros(uuid) is
  'El volver atrás de convertir_puntos_a_decimales (0259): divide por 100 y quita moneda y '
  'escala, solo si nada quedó con decimales. Una transacción. Solo service_role.';

-- Mismo criterio que la 0125, la 0253 y la 0258: lo que mueve saldos va SOLO a service_role.
revoke all on function public.convertir_puntos_a_decimales(uuid, text) from public, anon, authenticated;
revoke all on function public.revertir_puntos_a_enteros(uuid) from public, anon, authenticated;
grant execute on function public.convertir_puntos_a_decimales(uuid, text) to service_role;
grant execute on function public.revertir_puntos_a_enteros(uuid) to service_role;
