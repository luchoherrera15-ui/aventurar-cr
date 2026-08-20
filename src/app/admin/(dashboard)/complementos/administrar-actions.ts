"use server";

import { requireAdmin } from "@/lib/auth";

/**
 * Antes de ofrecer "Administrar como el dueño", confirma que quien está
 * detrás de la sesión es un admin de verdad — mismo chequeo de
 * `requireAdmin` que ya usa el resto de /admin/complementos.
 *
 * Esto NO es la puerta real: un admin ya tiene acceso completo a
 * `/lealtad/panel/[id]` de cualquier negocio (`verificarAccesoRancho` en
 * `src/lib/auth.ts` deja pasar a `owner_id === user.id || esAdmin`). Lo
 * único que agrega este chequeo es no ofrecerle el botón —ni mandarle un
 * código— a alguien que ni siquiera es admin.
 *
 * El correo se devuelve desde acá (sesión del servidor), nunca desde un
 * input editable en el navegador: así el código de verificación SIEMPRE
 * va a la casilla de quien está logueado, nunca a la que alguien escriba.
 */
export async function verificarSoyAdmin(): Promise<{ ok: boolean; correo: string | null }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { ok: false, correo: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { ok: true, correo: user?.email ?? null };
}
