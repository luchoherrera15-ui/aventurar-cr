"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Cerrar sesión desde los headers públicos (site-header y el de la
 * portada) y volver a la portada.
 *
 * Vive en su PROPIO archivo "use server" —igual que sesion-actions.ts
 * de Lealtad— porque los dos headers pasaron a ser islas de cliente
 * (ver acciones-sesion.tsx: era el único `cookies()` de ~30 páginas
 * públicas y las volvía dinámicas a todas), y un componente de cliente
 * no puede declarar server actions inline: solo importarlas.
 */
export async function cerrarSesionPublica() {
  const supabase = await createClient();
  // `scope: "local"` — cierra ESTA sesión y nada más.
  //
  // ⚠️ EL DEFAULT DE SUPABASE ES GLOBAL. `signOut()` a secas es
  // `signOut({ scope: "global" })` (auth-js, GoTrueClient), y eso REVOCA
  // los refresh tokens de TODOS los aparatos: quien cerraba sesión acá
  // quedaba también deslogueado del teléfono, sin ninguna pista de por
  // qué. Un botón que dice «cerrar sesión» cierra la de acá.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
