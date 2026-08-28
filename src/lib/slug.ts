import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nombres que no pueden salir como slug de un rancho porque ya son
 * rutas reales del sitio (carpetas en src/app) o rutas técnicas que
 * Next.js/Vercel sirven aparte. Si un nombre de negocio generara uno
 * de estos, /[slug] nunca lo alcanzaría a mostrar (la ruta literal
 * siempre gana), así que se lo evita desde la generación.
 */
export const RESERVED_SLUGS = new Set([
  "admin",
  "auth",
  "eventos",
  "citas",
  "booking",
  "hospedajes",
  "restaurantes",
  // Las dos puertas nuevas del header. No son verticales de `ranchos`
  // (ver src/components/nav/taxonomia-navegacion.ts) pero sí son
  // carpetas reales en src/app, así que la ruta literal le gana a
  // /[slug] y un negocio que se llamara así quedaría inalcanzable.
  "experiencias",
  "servicios",
  "food",
  // La landing B2B y la portada de demostración: carpetas reales en
  // src/app — un negocio con ese slug quedaría inalcanzable.
  "negocios",
  "demo-bookea",
  "invitaciones",
  "invitacion",
  "cuenta",
  "mensajes",
  "lealtad",
  "mi-negocio",
  "publicar",
  "puntaleona-web",
  "ranchos-eventos",
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "file.svg",
  "globe.svg",
  "next.svg",
  "vercel.svg",
  "window.svg",
]);

/**
 * Reduce un nombre de negocio a minúsculas sin tildes, espacios ni
 * símbolos: "Rancho Las Torres" → "rancholastorres". Sin guiones a
 * propósito, para calzar con el ejemplo del dueño y el estilo del
 * dominio (bookeacr, no bookear-cr). Debe coincidir con la función
 * `slugify` en supabase/migrations/0031_slug_ranchos.sql.
 */
export function slugify(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Genera un slug único para un rancho nuevo: si el nombre reducido ya
 * está tomado (o es una palabra reservada), le agrega un número al
 * final hasta encontrar uno libre.
 */
export async function generarSlugUnico(
  supabase: SupabaseClient,
  nombre: string,
): Promise<string> {
  const base = slugify(nombre) || "rancho";

  let candidato = base;
  let sufijo = 1;
  for (;;) {
    if (!RESERVED_SLUGS.has(candidato)) {
      const { data } = await supabase
        .from("ranchos")
        .select("id")
        .eq("slug", candidato)
        .maybeSingle();
      if (!data) return candidato;
    }
    sufijo += 1;
    candidato = `${base}${sufijo}`;
  }
}
