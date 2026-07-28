-- ------------------------------------------------------------
-- 1. Reservas hechas desde la app
--
-- La columna `origen` nació con solo dos valores posibles ('web' y
-- 'manual'), cuando todavía no existía la app. La app manda 'movil'
-- para poder distinguir de dónde viene cada reserva — y como ese
-- valor no estaba permitido, TODA reserva iniciada desde el teléfono
-- fallaba al bloquear la fecha con
-- "violates check constraint reservas_origen_check".
-- ------------------------------------------------------------

alter table reservas drop constraint if exists reservas_origen_check;
alter table reservas add constraint reservas_origen_check
  check (origen in ('web', 'movil', 'manual'));

-- ------------------------------------------------------------
-- 2. Que cada quien pueda ponerse su nombre
--
-- Con el acceso por código al correo ya no se pide el nombre en
-- ningún momento, así que todos los perfiles quedaban sin nombre y la
-- app mostraba siempre "Tu cuenta". La tabla `perfiles` solo deja
-- editar al admin (migración 0009) y aflojar esa policy sería un
-- agujero: cualquiera podría cambiarse el `rol` a 'admin'.
--
-- Por eso el nombre se cambia con esta función, que corre con
-- permisos elevados pero toca ÚNICAMENTE la columna `nombre` de la
-- fila de quien la llama. El rol queda fuera de su alcance.
-- ------------------------------------------------------------

create or replace function public.actualizar_mi_nombre(p_nombre text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limpio text;
begin
  if auth.uid() is null then
    raise exception 'Necesitás una sesión para cambiar tu nombre.';
  end if;

  v_limpio := nullif(btrim(p_nombre), '');
  if v_limpio is not null and length(v_limpio) > 60 then
    v_limpio := left(v_limpio, 60);
  end if;

  update perfiles set nombre = v_limpio where id = auth.uid();
  return v_limpio;
end;
$$;

grant execute on function public.actualizar_mi_nombre(text) to authenticated;

notify pgrst, 'reload schema';
