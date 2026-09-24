"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Cerrar sesión desde el nav de la página del negocio.
 *
 * Vuelve a `/solutions`, la página de producto de «Tu página», y no a
 * `/lealtad` (a donde manda `cerrarSesionLealtad`) ni al directorio:
 * quien cierra sesión desde acá estaba en su página o en su menú, no
 * viendo tarjetas.
 *
 * Hasta el 24 sep 2026 volvía a la portada de Linksy. Esa portada ya no
 * existe como marca: su contenido ES `/solutions`.
 *
 * `scope: "local"` por lo mismo que en el nav de Lealtad: el default
 * de Supabase es GLOBAL y revoca la sesión de todos los aparatos. Un
 * botón que dice «cerrar sesión» cierra la de acá.
 */
export async function cerrarSesionSolutions() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/solutions");
}
