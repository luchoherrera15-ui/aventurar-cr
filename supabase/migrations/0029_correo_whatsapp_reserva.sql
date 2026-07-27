-- ============================================================
-- AVENTUREA CR — Correo y WhatsApp obligatorios y separados
--
-- El paso 1 de la reserva pedía "WhatsApp o correo" en un solo
-- campo, a elección del cliente. Ahora se piden los dos, cada uno
-- en su propio campo, porque el negocio los necesita para dos
-- cosas distintas: el correo para las confirmaciones automáticas
-- (Resend) y el WhatsApp para que el proveedor pueda escribirle
-- directo.
--
-- `contacto` (el campo viejo, ya nullable desde 0004/0005) se deja
-- tal cual para no romper las reservas ya guardadas — las nuevas
-- simplemente no lo vuelven a llenar, y las vistas que lo mostraban
-- caen a él solo si `correo`/`whatsapp` vienen vacíos.
--
-- La función completar_reserva_temporal cambia de firma (p_contacto
-- sale, p_correo y p_whatsapp entran) — hay que recrearla porque
-- CREATE OR REPLACE no permite cambiar parámetros.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table reservas add column if not exists correo text;
alter table reservas add column if not exists whatsapp text;

drop function if exists public.completar_reserva_temporal(
  uuid, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, boolean, text, text, numeric
);

create or replace function public.completar_reserva_temporal(
  p_id uuid,
  p_nombre text,
  p_correo text,
  p_whatsapp text,
  p_cedula text,
  p_tipo_evento text,
  p_invitados integer,
  p_horario_bloque text,
  p_monto_total numeric,
  p_deposito_monto numeric,
  p_metodo_pago text,
  p_deposito_comprobante_url text,
  p_terminos_aceptados boolean,
  p_aviso_prohibiciones_aceptado boolean,
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
    correo = p_correo,
    whatsapp = p_whatsapp,
    cedula = p_cedula,
    tipo_evento = p_tipo_evento,
    invitados = p_invitados,
    horario_bloque = p_horario_bloque,
    monto_total = p_monto_total,
    deposito_monto = p_deposito_monto,
    metodo_pago = p_metodo_pago,
    deposito_comprobante_url = p_deposito_comprobante_url,
    terminos_aceptados = p_terminos_aceptados,
    aviso_prohibiciones_aceptado = p_aviso_prohibiciones_aceptado,
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
  uuid, text, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, boolean, text, text, numeric
) to anon, authenticated;

notify pgrst, 'reload schema';
