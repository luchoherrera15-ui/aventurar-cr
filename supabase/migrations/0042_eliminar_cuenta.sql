-- ============================================================
-- 0042 — Eliminar la propia cuenta desde la app
--
-- App Store lo exige (guideline 5.1.1): toda app donde se pueda
-- crear una cuenta tiene que permitir borrarla desde adentro. La
-- función corre como security definer porque borrar en auth.users
-- está fuera del alcance del rol authenticated.
--
-- Qué pasa al borrar (según los FKs ya existentes):
--   · perfiles, favoritos, reseñas, conversaciones y mensajes se
--     van en cascada; los negocios del usuario (ranchos) también.
--   · las reservas hechas como cliente QUEDAN (cliente_id pasa a
--     null): son parte de la historia del negocio del proveedor.
-- ============================================================

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitás una sesión para eliminar tu cuenta.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.eliminar_mi_cuenta() from public;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
