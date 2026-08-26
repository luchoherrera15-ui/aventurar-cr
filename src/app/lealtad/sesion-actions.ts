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
  // `scope: "local"` — cierra ESTA sesión y nada más.
  //
  // ⚠️ EL DEFAULT DE SUPABASE ES GLOBAL. `signOut()` a secas es
  // `signOut({ scope: "global" })` (auth-js, GoTrueClient), y eso REVOCA
  // los refresh tokens de TODOS los aparatos: quien cerraba sesión acá
  // quedaba también deslogueado del teléfono, sin ninguna pista de por
  // qué. Un botón que dice «cerrar sesión» cierra la de acá.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/lealtad");
}
