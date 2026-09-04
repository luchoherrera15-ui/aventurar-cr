/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS TEMAS DE SOLUTIONS — el vestido de /s/<slug>
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (4 sep 2026): que el negocio elija el diseño y el
 * tipo de card, «casi un creador de mini-websites».
 *
 * Cada tema es un JUEGO COMPLETO de superficies y tintas, no un color
 * suelto: fondo, tinta principal, tinta suave, superficie de las
 * tarjetas y su borde. Se definen juntos a propósito — es lo que evita
 * que alguien elija un fondo claro y quede con texto blanco encima.
 *
 * `marca` es el default y el único que NO trae paleta propia: usa los
 * dos colores que el negocio ya eligió (el comportamiento de la 0230),
 * y deriva la tinta por luminancia. Los demás son presets auditados.
 *
 * ── EL ACENTO SIEMPRE ES DEL NEGOCIO ────────────────────────────────
 * El tema viste la página; el acento (botones, disco del logo, precios)
 * sigue siendo el color que el negocio eligió, para que dos locales con
 * el mismo tema no se vean iguales. Lo único que el tema decide del
 * acento es la TINTA que va encima, calculada por luminancia — un
 * acento claro con letra blanca es ilegible y no depende del gusto.
 */

export const TEMAS = ["marca", "noche", "claro", "crema", "bosque", "vino"] as const;
export type Tema = (typeof TEMAS)[number];

export const ESTILOS_LINKS = ["lista", "grilla"] as const;
export type EstiloLinks = (typeof ESTILOS_LINKS)[number];

export const REDONDEOS = ["recto", "suave", "redondo"] as const;
export type Redondeo = (typeof REDONDEOS)[number];

export type Paleta = {
  fondo: string;
  /** Fondo secundario para el degradado del hero. */
  fondo2: string;
  acento: string;
  tinta: string;
  suave: string;
  superficie: string;
  borde: string;
  tintaSobreAcento: string;
};

type PresetTema = {
  id: Tema;
  nombre: string;
  /** Qué transmite — se muestra bajo el nombre en el panel. */
  pie: string;
  fondo: string | null;
  fondo2: string | null;
  tinta: string | null;
  suave: string | null;
  superficie: string | null;
  borde: string | null;
  /** Acento sugerido al elegir el tema (el negocio lo puede cambiar). */
  acentoSugerido: string;
};

export const PRESETS: Record<Tema, PresetTema> = {
  marca: {
    id: "marca",
    nombre: "Mi marca",
    pie: "Tus dos colores",
    fondo: null,
    fondo2: null,
    tinta: null,
    suave: null,
    superficie: null,
    borde: null,
    acentoSugerido: "#9db4ff",
  },
  noche: {
    id: "noche",
    nombre: "Noche",
    pie: "Oscuro y elegante",
    fondo: "#0b1020",
    fondo2: "#141b33",
    tinta: "#ffffff",
    suave: "rgba(255,255,255,0.68)",
    superficie: "rgba(255,255,255,0.07)",
    borde: "rgba(255,255,255,0.16)",
    acentoSugerido: "#7c9cff",
  },
  claro: {
    id: "claro",
    nombre: "Claro",
    pie: "Blanco y limpio",
    fondo: "#ffffff",
    fondo2: "#f4f6fb",
    tinta: "#101828",
    suave: "rgba(16,24,40,0.62)",
    superficie: "#f7f8fc",
    borde: "rgba(16,24,40,0.12)",
    acentoSugerido: "#e5533d",
  },
  crema: {
    id: "crema",
    nombre: "Crema",
    pie: "Cálido, de cafetería",
    fondo: "#f6efe4",
    fondo2: "#efe4d3",
    tinta: "#3b2c1c",
    suave: "rgba(59,44,28,0.66)",
    superficie: "rgba(59,44,28,0.055)",
    borde: "rgba(59,44,28,0.16)",
    acentoSugerido: "#b07a2c",
  },
  bosque: {
    id: "bosque",
    nombre: "Bosque",
    pie: "Verde profundo",
    fondo: "#0f2019",
    fondo2: "#163227",
    tinta: "#f2f7f4",
    suave: "rgba(242,247,244,0.66)",
    superficie: "rgba(255,255,255,0.06)",
    borde: "rgba(255,255,255,0.15)",
    acentoSugerido: "#7fd1a6",
  },
  vino: {
    id: "vino",
    nombre: "Vino",
    pie: "Intenso, para cenar",
    fondo: "#24101a",
    fondo2: "#3a1a29",
    tinta: "#fdf3f6",
    suave: "rgba(253,243,246,0.66)",
    superficie: "rgba(255,255,255,0.07)",
    borde: "rgba(255,255,255,0.16)",
    acentoSugerido: "#e8a0b6",
  },
};

