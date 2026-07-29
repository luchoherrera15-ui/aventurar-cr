-- ------------------------------------------------------------
-- La agenda deja de ser "un evento por día para todos".
--
-- Desde 0011 hay un índice único (rancho_id, fecha) sobre las
-- reservas confirmadas. Para un Lugar es correcto: el salón se
-- alquila entero y nadie más lo usa ese día. Pero deja afuera a todo
-- lo demás — un catering que atiende dos eventos el mismo sábado, un
-- photobooth con tres turnos. El código ya creía que eso funcionaba
-- (ver cotizacion-actions.ts y agenda-actions.ts) y la base lo
-- rechazaba con un 23505 que le llegaba crudo al proveedor.
--
-- El cupo pasa a ser del NEGOCIO, no de la categoría: cada quien dice
-- cuántos eventos atiende por día. null = sin tope.
--
-- Un índice único no puede expresar "hasta N" ni leer otra tabla, así
-- que la comprobación pasa a un disparador. Se serializa con un
-- advisory lock por (rancho, fecha) para que dos confirmaciones
-- simultáneas no pasen las dos, y levanta la excepción con el mismo
-- errcode 23505 de antes para que todo el manejo de errores que ya
-- existe en el código siga funcionando sin tocarlo.
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

alter table ranchos add column if not exists eventos_por_dia integer;

alter table ranchos drop constraint if exists ranchos_eventos_por_dia_check;
alter table ranchos add constraint ranchos_eventos_por_dia_check
  check (eventos_por_dia is null or eventos_por_dia between 1 and 50);

-- Los lugares quedan exactamente como estaban: un evento por día.
update ranchos set eventos_por_dia = 1
where categoria = 'lugares' and eventos_por_dia is null;

drop index if exists unique_confirmed_date;

create or replace function public.reservas_respeta_cupo_dia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cupo integer;
  v_usadas integer;
begin
  -- Solo interesa el momento en que una reserva pasa a ocupar el día.
  if new.estado <> 'confirmada' or new.rancho_id is null then
    return new;
  end if;

  -- Si ya estaba confirmada para ese mismo rancho y fecha, no se
  -- recuenta contra sí misma: marcar el depósito o cambiar montos no
  -- puede hacer que su propia reserva la eche.
  if tg_op = 'UPDATE'
     and old.estado = 'confirmada'
     and old.rancho_id is not distinct from new.rancho_id
     and old.fecha = new.fecha then
    return new;
  end if;

  -- Si un negocio no configuró su cupo, los lugares caen igual en 1.
  -- Esta red es la que hace seguro haber borrado el índice único: aunque
  -- el alta de un salón nuevo se olvide de fijarlo, no puede doblar fecha.
  select coalesce(
           r.eventos_por_dia,
           case when r.categoria = 'lugares' then 1 else null end
         )
    into v_cupo
  from ranchos r
  where r.id = new.rancho_id;

  if v_cupo is null then
    return new;
  end if;

  -- Serializa las confirmaciones de este negocio para esta fecha. Sin
  -- esto, dos "Aprobar" a la vez leerían el mismo conteo y pasarían
  -- ambas. Se libera solo al terminar la transacción.
  perform pg_advisory_xact_lock(
    hashtext(new.rancho_id::text || ':' || new.fecha::text)
  );

  select count(*)
    into v_usadas
  from reservas x
  where x.rancho_id = new.rancho_id
    and x.fecha = new.fecha
    and x.estado = 'confirmada'
    and x.id <> new.id;

  if v_usadas >= v_cupo then
    raise exception using
      errcode = '23505',
      message = case
        when v_cupo = 1
          then 'Esa fecha ya tiene una reserva confirmada.'
        else 'Ya tenés ' || v_cupo ||
             ' reservas confirmadas para esa fecha — es tu cupo del día.'
      end;
  end if;

  return new;
end;
$$;

-- `update of estado, fecha, rancho_id` a propósito: validar el depósito
-- o registrar un pago no tiene por qué disparar esta comprobación.
drop trigger if exists reservas_cupo_dia on reservas;
create trigger reservas_cupo_dia
  before insert or update of estado, fecha, rancho_id on reservas
  for each row execute function public.reservas_respeta_cupo_dia();

notify pgrst, 'reload schema';
