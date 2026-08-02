-- ============================================================
-- BOOKEA — Roles blindados (0086)
--
-- Tres arreglos del sistema de roles. El primero es grave.
--
-- 1) EL ROL YA NO LO DECIDE QUIEN SE REGISTRA
--
--    `handle_new_user` (0056) tomaba el rol de la metadata del alta:
--        coalesce(new.raw_user_meta_data->>'rol', 'cliente')
--    Esa metadata es el `options.data` de signInWithOtp, o sea la
--    escribe el navegador — y la anon key está publicada en el bundle.
--    Alguien pedía su código con data:{rol:'admin'}, lo recibía en su
--    propio correo, y nacía administrador de la plataforma: el panel
--    /admin lee TODO con la llave de servicio (cuentas, finanzas,
--    comprobantes de pago, pedidos).
--
--    Ahora el rol de toda cuenta nueva es 'cliente', sin excepción. No
--    rompe ningún flujo: el único valor que mandaba la app era
--    'cliente', /mi-rancho/registro no manda nada, y el ascenso a
--    dueño lo da publicar un negocio (punto 2).
--
--    OJO: esto NO arregla una cuenta que ya se haya colado. Revisar a
--    mano quién es admin hoy:
--        select id, email, nombre, rol, created_at
--        from perfiles where rol = 'admin' order by created_at;
--
-- 2) EL ASCENSO A DUEÑO DE NEGOCIO NUNCA FUNCIONÓ
--
--    /mi-rancho/nuevo hacía `update perfiles set rol='dueno_rancho'`
--    con la sesión del propio usuario, pero la política de `perfiles`
--    (0009) solo deja editar a un admin. El update afectaba 0 filas y
--    no devolvía error, así que todo el que publicó su negocio se
--    quedó marcado como 'cliente' para siempre — y las campañas por
--    segmento nunca le llegaron como proveedor.
--
--    Se resuelve con una función de permisos elevados que hace UNA
--    cosa y nada más, igual que `actualizar_mi_nombre` (0041): subir a
--    quien la llama de 'cliente' a 'dueno_rancho'. Nunca a 'admin',
--    nunca a la inversa, y nunca la fila de otro. Y se arregla de una
--    vez a los que ya tienen negocio.
--
-- 3) NO SE PUEDE QUEDAR SIN ADMINISTRADORES
--
--    `cambiarRol` dejaba que un admin se bajara a sí mismo. Si era el
--    único, Bookea se quedaba sin panel y solo se recuperaba entrando
--    a la base a mano.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Toda cuenta nueva nace cliente
-- ------------------------------------------------------------

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
    coalesce(
      new.raw_user_meta_data->>'nombre',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    -- Fijo, NO `raw_user_meta_data->>'rol'`: ese campo lo escribe el
    -- navegador. El rol se otorga después, y solo desde el servidor.
    'cliente'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. Publicar un negocio asciende a dueño
-- ------------------------------------------------------------

create or replace function public.promoverse_a_dueno()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  if auth.uid() is null then
    raise exception 'Necesitás una sesión.';
  end if;

  -- Solo sube de 'cliente'. Un admin sigue siendo admin (bajarlo sería
  -- un downgrade encubierto) y un dueño ya está donde tiene que estar.
  update perfiles
     set rol = 'dueno_rancho'
   where id = auth.uid()
     and rol = 'cliente';

  select rol into v_rol from perfiles where id = auth.uid();
  return v_rol;
end;
$$;

revoke all on function public.promoverse_a_dueno() from public, anon;
grant execute on function public.promoverse_a_dueno() to authenticated;

-- Los que ya publicaron y se quedaron marcados como clientes por el
-- update que nunca pasó. Nunca toca a un admin.
update perfiles p
   set rol = 'dueno_rancho'
 where p.rol = 'cliente'
   and exists (select 1 from ranchos r where r.owner_id = p.id);

-- ------------------------------------------------------------
-- 3. Siempre tiene que quedar al menos un administrador
-- ------------------------------------------------------------

create or replace function public.proteger_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.rol = 'admin' and new.rol is distinct from 'admin' then
    -- En un BEFORE UPDATE la fila vieja todavía cuenta como admin, así
    -- que "1" significa que ésta es la última.
    if (select count(*) from perfiles where rol = 'admin') <= 1 then
      raise exception
        'No se puede quitar el último administrador: la plataforma quedaría sin panel. Nombrá a otro admin primero.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_ultimo_admin on perfiles;
create trigger proteger_ultimo_admin
  before update of rol on perfiles
  for each row execute function public.proteger_ultimo_admin();

notify pgrst, 'reload schema';
