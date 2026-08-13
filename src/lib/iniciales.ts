/**
 * Primer nombre + primer apellido: "Luis Herrera Ovares" → "LH" (no
 * "LO" — el segundo apellido no cuenta). Un solo nombre → su inicial.
 *
 * Vive en lib y no dentro de un componente porque la usan avatares de
 * los dos lados de la frontera: el menú de cuenta (cliente) y el shell
 * del panel de lealtad (cliente), y mañana cualquier tarjeta del
 * servidor. Es pura: no toca ni sesión ni DOM.
 */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
