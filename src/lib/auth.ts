import { createClient } from "@/lib/supabase/server";

/**
 * Confirma que quien hace la petición tiene una sesión con rol "admin".
 * Las políticas de seguridad de Supabase ya lo bloquean por su cuenta;
 * esto es una segunda barrera para fallar temprano y con un mensaje claro.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  return { supabase, ok: perfil?.rol === "admin" };
}

/**
 * Confirma acceso al panel de un rancho: el dueño de la publicación o
 * cualquier admin del equipo (que puede entrar a modificarla en su
 * nombre, por ejemplo cuando el proveedor pide ayuda). Las políticas de
 * la base ya permiten ambos casos — esto evita que cada acción repita
 * la misma consulta de "id" o "owner_id".
 */
export async function verificarAccesoRancho(ranchoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, ok: false as const, esAdmin: false };

  const [{ data: rancho }, { data: perfil }] = await Promise.all([
    supabase.from("ranchos").select("owner_id").eq("id", ranchoId).maybeSingle(),
    supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle(),
  ]);

  const esAdmin = perfil?.rol === "admin";
  const ok = !!rancho && (rancho.owner_id === user.id || esAdmin);
  return { supabase, user, ok, esAdmin };
}
