import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ¿LA PERSONA YA DEJÓ NOMBRE Y TELÉFONO?
 *
 * Pedido del dueño (5 sep 2026): «cuando yo le creo la cuenta por el
 * correo, al entrar por primera vez igual se le pide el nombre y el
 * número de teléfono».
 *
 * Es la MISMA regla para todos, no solo para las cuentas que armó
 * Bookea: un dueño sin teléfono no se puede contactar, tenga la cuenta
 * que tenga. El nombre vive en `perfiles.nombre` (con respaldo en la
 * metadata de auth, que es donde lo deja el registro con Google); el
 * teléfono, en `user_metadata.whatsapp`, que es donde lo escribe el
 * registro del sitio desde siempre (ver /admin/usuarios).
 *
 * Recibe solo el id y lee la metadata con la llave de servicio: así
 * sirve igual desde el panel (que solo tiene `{ id, email }` del
 * acceso) y desde la lista (que tiene el `User` entero).
 */
export type EstadoPerfil = { nombre: string; whatsapp: string; falta: boolean; esAdmin: boolean };

export async function estadoDelPerfil(usuario: { id: string }): Promise<EstadoPerfil> {
  const admin = createAdminClient();
  // Sin llave de servicio no se puede saber: no se bloquea a nadie por
  // un problema de configuración nuestro.
  if (!admin) return { nombre: "", whatsapp: "", falta: false, esAdmin: false };

  const [{ data: perfil }, { data: auth }] = await Promise.all([
    admin.from("perfiles").select("nombre, rol").eq("id", usuario.id).maybeSingle(),
    admin.auth.admin.getUserById(usuario.id),
  ]);
  const meta = (auth?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const nombre =
    [perfil?.nombre, meta.nombre, meta.full_name, meta.name]
      .find((v): v is string => typeof v === "string" && v.trim().length > 1)
      ?.trim() ?? "";
  const whatsapp = typeof meta.whatsapp === "string" ? meta.whatsapp.replace(/\D/g, "") : "";
  return { nombre, whatsapp, falta: nombre.length < 2 || whatsapp.length < 8, esAdmin: perfil?.rol === "admin" };
}
