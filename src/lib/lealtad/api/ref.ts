import { createHmac } from "node:crypto";

/**
 * EL SEUDÓNIMO DEL CLIENTE — `mb_7Q2KX9FJ4M8NBVDA`.
 *
 * La API no devuelve NUNCA el `miembro_id`. Ese uuid es el primer
 * parámetro de `acreditar_lealtad`, es el mismo que anda por el panel y
 * por el escáner, y es estable para siempre: entregárselo a un
 * integrador es entregarle una llave maestra seudónima que sigue
 * sirviendo aunque le revoquemos el acceso.
 *
 * En su lugar sale `ref = HMAC(miembro_id, pepper_de_la_autorización)`.
 * Tres propiedades salen de ahí, y las tres importan:
 *
 * 1. LA BASE ROBADA A UN INTEGRADOR NO SIRVE EN OTRO LADO. Cada
 *    autorización tiene su propio pepper, así que los refs de Fulano
 *    POS no valen ni contra otra llave, ni contra el panel, ni contra
 *    una llave futura del mismo integrador.
 * 2. SE PUEDE ROMPER LA CORRELACIÓN. Rotar el pepper (un botón en el
 *    panel) deja permanentemente inservible todo lo que un atacante se
 *    haya llevado, sin tocar un solo dato del cliente y sin que el
 *    cliente tenga que hacer nada.
 * 3. NO ES REVERSIBLE SIN NUESTRA LLAVE. Quien tenga la lista de refs
 *    no tiene forma de volver a la persona.
 *
 * ------------------------------------------------------------------
 * PERO EL `ref` SÍ ES DATO PERSONAL, Y HAY QUE DECIRLO
 * ------------------------------------------------------------------
 * Un seudónimo con el que se puede seguir a la misma persona en el
 * tiempo, y que NOSOTROS podemos reidentificar, es dato personal bajo
 * la Ley 8968. No es un truco para dejar de tener obligaciones: es una
 * medida de minimización. Por eso el ledger seudónimo (`/movimientos`)
 * queda fuera de la entrega 1 hasta que haya conversación legal.
 *
 * ------------------------------------------------------------------
 * EL ALFABETO
 * ------------------------------------------------------------------
 * Crockford base32 sin I, L, O ni U: nadie tiene que decidir si ese
 * carácter es un uno o una ele cuando lo lee de un log o lo dicta por
 * teléfono. 16 caracteres = 80 bits, de sobra para no chocar dentro de
 * una autorización (y hay un unique en la base por si acaso).
 */

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // 32, sin I L O U
const LARGO = 16;

/** El patrón exacto, el mismo que el `check` de la 0176. */
export const PATRON_REF = /^mb_[0-9A-HJKMNP-TV-Z]{16}$/;

/**
 * El `ref` de un miembro bajo una autorización. Determinístico: la
 * misma pareja da siempre el mismo ref, así que la tabla
 * `refs_api_lealtad` es un índice y no un secreto nuevo que cuidar.
 */
export function refDeMiembro(miembroId: string, pepper: Buffer): string {
  const digest = createHmac("sha256", pepper).update(miembroId, "utf8").digest();
  let salida = "";
  for (let i = 0; i < LARGO; i++) {
    // 5 bits reales por carácter tomando el byte módulo 32: como 256 es
    // múltiplo de 32, esto NO tiene sesgo (a diferencia del kid, que
    // usa un alfabeto de 36 y sí lo tendría).
    salida += ALFABETO[digest[i] % 32];
  }
  return `mb_${salida}`;
}

/**
 * ¿Esto que llegó de afuera tiene forma de `ref`?
 *
 * Se comprueba ANTES de tocar la base: un valor que no puede existir no
 * merece una consulta, y la expresión regular es también el filtro que
 * evita mandar basura al índice.
 */
export function esRefValido(valor: unknown): valor is string {
  return typeof valor === "string" && PATRON_REF.test(valor);
}

/**
 * El pepper viene de Postgres como `\x6f2a…` (formato hex de bytea).
 * Devuelve null si llega cualquier otra cosa: sin pepper no se puede
 * calcular un ref, y calcular uno malo sería peor que fallar.
 */
export function pepperDeBytea(valor: unknown): Buffer | null {
  if (typeof valor !== "string") return null;
  const hex = valor.startsWith("\\x") ? valor.slice(2) : valor;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}
