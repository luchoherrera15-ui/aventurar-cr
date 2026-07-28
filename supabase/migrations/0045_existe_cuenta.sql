-- ============================================================
-- 0045 — ¿Ya existe una cuenta con este correo?
--
-- El login de /cuenta mezcla login y registro en un solo formulario:
-- si el correo es nuevo hay que pedirle el nombre antes de mandar el
-- código; si ya tiene cuenta, no. Para decidir cuál de los dos casos
-- es, sin iniciar sesión todavía, hace falta una consulta que
-- cualquiera pueda llamar mid-formulario — de ahí esta función.
--
-- Solo devuelve true/false. No expone nombre, rol ni ningún otro dato
-- del perfil — lo mismo que ya revela "olvidé mi contraseña" en
-- cualquier sitio con login.
-- ============================================================

create or replace function public.existe_cuenta(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from perfiles where email = lower(btrim(p_email))
  );
$$;

revoke all on function public.existe_cuenta(text) from public;
grant execute on function public.existe_cuenta(text) to anon, authenticated;
