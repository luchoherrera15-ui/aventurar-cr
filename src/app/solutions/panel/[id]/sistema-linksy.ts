import type { CSSProperties } from "react";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL SISTEMA DEL PANEL DE LINKSY — figuras grandes, textos grandes
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026): «rediseñar el panel completo con la
 * línea de diseño de Linksy: figuras grandes, textos grandes; que al
 * entrar vea qué add-ons tiene, qué está activo, su plan, cuánto paga;
 * botones bonitos; profesional y sencillo».
 *
 * Es la pareja de `components/panel/sistema.ts` (el sistema navy de
 * los CRM) para el mundo Linksy: mismas reglas —clases escritas UNA
 * vez, nunca un color suelto en JSX—, otra escala y otra paleta. Los
 * colores son los tokens `.linksy` de globals.css (celeste, lima,
 * carbón…), los mismos de la landing: el panel y la portada son el
 * mismo producto y tienen que verse como tal.
 *
 * Lo que el panel HEREDA del sistema navy (Card, campos, tablas del
 * editor de página, del catálogo, del equipo) no se reescribe: el
 * alcance `.linksy-panel` de globals.css remapea sus tokens de color
 * (navy → carbón, crema → celeste tenue) para que convivan.
 */

export type Bloque = "celeste" | "lima" | "azul" | "coral" | "lila" | "amarillo" | "menta" | "carbon" | "papel";

/** Fondo y tinta de un bloque de color, como en la landing. */
export function bloque(b: Bloque): CSSProperties {
  if (b === "papel") return { background: "var(--linksy-papel)", color: "var(--linksy-tinta)" };
  return { background: `var(--linksy-${b})`, color: `var(--linksy-${b}-tinta)` };
}

// ── Superficies ───────────────────────────────────────────────────

/** La tile grande: 28 px de radio, aire adentro. */
export const LP_TILE = "rounded-[28px] p-6 sm:p-7";
export const LP_TILE_CHICA = "rounded-[22px] p-5";
/** Blanca con borde suave: para lo que no lleva color. */
export const LP_TILE_BLANCA = `${LP_TILE} bg-[var(--linksy-papel)] text-[var(--linksy-tinta)] shadow-plano`;

// ── Tipografía ────────────────────────────────────────────────────

export const LP_EYEBROW = "text-[11.5px] font-extrabold uppercase leading-none tracking-[0.14em] opacity-70";
export const LP_TITULO = "titulo text-[clamp(30px,3.6vw,48px)] font-extrabold leading-[0.98] tracking-[-0.02em]";
export const LP_TITULO_TILE = "titulo text-[clamp(22px,2.2vw,28px)] font-extrabold leading-[1.02] tracking-[-0.01em]";
export const LP_BAJADA = "text-[15px] font-semibold leading-snug opacity-85";
export const LP_CIFRA = "titulo text-[clamp(34px,3.4vw,46px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums";
export const LP_ROTULO_CIFRA = "text-[12px] font-extrabold uppercase leading-tight tracking-[0.1em] opacity-70";
export const LP_DETALLE = "text-[13px] font-semibold leading-snug opacity-75";

// ── Botones: píldoras, como en la landing ─────────────────────────

const PILDORA = "presionable inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-extrabold transition-colors disabled:opacity-50";
export const LP_BOTON = `${PILDORA} min-h-[48px] px-6 text-[14.5px] bg-[var(--linksy-carbon)] text-[var(--linksy-carbon-tinta)]`;
export const LP_BOTON_LIMA = `${PILDORA} min-h-[48px] px-6 text-[14.5px] bg-[var(--linksy-lima)] text-[var(--linksy-lima-tinta)]`;
export const LP_BOTON_SUAVE = `${PILDORA} min-h-[48px] px-6 text-[14.5px] border border-black/10 bg-[var(--linksy-papel)] text-[var(--linksy-tinta)] hover:border-black/30`;
/** Los mismos, chicos, para adentro de una tile. */
export const LP_BOTON_CHICO = `${PILDORA} min-h-[40px] px-4.5 text-[13px] bg-[var(--linksy-carbon)] text-[var(--linksy-carbon-tinta)]`;
export const LP_BOTON_CHICO_SUAVE = `${PILDORA} min-h-[40px] px-4.5 text-[13px] border border-black/10 bg-[var(--linksy-papel)] text-[var(--linksy-tinta)] hover:border-black/30`;
/** Sobre un bloque de color: translúcido, hereda la tinta. */
export const LP_BOTON_CHICO_VELO = `${PILDORA} min-h-[40px] px-4.5 text-[13px] bg-black/10 text-current hover:bg-black/15`;

// ── Píldoras de estado ────────────────────────────────────────────

export const LP_PILDORA = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase leading-none tracking-[0.08em]";
export const LP_PILDORA_VELO = `${LP_PILDORA} bg-black/10 text-current`;
export const LP_PILDORA_LIMA = `${LP_PILDORA} bg-[var(--linksy-lima)] text-[var(--linksy-lima-tinta)]`;
export const LP_PILDORA_PAPEL = `${LP_PILDORA} bg-[var(--linksy-papel)] text-[var(--linksy-tinta)]`;

/** El disco del ícono de un ítem o una tile. */
export const LP_DISCO = "grid h-12 w-12 shrink-0 place-items-center rounded-2xl [&_svg]:h-[22px] [&_svg]:w-[22px]";
