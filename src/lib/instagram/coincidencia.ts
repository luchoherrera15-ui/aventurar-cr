import type { ModoCoincidencia } from "./tipos";

/**
 * LA COINCIDENCIA DE PALABRAS CLAVE — pura, sin red, probada.
 *
 * El pedido: «PRECIO» tiene que atrapar «precio», «Precio» y «¿Cuál es
 * el precio?», pero no disparar por «precioso». Eso es exactamente el
 * modo `palabra` (el default): se normaliza todo —minúsculas, sin
 * acentos, espacios colapsados— y se busca la palabra ENTERA con
 * límites de palabra en Unicode (letras y números de cualquier idioma,
 * no solo ASCII: un emoji o un «¿» pegado cuentan como límite).
 *
 * `exacta` y `contiene` existen para quien los prefiera; los tres son
 * configurables por automatización.
 */

/** Minúsculas, sin diacríticos, espacios colapsados, recortado. */
export function normalizarTexto(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ¿El comentario coincide con ESTA palabra (o frase) en este modo? */
export function coincide(comentario: string, palabra: string, modo: ModoCoincidencia = "palabra"): boolean {
  const c = normalizarTexto(comentario);
  const p = normalizarTexto(palabra);
  if (!c || !p) return false;
  if (modo === "exacta") return c === p;
  if (modo === "contiene") return c.includes(p);
  // palabra: la frase entera, rodeada de algo que no sea letra ni número.
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaparRegex(p)}(?:[^\\p{L}\\p{N}]|$)`, "u");
  return re.test(c);
}

/**
 * La primera palabra de la lista que coincide, tal como la escribió la
 * persona (para guardarla en el evento), o null.
 */
export function primeraCoincidencia(comentario: string, palabras: readonly string[], modo: ModoCoincidencia = "palabra"): string | null {
  for (const palabra of palabras) {
    if (coincide(comentario, palabra, modo)) return palabra;
  }
  return null;
}

/**
 * Limpia la lista que llega del formulario: recorta, quita vacíos y
 * duplicados (por forma normalizada), respeta el tope.
 */
export function sanearPalabras(entrada: readonly string[], tope: number, largoMax: number): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const cruda of entrada) {
    const p = (cruda ?? "").trim().slice(0, largoMax);
    if (!p) continue;
    const clave = normalizarTexto(p);
    if (!clave || vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push(p);
    if (salida.length >= tope) break;
  }
  return salida;
}
