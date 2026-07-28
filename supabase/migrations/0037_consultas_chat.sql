-- ------------------------------------------------------------
-- Chat de consulta ANTES de reservar.
--
-- Hasta ahora cada conversación nacía de una reserva (un hilo por
-- reserva). Para eliminar WhatsApp del todo falta el caso "tengo una
-- duda antes de reservar": un hilo directo cliente ↔ negocio sin
-- reserva de por medio. Mismas tablas, mismo realtime, misma bandeja
-- — solo se permite que reserva_id sea null en ese caso, con UN hilo
-- de consulta por cliente y negocio (si después reserva, esa reserva
-- abre su propio hilo como siempre).
-- ------------------------------------------------------------

alter table conversaciones alter column reserva_id drop not null;

-- Un solo hilo de consulta por (negocio, cliente). Los hilos con
-- reserva ya tienen su unique propio en reserva_id (los null no chocan
-- entre sí en un unique normal, por eso este índice parcial aparte).
create unique index if not exists conversaciones_consulta_unica
  on conversaciones (rancho_id, cliente_id)
  where reserva_id is null;

-- El trigger que completa cliente/rancho/proveedor ahora tiene dos
-- caminos: con reserva (igual que antes, todo sale de la reserva) o
-- sin reserva (consulta: el cliente es quien inserta — auth.uid(), no
-- lo que diga el payload — y el proveedor sale del rancho indicado).
create or replace function conversacion_completar_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reserva_id is not null then
    select r.cliente_id, r.rancho_id into new.cliente_id, new.rancho_id
    from reservas r where r.id = new.reserva_id;

    if new.rancho_id is null then
      raise exception 'La reserva % no tiene un proveedor asociado', new.reserva_id;
    end if;
    if new.cliente_id is null then
      raise exception 'La reserva % no tiene un cliente asociado', new.reserva_id;
    end if;
  else
    if new.rancho_id is null then
      raise exception 'Una consulta necesita el rancho_id del negocio';
    end if;
    new.cliente_id := auth.uid();
    if new.cliente_id is null then
      raise exception 'Iniciá sesión para abrir una consulta';
    end if;
  end if;

  select ra.owner_id into new.proveedor_id from ranchos ra where ra.id = new.rancho_id;
  if new.proveedor_id is null then
    raise exception 'El negocio % no existe', new.rancho_id;
  end if;
  return new;
end;
$$;

-- La policy de insert suma el caso consulta: cualquier cuenta con
-- sesión puede abrirle un hilo a un negocio aprobado que no sea suyo.
drop policy if exists "Cliente o proveedor de la reserva abren el hilo" on conversaciones;
create policy "Cliente o proveedor de la reserva abren el hilo" on conversaciones
  for insert to authenticated
  with check (
    (
      reserva_id is not null
      and exists (
        select 1 from reservas r
        join ranchos ra on ra.id = r.rancho_id
        where r.id = reserva_id
          and (r.cliente_id = auth.uid() or ra.owner_id = auth.uid())
      )
    )
    or (
      reserva_id is null
      and exists (
        select 1 from ranchos ra
        where ra.id = rancho_id
          and ra.estado = 'aprobado'
          and ra.owner_id <> auth.uid()
      )
    )
  );
