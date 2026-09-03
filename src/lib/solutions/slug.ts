import type { SupabaseClient } from "@supabase/supabase-js";
import { RESERVED_SLUGS } from "@/lib/slug";

/**
 * El slug de un negocio de Solutions: bookea.lat/s/<slug>.
 *
 * No se usa `generarSlugUnico` de @/lib/slug porque esa consulta la
 * tabla `ranchos` — y el espacio de nombres de Solutions es OTRO:
 * puede existir un rancho «cafe-aroma» y un negocio de Solutions
 * «cafe-aroma» sin pisarse, porque viven en /<slug> y /s/<slug>.
 *
 * Sí se respetan las RESERVED_SLUGS: son carpetas reales de src/app y
 * un slug igual quedaría inalcanzable bajo /s/ también si algún día se
 * monta algo ahí.
 *
 * A diferencia de slugify() del marketplace, acá se CONSERVAN los
 * guiones: «cafe-aroma» se lee mejor en un QR que «cafearoma».
 */
export function slugSolutions(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function generarSlugSolutions(admin: SupabaseClient, nombre: string): Promise<string> {
  const base = slugSolutions(nombre) || "negocio";
  let candidato = base;
  let sufijo = 1;
  for (;;) {
    if (candidato.length >= 2 && !RESERVED_SLUGS.has(candidato)) {
      const { data } = await admin
        .from("solutions_negocios")
        .select("id")
        .eq("slug", candidato)
        .maybeSingle();
      if (!data) return candidato;
    }
    sufijo += 1;
    candidato = `${base}-${sufijo}`.slice(0, 60);
  }
}
