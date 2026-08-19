
-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — cerrar dos huecos de operación real (0191)
--
-- El dueño pidió: "completá el producto hoy, sin reconstruir el core
-- ni cambiar la arquitectura aprobada". Esta migración NO toca el
-- esquema, NO cambia el mecanismo del candado (pg_advisory_xact_lock)
-- ni la independencia de `ranchos`. Corrige dos huecos reales
-- encontrados en una auditoría de tres agentes independientes, los
-- tres coincidiendo en los mismos dos puntos:
--
-- 1. crear_reserva_food() (0190) solo comparaba la FECHA de la franja
--    contra hoy, nunca la HORA. Una franja de hoy cuya hora ya pasó
--    seguía aceptando reservas hasta la medianoche. Se corrige con UN
--    `create or replace` que agrega la comparación de hora — mismo
--    candado, mismos parámetros, mismo cuerpo salvo esa condición.
--
-- 2. No existía ninguna forma de que un cliente cancelara su propia
--    reserva y liberara el cupo. cancelar_reserva_food() es una
--    función HERMANA nueva — no modifica crear_reserva_food() — que
--    usa el MISMO patrón de candado transaccional para descontar
--    `reservado` de forma atómica y segura.
--
-- El "no-show" (el negocio marca que alguien no llegó) NO libera
-- cupo: la mesa estuvo reservada y no disponible para nadie más en esa
-- franja, se haya presentado o no. Por eso es un simple cambio de
-- `estado` desde la aplicación (ya cubierto por el grant de columna de
-- la 0190) y no necesita RPC propio.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. crear_reserva_food() — agrega la comparación de HORA, no solo
--    fecha. Idéntica en todo lo demás a la versión de la 0190.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.crear_reserva_food(
  p_franja_id uuid,
  p_customer_id uuid,
  p_party_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_franja record;
  v_codigo text;
  v_reserva_id uuid;
  v_intento integer;
begin
  if p_party_size is null or p_party_size <= 0 or p_party_size > 30 then
    return jsonb_build_object('ok', false, 'motivo', 'La cantidad de personas no es válida.');
  end if;

  perform pg_advisory_xact_lock(hashtext('food_franja:' || p_franja_id::text));

  select * into v_franja from food_franjas where id = p_franja_id;
  if v_franja.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'Esa franja no existe.');
  end if;
  if not v_franja.activa then
    return jsonb_build_object('ok', false, 'motivo', 'Esa franja ya no está disponible.');
  end if;
  -- CORRECCIÓN 0191: fecha Y hora, no solo fecha. Una franja de hoy a
  -- una hora que ya pasó es tan inválida como una de ayer.
  if (v_franja.fecha + v_franja.hora) < (now() at time zone 'America/Costa_Rica') then
    return jsonb_build_object('ok', false, 'motivo', 'Esa franja ya pasó.');
  end if;
  if (v_franja.capacidad - v_franja.reservado) < p_party_size then
    return jsonb_build_object('ok', false, 'motivo',
      'No hay cupo suficiente: quedan ' || (v_franja.capacidad - v_franja.reservado) || ' lugares.');
  end if;

  v_reserva_id := null;
  for v_intento in 1..5 loop
    v_codigo := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin
      insert into food_reservations
        (franja_id, business_id, customer_id, party_size, descuento_porcentaje, codigo_confirmacion)
      values
        (p_franja_id, v_franja.business_id, p_customer_id, p_party_size,
         v_franja.descuento_porcentaje, v_codigo)
      returning id into v_reserva_id;
      exit;
    exception when unique_violation then
      v_reserva_id := null;
    end;
  end loop;

  if v_reserva_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'No se pudo generar un código, intentá de nuevo.');
  end if;

  update food_franjas set reservado = reservado + p_party_size, updated_at = now()
   where id = p_franja_id;

  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'codigo', v_codigo,
    'descuento_porcentaje', v_franja.descuento_porcentaje,
    'fecha', v_franja.fecha,
    'hora', v_franja.hora
  );
end;
$$;

revoke all on function public.crear_reserva_food(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.crear_reserva_food(uuid, uuid, integer) to service_role;


-- ─────────────────────────────────────────────────────────────────
-- 2. cancelar_reserva_food() — nueva, hermana de crear_reserva_food().
--    Mismo candado por franja, para que cancelar y reservar sobre la
--    misma franja se sigan serializando entre sí.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.cancelar_reserva_food(
  p_reserva_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva record;
begin
  select * into v_reserva from food_reservations where id = p_reserva_id;
  if v_reserva.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'Esa reserva no existe.');
  end if;
  if v_reserva.customer_id <> p_customer_id then
    return jsonb_build_object('ok', false, 'motivo', 'Esa reserva no es tuya.');
  end if;
  if v_reserva.estado <> 'confirmada' then
    return jsonb_build_object('ok', false, 'motivo', 'Esa reserva ya está ' || v_reserva.estado || '.');
  end if;

  -- Mismo candado que crear_reserva_food(): cancelar y reservar sobre
  -- la misma franja al mismo tiempo se serializan entre sí, así que el
  -- cupo liberado acá nunca se pisa con una reserva a mitad de camino.
  perform pg_advisory_xact_lock(hashtext('food_franja:' || v_reserva.franja_id::text));

  update food_reservations
     set estado = 'cancelada', cancelled_at = now()
   where id = p_reserva_id;

  -- `greatest(0, …)`: cinturón extra. reservado nunca debería poder
  -- bajar de 0 (solo lo mueven estas dos funciones, siempre en pares
  -- coherentes), pero un 0 en vez de un negativo es el fallo seguro si
  -- algún día algo más lo toca.
  update food_franjas
     set reservado = greatest(0, reservado - v_reserva.party_size), updated_at = now()
   where id = v_reserva.franja_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Mismo criterio que crear_reserva_food(): solo service_role. El
-- servidor confirma `p_customer_id` contra la sesión ANTES de invocar
-- (ver food/mis-reservas y food/reserva/[id]) — el navegador nunca
-- decide de quién es la reserva que está cancelando.
revoke all on function public.cancelar_reserva_food(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancelar_reserva_food(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
