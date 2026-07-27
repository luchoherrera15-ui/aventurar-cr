-- ============================================================
-- AVENTUREA CR — Aceptación explícita del aviso de prohibiciones
--
-- El paso 1 de la reserva ahora exige un check aparte del de
-- términos y condiciones: que el cliente confirme que su evento
-- no es una serenata, una fiesta de menores de edad ni una fiesta
-- clandestina con venta de alcohol. Es la forma de poder
-- corroborar después que se le avisó y lo aceptó, no solo un
-- texto que nadie tuvo que marcar.
--
-- Se agrega como columna aparte de `terminos_aceptados` (no lo
-- reemplaza) porque son dos aceptaciones distintas con dos
-- objetivos distintos: una es la letra chica general del
-- servicio, la otra es específicamente esta prohibición.
--
-- La función completar_reserva_temporal (0026) cambia de firma
-- para recibirlo, así que hay que recrearla — CREATE OR REPLACE
-- no permite cambiar la lista de parámetros de una función.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table reservas
  add column if not exists aviso_prohibiciones_aceptado boolean not null default false;

drop function if exists public.completar_reserva_temporal(
  uuid, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, text, text, numeric
);

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
  uuid, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, boolean, text, text, numeric
) to anon, authenticated;

notify pgrst, 'reload schema';
