import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nombres que no pueden salir como slug de un negocio de FOOD porque
 * colisionan con rutas reales de /food. Mismo criterio que
 * RESERVED_SLUGS de ranchos (src/lib/slug.ts), acotado al árbol de
 * FOOD porque el slug de FOOD vive en su propio namespace
 * (/food/restaurante/[slug]), no en la raíz del sitio.
 */
export const FOOD_RESERVED_SLUGS = new Set([
  "negocio",
  "reserva",
  "restaurante",
  "login",
  "nuevo",
]);

/** "La Terraza CR" → "la-terraza-cr". Con guiones, a diferencia del
 * slug de ranchos: acá no hay que calzar con un dominio propio, y con
 * guiones un nombre largo sigue siendo legible en la URL. */
export function slugifyFood(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generarSlugFoodUnico(
  supabase: SupabaseClient,
  nombre: string,
): Promise<string> {
  const base = slugifyFood(nombre) || "restaurante";

  let candidato = base;
  let sufijo = 1;
  for (;;) {
    if (!FOOD_RESERVED_SLUGS.has(candidato)) {
      const { data } = await supabase
        .from("food_businesses")
        .select("id")
        .eq("slug", candidato)
        .maybeSingle();
      if (!data) return candidato;
    }
    sufijo += 1;
    candidato = `${base}-${sufijo}`;
  }
}