/** Radio en px de cada pieza, según el redondeo elegido. */
export const RADIOS: Record<Redondeo, { tarjeta: number; pieza: number; foto: number }> = {
  recto: { tarjeta: 4, pieza: 4, foto: 4 },
  suave: { tarjeta: 18, pieza: 14, foto: 14 },
  redondo: { tarjeta: 28, pieza: 24, foto: 22 },
};

/** ¿Este color es oscuro? YIQ — la misma fórmula del póster impreso. */
export function esOscuro(hex: string): boolean {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return true;
  return (r * 299 + g * 587 + b * 114) / 1000 < 150;
}

/** Aclara u oscurece un hex — para el segundo tono del degradado. */
function mover(hex: string, delta: number): string {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return hex;
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    return Math.max(0, Math.min(255, v + delta));
  });
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * La paleta final: el tema pone el vestido, el negocio pone el acento.
 * Todo lo que la página pinta sale de acá — ni un color suelto en el
 * JSX, que es lo que permite cambiar de tema sin tocar el render.
 */
export function paletaDelTema(
  tema: Tema,
  colorFondoNegocio: string,
  colorAcentoNegocio: string,
): Paleta {
  const p = PRESETS[tema] ?? PRESETS.marca;
  const acento = colorAcentoNegocio || p.acentoSugerido;

  if (!p.fondo) {
    // Tema «marca»: se deriva del color del negocio, como la 0230.
    const oscuro = esOscuro(colorFondoNegocio);
    return {
      fondo: colorFondoNegocio,
      fondo2: mover(colorFondoNegocio, oscuro ? 22 : -12),
      acento,
      tinta: oscuro ? "#ffffff" : "#10192e",
      suave: oscuro ? "rgba(255,255,255,0.72)" : "rgba(16,25,46,0.68)",
      superficie: oscuro ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.05)",
      borde: oscuro ? "rgba(255,255,255,0.18)" : "rgba(16,24,40,0.14)",
      tintaSobreAcento: esOscuro(acento) ? "#ffffff" : "#10192e",
    };
  }

  return {
    fondo: p.fondo,
    fondo2: p.fondo2 ?? p.fondo,
    acento,
    tinta: p.tinta as string,
    suave: p.suave as string,
    superficie: p.superficie as string,
    borde: p.borde as string,
    tintaSobreAcento: esOscuro(acento) ? "#ffffff" : "#10192e",
  };
}

/** Lee el jsonb/columna cruda y devuelve un valor de la lista cerrada. */
export function temaDe(v: unknown): Tema {
  return (TEMAS as readonly unknown[]).includes(v) ? (v as Tema) : "marca";
}
export function estiloLinksDe(v: unknown): EstiloLinks {
  return (ESTILOS_LINKS as readonly unknown[]).includes(v) ? (v as EstiloLinks) : "lista";
}
export function redondeoDe(v: unknown): Redondeo {
  return (REDONDEOS as readonly unknown[]).includes(v) ? (v as Redondeo) : "suave";
}
