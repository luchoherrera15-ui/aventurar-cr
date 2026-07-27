-- ============================================================
-- AVENTUREA CR — Completar la reserva por función, no por UPDATE
-- directo
--
-- Error que resuelve: "new row violates row-level security
-- policy for table reservas" justo al tocar "Confirmar mi
-- reserva" (el paso que pasa el hold de 'temporal' a 'pendiente'
-- con todos los datos del cliente).
--
-- La política de UPDATE para ese paso (0004/0005/0025) debería
-- alcanzar, pero en la práctica algunos proyectos de Supabase se
-- quedan en un estado intermedio difícil de diagnosticar a
-- ciegas desde afuera. En vez de seguir ajustando la política,
-- este paso pasa a hacerse con una función security definer —
-- el mismo patrón que ya usan liberar_hold_temporal (0017) y
-- redimir_codigo_descuento (0013) para este mismo tipo de
-- fricción con un visitante anónimo.
--
-- La función es la única puerta: solo actualiza si la fila
-- todavía está en 'temporal' (no se puede usar para alterar una
-- reserva ya confirmada o rechazada), y las restricciones de
-- columna (cédula, método de pago, etc.) se siguen aplicando
-- igual — security definer solo salta el RLS, no los checks.
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- Devuelve el rancho_id de la reserva si la actualizó, o null si no
-- había ningún hold vigente con ese id. De paso resuelve otro bug: el
-- código de después hacía un SELECT aparte para conseguir el
-- rancho_id y canjear el código de descuento, pero para entonces la
-- fila ya había pasado a 'pendiente' y un visitante anónimo ya no
-- podía verla bajo RLS — el descuento se perdía en silencio. Al venir
-- en el mismo RETURNING no hace falta ese segundo SELECT.
create or replace function public.completar_reserva_temporal(
  p_id uuid,
  p_nombre text,
  p_contacto text,
  p_cedula text,
  p_tipo_evento text,
  p_invitados integer,
  p_horario_bloque text,
  p_monto_total numeric,
  p_deposito_monto numeric,
  p_metodo_pago text,
  p_deposito_comprobante_url text,
  p_terminos_aceptados boolean,
  p_notas text,
  p_codigo_descuento text,
  p_descuento_monto numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho_id uuid;
begin
  update reservas
  set
    nombre = p_nombre,
    contacto = p_contacto,
    cedula = p_cedula,
    tipo_evento = p_tipo_evento,
    invitados = p_invitados,
    horario_bloque = p_horario_bloque,
    monto_total = p_monto_total,
    deposito_monto = p_deposito_monto,
    metodo_pago = p_metodo_pago,
    deposito_comprobante_url = p_deposito_comprobante_url,
    terminos_aceptados = p_terminos_aceptados,
    notas = p_notas,
    codigo_descuento = p_codigo_descuento,
    descuento_monto = p_descuento_monto,
    estado = 'pendiente'
  where id = p_id
    and estado = 'temporal'
  returning rancho_id into v_rancho_id;

  return v_rancho_id;
end;
$$;

grant execute on function public.completar_reserva_temporal(
  uuid, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, text, text, numeric
) to anon, authenticated;

notify pgrst, 'reload schema';
