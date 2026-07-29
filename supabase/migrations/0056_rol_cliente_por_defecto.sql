-- ------------------------------------------------------------
-- Una cuenta nueva nace como CLIENTE, no como dueño de negocio.
--
-- El trigger de 0032 usaba 'dueno_rancho' como rol por defecto cuando
-- la metadata no traía uno. Los flujos de correo+código sí mandan
-- rol:'cliente', pero "Continuar con Google" (signInWithOAuth) no
-- permite mandar metadata propia — así que cada cuenta nueva de Google
-- nacía como dueño de negocio sin serlo.
--
-- Es seguro cambiar el default: quien publica su primer negocio es
-- promovido a 'dueno_rancho' automáticamente (mi-rancho/nuevo), nunca
-- al revés. También copia el nombre de Google (full_name/name) si
-- viene, para que el perfil no nazca sin nombre.
--
-- Es seguro correr esta migración varias veces.
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
    coalesce(new.raw_user_meta_data->>'rol', 'cliente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
