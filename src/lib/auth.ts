import { createClient } from "@/lib/supabase/server";
import { sesionDesdeBearer } from "@/lib/supabase/bearer";

/**
 * ¿Es admin quien manda esta petición? Sirve para las rutas de API que
 * atienden al sitio Y al app: el navegador manda cookies y el teléfono
 * manda `Authorization: Bearer`, así que se prueban las dos.
 *
 * El rol se consulta SIEMPRE contra la tabla `perfiles` con la sesión
 * de quien pregunta — nunca se cree lo que venga en el cuerpo ni en un
 * header. Devuelve también el id para poder dejar el gasto a su nombre.
 */
export async function adminDeLaPeticion(
  req: Request,
): Promise<{ ok: boolean; usuarioId: string | null }> {
  const sesionApp = await sesionDesdeBearer(req);
  if (sesionApp) {
    const { data } = await sesionApp.supabase
      .from("perfiles")
      .select("rol")
      .eq("id", sesionApp.usuarioId)
      .single();
    return { ok: data?.rol === "admin", usuarioId: sesionApp.usuarioId };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, usuarioId: null };

  const { data } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  return { ok: data?.rol === "admin", usuarioId: user.id };
}

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
