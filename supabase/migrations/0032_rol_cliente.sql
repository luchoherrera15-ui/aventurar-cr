-- ============================================================
-- BOOKEAR CR — Rol "cliente" para la app móvil
--
-- Hasta ahora `perfiles.rol` solo distinguía "admin" de
-- "dueno_rancho" (quien tiene un negocio publicado). Quien reserva
-- nunca tenía cuenta: la web lo deja reservar como visitante
-- anónimo (solo correo/whatsapp/cédula sueltos en `reservas`).
--
-- La app móvil ahora permite registrarse como cliente (opcional,
-- nunca obligatorio para reservar) para tener un panel con sus
-- reservas. Ese registro no debe convertirlo en "dueno_rancho": por
-- eso el trigger que arma el perfil ahora lee el rol que le mande
-- el registro (metadata `rol`), y solo cae a 'dueno_rancho' por
-- defecto si no mandaron nada — así el registro de proveedores en
-- /mi-rancho/registro sigue exactamente igual que antes.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('admin', 'dueno_rancho', 'cliente'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre',
    coalesce(new.raw_user_meta_data->>'rol', 'dueno_rancho')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Reservas: a qué cuenta de cliente pertenece (si reservó logueado)
-- ------------------------------------------------------------

alter table reservas add column if not exists cliente_id uuid references auth.users(id) on delete set null;

-- `auth.uid()` refleja la sesión de quien llama al RPC (aunque la
-- función sea security definer): si reservó sin cuenta da null, igual
-- que siempre. No hace falta que la app mande su propio id — no se
-- puede confiar en un valor que mande el cliente para esto.
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
    cliente_id = auth.uid(),
    estado = 'pendiente'
  where id = p_id
    and estado = 'temporal'
  returning rancho_id into v_rancho_id;

  return v_rancho_id;
end;
$$;

-- ------------------------------------------------------------
-- El cliente ve sus propias reservas (además del admin y el dueño
-- del rancho, que ya podían verlas)
-- ------------------------------------------------------------

drop policy if exists "El equipo ve todas las reservas" on reservas;
create policy "El equipo ve todas las reservas" on reservas
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
    or cliente_id = auth.uid()
  );

notify pgrst, 'reload schema';
