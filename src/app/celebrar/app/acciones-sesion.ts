"use server";

import { redirect } from "next/navigation";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { prefijoDeLaPeticion } from "@/lib/celebrar/sesion";
import { createClient } from "@/lib/supabase/server";

/**
 * Cierra la sesión de ESTE navegador y vuelve a la portada de CELEBRAR.
 *
 * `scope: "local"` a propósito: el default de Supabase es `global` y
 * revoca los refresh tokens de TODOS los aparatos — quien cierra sesión
 * acá no tiene por qué quedar afuera de la app en el teléfono. Es la
 * misma lección que ya está anotada en formulario-codigo-acceso.tsx.
 */
export async function cerrarSesionCelebrar() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(conPrefijo(RUTA.inicio, await prefijoDeLaPeticion()));
}
