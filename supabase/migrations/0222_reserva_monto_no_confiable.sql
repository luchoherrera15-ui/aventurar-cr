-- ============================================================
--  SEGURIDAD · el monto de la reserva no se le cree al que llama
-- ============================================================
--
-- Auditoría (docs/seguridad-auditoria-2026-08-29.md, ALTA): la RPC
-- `completar_reserva_temporal` (0026) escribía `monto_total`,
-- `deposito_monto` y `descuento_monto` TAL COMO se los pasaba el que
-- llama, y está concedida a `anon`. La web ya recalcula el monto en su
-- server action, pero eso NO alcanza: cualquiera puede llamar la RPC
-- directo con la anon key (y la app MÓVIL la llama directo), pasando
-- `p_monto_total = 0` para reservar por ₡0 o achicar la comisión que
-- Bookea devenga sobre el monto.
--
-- El recálculo EXACTO del precio vive en TypeScript (precio-lugar,
-- tiers, servicios, promos) y portarlo entero a SQL es grande y
-- riesgoso para un flujo de reservas en vivo. Este backstop pone en la
-- BASE —donde protege a las dos apps por igual— las tres reglas que TODA
-- reserva legítima cumple, así que no rompe ninguna y cierra los casos
-- absurdos:
--   1) `monto_total` tiene que ser > 0 (mata el ₡0).
--   2) el `deposito_monto` lo fija el SERVIDOR desde `ranchos`
--      (`deposito_reserva`, default 25000), acotado a no superar el
--      total — el que llama ya no puede fingir un depósito de ₡0.
--   3) si el negocio pide depósito (> 0), el comprobante es
--      OBLIGATORIO para pasar el hold a `pendiente` (ocupar la fecha).
--
-- Queda señalado como pendiente el recálculo exacto del monto en SQL
-- (o enrutar la app móvil por un endpoint de servidor que recalcule),
-- que es la única forma de igualar centavo a centavo lo que la ficha
-- mostró. Es un cambio coordinado web+móvil+base, a decidir aparte.

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
  v_deposito_base numeric;
  v_deposito numeric;
begin
  -- El depósito lo dice la base, no el que llama.
  select coalesce(deposito_reserva, 25000)
    into v_deposito_base
    from ranchos
    where id = (select rancho_id from reservas where id = p_id and estado = 'temporal');

  if v_deposito_base is null then
    -- El hold no existe o ya no es temporal: nada que completar.
    return null;
  end if;

  -- 1) monto plausible.
  if p_monto_total is null or p_monto_total <= 0 then
    raise exception 'monto_total inválido';
  end if;

  -- 2) el depósito nunca supera el total; y sale del servidor.
  v_deposito := least(v_deposito_base, p_monto_total);

  -- 3) si hay depósito, el comprobante es obligatorio y el método válido.
  if v_deposito > 0 then
    if p_deposito_comprobante_url is null or length(trim(p_deposito_comprobante_url)) = 0 then
      raise exception 'falta el comprobante del depósito';
    end if;
    if p_metodo_pago is null or p_metodo_pago not in ('sinpe', 'transferencia') then
      raise exception 'método de pago inválido';
    end if;
  end if;

  update reservas
  set
    nombre = p_nombre,
    contacto = p_contacto,
    cedula = p_cedula,
    tipo_evento = p_tipo_evento,
    invitados = p_invitados,
    horario_bloque = p_horario_bloque,
    monto_total = p_monto_total,
    deposito_monto = v_deposito,           -- servidor, no el que llama
    metodo_pago = p_metodo_pago,
    deposito_comprobante_url = p_deposito_comprobante_url,
    terminos_aceptados = p_terminos_aceptados,
    notas = p_notas,
    codigo_descuento = p_codigo_descuento,
    descuento_monto = greatest(0, coalesce(p_descuento_monto, 0)),
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
