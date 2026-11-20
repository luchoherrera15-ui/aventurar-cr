/**
 * ════════════════════════════════════════════════════════════════════
 *  CANJEAR VARIOS PREMIOS A LA VEZ (0257)
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (Foorkie, 20 nov 2026): «tengo 100 puntos y canjeo 4
 * cosas de 25 puntos; si intento canjear algo superior, me tira un error
 * de que no tengo esa cantidad de puntos».
 *
 * `canjear_recompensa` entrega UN premio por llamada. Para varios, el RPC
 * `canjear_recompensas_varias` (0257) recibe la lista y es TODO O NADA: si
 * el total no alcanza, o un premio no se puede entregar, no se descuenta
 * nada. Este módulo es lo puro: los topes del pedido y la referencia.
 * Quien lo ejecuta es `canjearVariosCore` (operar-core.ts).
 *
 * Módulo puro: sin red, sin base, sin `process.env`.
 */

/** Cuántos premios DISTINTOS puede llevar un canje. */
export const MAX_RENGLONES_CANJE = 10;
/** Cuántas unidades de UN mismo premio. */
export const MAX_POR_RENGLON_CANJE = 20;
/** Cuántas unidades en total, sumando todos los renglones. */
export const MAX_UNIDADES_CANJE = 30;

/** Un renglón del pedido: el premio y cuántos. */
export type PremioPedido = { recompensaId: string; cantidad: number };

/**
 * La llave BASE de un canje de varios: `canje:<miembro>:<intento>`. El RPC
 * le agrega `:<n>` a cada unidad (n = 1, 2, 3… en el orden pedido), así que
 * dos toques del mismo botón —el mismo `intento_id`— comparten base y el
 * segundo contesta «ya estaba» sin descontar de nuevo.
 *
 * No choca con la de un premio suelto (`canje:<miembro>:<recompensa>:<intento>`):
 * la de una unidad termina en un NÚMERO, la otra en un uuid.
 */
export function referenciaCanjeVarios(miembroId: string, intentoId: string): string {
  return `canje:${miembroId}:${intentoId}`;
}

/**
 * Los topes del pedido, ya leído. null = vale; si no, la frase para quien
 * opera. La API lo mira al leer el cuerpo y el núcleo lo vuelve a mirar
 * (es la última puerta antes de la base).
 */
export function revisarPremios(premios: readonly PremioPedido[]): string | null {
  if (!Array.isArray(premios) || premios.length < 1 || premios.length > MAX_RENGLONES_CANJE) {
    return `Se pueden canjear de 1 a ${MAX_RENGLONES_CANJE} premios distintos por vez.`;
  }
  const vistos = new Set<string>();
  let total = 0;
  for (const p of premios) {
    if (!p || typeof p.recompensaId !== "string" || !p.recompensaId) {
      return "Falta el premio (recompensa_id) en uno de los renglones.";
    }
    if (!Number.isInteger(p.cantidad) || p.cantidad < 1 || p.cantidad > MAX_POR_RENGLON_CANJE) {
      return `La cantidad de cada premio tiene que ser un número entero de 1 a ${MAX_POR_RENGLON_CANJE}.`;
    }
    if (vistos.has(p.recompensaId)) {
      return "Hay un premio repetido: súmalo en una sola cantidad.";
    }
    vistos.add(p.recompensaId);
    total += p.cantidad;
  }
  if (total > MAX_UNIDADES_CANJE) {
    return `Se pueden canjear hasta ${MAX_UNIDADES_CANJE} unidades por vez.`;
  }
  return null;
}
