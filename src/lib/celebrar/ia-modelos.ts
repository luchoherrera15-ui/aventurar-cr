import type { ModeloIA } from "@/lib/ia/modelos";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LOS BOTS DE CELEBRAR — la IA con nombre propio y precio fijo
 * ══════════════════════════════════════════════════════════════════
 *
 * Decisión del dueño (21 sep 2026): la persona NO ve modelos ni lo que
 * nos cuesta cada uno («no puede salir así como el más barato»). Ve tres
 * asistentes de la casa, cada uno con su personalidad y un precio fijo
 * en créditos; el más caro es el más detallista. Qué modelo hay detrás
 * de cada bot es cosa nuestra (y se puede cambiar sin tocar la UI).
 *
 * El costo real por corrida (tokens, ₡) sigue quedando en `uso_ia` para
 * el equipo; no se muestra al cliente.
 */
export const BOTS_IA = {
  chispa: {
    nombre: "Chispa",
    lema: "Rápida y alegre",
    detalle: "Arma un diseño lindo en segundos. Ideal para probar ideas y estilos.",
    creditos: 3,
    modelo: "gemini-3.5-flash-lite",
    recomendada: false,
  },
  musa: {
    nombre: "Musa",
    lema: "Nuestra favorita",
    detalle: "Dirección de arte con criterio y textos con alma. La que más eligen.",
    creditos: 8,
    modelo: "claude-sonnet-5",
    recomendada: true,
  },
  maestra: {
    nombre: "Maestra",
    lema: "La más detallista",
    detalle: "Para invitaciones que se recuerdan: historia, programa, cada texto cuidado.",
    creditos: 15,
    modelo: "claude-opus-5",
    recomendada: false,
  },
} as const satisfies Record<string, { nombre: string; lema: string; detalle: string; creditos: number; modelo: ModeloIA; recomendada: boolean }>;

export type BotIA = keyof typeof BOTS_IA;
export const BOT_POR_DEFECTO: BotIA = "musa";
export const BOTS_EN_ORDEN: readonly BotIA[] = ["chispa", "musa", "maestra"];

export function esBotIA(v: unknown): v is BotIA {
  return typeof v === "string" && v in BOTS_IA;
}

/** El precio más bajo, para «desde N créditos» en la lista de precios. */
export const CREDITOS_IA_DESDE = Math.min(...BOTS_EN_ORDEN.map((b) => BOTS_IA[b].creditos));
