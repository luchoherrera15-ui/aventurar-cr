"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Guardar nombre y teléfono en el primer ingreso (5 sep 2026).
 *
 * Escribe en los DOS lugares donde el sitio ya los guarda: el nombre en
 * `perfiles.nombre` (lo que muestra el nav y el admin) y el teléfono en
 * `user_metadata.whatsapp` (lo que lee /admin/usuarios). No inventa un
 * tercer lugar. Va con la llave de servicio porque la metadata de auth
 * solo la puede escribir el servidor.
 */
export async function completarPerfilSolutions(datos: { nombre: string; whatsapp: string }): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Tu sesión se cerró. Volvé a entrar." };

  const nombre = (datos.nombre ?? "").trim().slice(0, 80);
  if (nombre.length < 2) return { ok: false, motivo: "Decinos tu nombre." };
  const whatsapp = (datos.whatsapp ?? "").replace(/\D/g, "");
  if (whatsapp.length < 8 || whatsapp.length > 15) return { ok: false, motivo: "El teléfono tiene que tener entre 8 y 15 dígitos." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "Falta la llave de servicio en el entorno." };

  const { error: ePerfil } = await admin
    .from("perfiles")
    .upsert({ id: user.id, email: user.email ?? null, nombre }, { onConflict: "id" });
  if (ePerfil) return { ok: false, motivo: "No se pudo guardar el nombre. Probá de nuevo." };

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const { error: eMeta } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, nombre, whatsapp },
  });
  if (eMeta) return { ok: false, motivo: "No se pudo guardar el teléfono. Probá de nuevo." };

  revalidatePath("/solutions/panel");
  return { ok: true };
}
