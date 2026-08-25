"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Cerrar sesión desde el menú de cuenta de `NavLealtad`.
 *
 * Vuelve a `/lealtad` y no al directorio general (`/eventos`, que es a
 * donde manda `cerrarSesionPublica` del resto del sitio): quien cierra
 * sesión desde acá vino a ver sus tarjetas de fidelidad, no espacios
 * para eventos.
 */
export async function cerrarSesionLealtad() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/lealtad");
}
