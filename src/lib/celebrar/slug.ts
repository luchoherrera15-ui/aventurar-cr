import { esSlugDeCelebracionValido, SLUG_CELEBRACION } from "./rutas";

/**
 * De «La boda de Sofía & Andrés» a «la-boda-de-sofia-y-andres»: la
 * dirección que la persona va a compartir. Pura, sin red: la
 * disponibilidad real la responde la base (`celebrar_slug_disponible`).
 *
 * Reglas: minúsculas, sin tildes, «&» → «y», todo lo que no sea letra o
 * dígito se vuelve guion, sin guiones dobles ni en las puntas, 3 a 60
 * caracteres. Si el nombre no da para un slug válido (por ejemplo, solo
 * emojis), devuelve "" y el asistente pide uno a mano.
 */
export function sugerirSlug(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  if (base.length < 3) return "";
  return esSlugDeCelebracionValido(base) ? base : `${base}-1`.slice(0, 60);
}

/**
 * Limpia lo que la persona escribe a mano en el campo del slug, con la
 * misma regla que la sugerencia, pero SIN recortar a la fuerza mientras
 * tipea: solo normaliza caracteres.
 */
export function limpiarSlugEscrito(entrada: string): string {
  return entrada
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
}

export type VeredictoSlug = { ok: true } | { ok: false; motivo: string };

/** Por qué un slug no sirve, en palabras para la persona. */
export function veredictoSlug(slug: string): VeredictoSlug {
  const s = slug.trim();
  if (s.length < 3) return { ok: false, motivo: "Tiene que tener al menos 3 caracteres." };
  if (s.length > 60) return { ok: false, motivo: "Máximo 60 caracteres." };
  if (s.startsWith("-") || s.endsWith("-")) {
    return { ok: false, motivo: "No puede empezar ni terminar con guion." };
  }
  if (!SLUG_CELEBRACION.test(s)) {
    return { ok: false, motivo: "Solo minúsculas, números y guiones." };
  }
  if (!esSlugDeCelebracionValido(s)) {
    return { ok: false, motivo: "Esa dirección está reservada. Probá con otra." };
  }
  return { ok: true };
}
