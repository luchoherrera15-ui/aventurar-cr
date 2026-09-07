"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { urlLinksy } from "@/lib/solutions/dominios";

/**
 * Cerrar sesión desde el nav de Solutions (Linksy).
 *
 * Vuelve a la PORTADA DE LINKSY (`urlLinksy`: linksy.lat en producción),
 * no a `/lealtad` (a donde manda `cerrarSesionLealtad`) ni al
 * directorio: quien cierra sesión desde acá estaba en su página o en su
 * menú, no viendo tarjetas. Hasta el 7 sep 2026 volvía a `/solutions`,
 * la landing vieja — el dueño salió de linksy.lat y aterrizó en una
 * página de otro producto.
 *
 * `scope: "local"` por lo mismo que en el nav de Lealtad: el default
 * de Supabase es GLOBAL y revoca la sesión de todos los aparatos. Un
 * botón que dice «cerrar sesión» cierra la de acá.
 */
export async function cerrarSesionSolutions() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(urlLinksy());
}
