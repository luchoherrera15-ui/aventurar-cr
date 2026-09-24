/**
 * Mezclas de color resueltas en JavaScript, no con `color-mix()` en CSS:
 * el sitio exige que todo `color-mix()` viaje con respaldo y `@supports`
 * (Safari < 16.2 descarta la declaración entera), y la invitación
 * calcula sus tonos por escena de todos modos. Se emiten como variables
 * CSS con valores planos (hex o rgba).
 */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** `a` al `peso` (0–1) sobre `b`, opaco: `mezclar("#fff", "#000", 0.25)` → gris oscuro. */
export function mezclar(a: string, b: string, peso: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const p = Math.max(0, Math.min(1, peso));
  return `#${hex2(r1 * p + r2 * (1 - p))}${hex2(g1 * p + g2 * (1 - p))}${hex2(b1 * p + b2 * (1 - p))}`;
}

/** El color con transparencia: `alfa("#b8955a", 0.5)` → `rgba(184,149,90,0.5)`. */
export function alfa(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}
