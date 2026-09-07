/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS COLORES DE UNA IMAGEN — de píxeles a «tu tema»
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026): «cuando se agregue una imagen, algo
 * que detecte el color y diga AUTO AGREGAR COLOR DE TEMA, y que todo
 * se aplique en tonos similares a los de la imagen».
 *
 * ── QUÉ HACE ───────────────────────────────────────────────────────
 * Recibe los píxeles crudos (RGBA) de una versión chica de la imagen
 * —64 px alcanzan: no se buscan detalles, se busca el color— y devuelve
 * una PROPUESTA de dos colores para la página:
 *
 *   fondo   el color dominante, llevado a una luz que sirva de fondo
 *           (oscuro si la foto es oscura o media; claro si es clara).
 *   acento  el color más VIVO que tenga presencia real, ajustado para
 *           que contraste con ese fondo.
 *
 * Con esos dos, el tema «marca» del editor (`paletaDelTema`) deriva el
 * resto —tinta, superficie, borde— igual que si el dueño los hubiera
 * escrito a mano. No hay un tercer camino de color.
 *
 * ── CÓMO ───────────────────────────────────────────────────────────
 * Cuantización simple: cada canal a 16 niveles (4 bits) → 4 096
 * cubetas; se cuenta cuántos píxeles caen en cada una y se promedia
 * el color real de los que cayeron. Los píxeles transparentes (un logo
 * PNG) no cuentan: el fondo vacío no es «blanco».
 *
 * Módulo NEUTRAL: sin canvas, sin sharp, sin DOM. El navegador le pasa
 * `ImageData.data`; el servidor, el buffer crudo de sharp. Por eso se
 * puede probar con un arreglo escrito a mano.
 */

export type PropuestaColores = {
  /** El color que más hay, tal cual (para mostrarlo). */
  dominante: string;
  /** Lo que se le propone a la página. */
  fondo: string;
  acento: string;
  /** Hasta cinco muestras, de la que más hay a la que menos. */
  muestras: string[];
};

type Hsl = { h: number; s: number; l: number };

const ALFA_MINIMA = 128;

export function paletaDePixeles(datos: ArrayLike<number>, opciones: { paso?: number } = {}): PropuestaColores | null {
  const paso = Math.max(1, Math.floor(opciones.paso ?? 1));
  const cubetas = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  const salto = 4 * paso;
  for (let i = 0; i + 3 < datos.length; i += salto) {
    if (datos[i + 3] < ALFA_MINIMA) continue;
    const r = datos[i];
    const g = datos[i + 1];
    const b = datos[i + 2];
    const clave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = cubetas.get(clave);
    if (c) {
      c.n++;
      c.r += r;
      c.g += g;
      c.b += b;
    } else {
      cubetas.set(clave, { n: 1, r, g, b });
    }
    total++;
  }
  if (total === 0) return null;

  const lista = [...cubetas.values()]
    .map((c) => ({ n: c.n, r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }))
    .sort((a, b) => b.n - a.n);

  const dominante = lista[0];
  const domHsl = rgbAHsl(dominante.r, dominante.g, dominante.b);

  // ── El acento: vivo, con luz media y con presencia (≥ 0,5 %) ───────
  let mejor: { puntaje: number; hsl: Hsl } | null = null;
  for (const c of lista) {
    if (c.n / total < 0.005) break; // están ordenadas: de acá en más, menos aún
    const hsl = rgbAHsl(c.r, c.g, c.b);
    if (hsl.s < 0.25) continue;
    const luzMedia = 1 - Math.min(1, Math.abs(hsl.l - 0.5) * 1.8);
    const puntaje = hsl.s * luzMedia * Math.sqrt(c.n / total);
    if (!mejor || puntaje > mejor.puntaje) mejor = { puntaje, hsl };
  }

  // ── El fondo: el dominante, a una luz de fondo ─────────────────────
  const fondoHsl: Hsl = { h: domHsl.h, s: Math.min(domHsl.s, 0.6), l: domHsl.l };
  if (domHsl.l > 0.65) fondoHsl.l = Math.max(domHsl.l, 0.92); // foto clara → página clara
  else fondoHsl.l = Math.min(Math.max(domHsl.l, 0.08), 0.24); // oscura o media → página oscura
  const fondo = hslAHex(fondoHsl);

  // ── El acento contrasta con ese fondo, o no sirve de botón ─────────
  const acentoHsl: Hsl = mejor ? { ...mejor.hsl } : { h: domHsl.h, s: Math.max(domHsl.s, 0.45), l: 0.5 };
  if (contraste(hslAHex(acentoHsl), fondo) < 2.5) {
    acentoHsl.l = fondoHsl.l < 0.5 ? 0.66 : 0.36;
    acentoHsl.s = Math.max(acentoHsl.s, 0.45);
  }
  const acento = hslAHex(acentoHsl);

  return {
    dominante: hexDe(dominante.r, dominante.g, dominante.b),
    fondo,
    acento,
    muestras: lista.slice(0, 5).map((c) => hexDe(c.r, c.g, c.b)),
  };
}

// ── Aritmética de color ─────────────────────────────────────────────

export function hexDe(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbAHsl(r: number, g: number, b: number): Hsl {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: (h * 60) % 360, s, l };
}

export function hslAHex({ h, s, l }: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return hexDe(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Luminancia relativa (WCAG) de un hex. */
export function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Relación de contraste (WCAG) entre dos hex: 1 (igual) a 21 (blanco/negro). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}
