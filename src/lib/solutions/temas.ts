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

/**
 * ── LAS CARAS TIPOGRÁFICAS (0232) ───────────────────────────────────
 * Solo METADATOS acá. Las fuentes de verdad se cargan con `next/font`
 * en `src/app/solutions/fuentes.ts`, que es un módulo de servidor: este
 * archivo lo importan también componentes de cliente, y meterle
 * `next/font` lo volvería inimportable desde ahí.
 *
 * El contrato entre los dos archivos es `cssVar`: allá se define, acá
 * se nombra. Si se agrega una cara, va en los dos lados y en el CHECK
 * de la migración — los tres tienen que decir lo mismo.
 */
export const FUENTES = ["sistema", "elegante", "redonda", "condensada", "editorial", "tecnica"] as const;
export type Fuente = (typeof FUENTES)[number];

export const FUENTE: Record<Fuente, { nombre: string; pie: string; cssVar: string; respaldo: string }> = {
  sistema: { nombre: "Del sitio", pie: "Limpia y neutra", cssVar: "--font-figtree", respaldo: "system-ui, sans-serif" },
  elegante: { nombre: "Elegante", pie: "Serif de mantel largo", cssVar: "--fuente-elegante", respaldo: "Georgia, serif" },
  redonda: { nombre: "Redonda", pie: "Moderna y amable", cssVar: "--fuente-redonda", respaldo: "system-ui, sans-serif" },
  condensada: { nombre: "Condensada", pie: "Fuerte, tipo pizarra", cssVar: "--fuente-condensada", respaldo: "Impact, sans-serif" },
  editorial: { nombre: "Editorial", pie: "Serif cálida de lectura", cssVar: "--fuente-editorial", respaldo: "Georgia, serif" },
  tecnica: { nombre: "Técnica", pie: "Geométrica de especialidad", cssVar: "--fuente-tecnica", respaldo: "system-ui, sans-serif" },
};

/** La pila lista para `font-family`. Siempre con respaldo real. */
export function pilaFuente(f: Fuente): string {
  const x = FUENTE[f] ?? FUENTE.sistema;
  return `var(${x.cssVar}), ${x.respaldo}`;
}

/**
 * ── QUÉ HACE LA FOTO DE PORTADA (0232) ──────────────────────────────
 * Pedido del dueño: «que se pueda poner la portada completa o solo en
 * card». `card` es el default porque es lo que hacía la 0230, y así
 * ninguna página existente cambia de aspecto sola.
 */
export const PORTADAS = ["card", "completa", "fondo", "sin"] as const;
export type EstiloPortada = (typeof PORTADAS)[number];

export const PORTADA: Record<EstiloPortada, { nombre: string; pie: string }> = {
  card: { nombre: "En la tarjeta", pie: "Dentro del encabezado" },
  completa: { nombre: "Completa", pie: "Banner de borde a borde" },
  fondo: { nombre: "De fondo", pie: "Viste la página entera" },
  sin: { nombre: "Sin portada", pie: "Solo logo y nombre" },
};

/**
 * ── EL ACABADO DE LAS PIEZAS (0232) ─────────────────────────────────
 * Pedido del dueño: «que tenga efectos». Cinco acabados auditados; el
 * renderizador los traduce con `estiloDePieza()`, así que el JSX no
 * tiene ni un `if` de efecto adentro.
 */
export const EFECTOS = ["plano", "vidrio", "elevado", "contorno", "degradado"] as const;
export type Efecto = (typeof EFECTOS)[number];

export const EFECTO: Record<Efecto, { nombre: string; pie: string }> = {
  plano: { nombre: "Plano", pie: "Superficie y borde" },
  vidrio: { nombre: "Vidrio", pie: "Translúcido, con desenfoque" },
  elevado: { nombre: "Elevado", pie: "Sólido, con sombra" },
  contorno: { nombre: "Contorno", pie: "Solo el borde, sin relleno" },
  degradado: { nombre: "Degradado", pie: "Se funde hacia tu acento" },
};

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
export function fuenteDe(v: unknown): Fuente {
  return (FUENTES as readonly unknown[]).includes(v) ? (v as Fuente) : "sistema";
}
export function portadaDe(v: unknown): EstiloPortada {
  return (PORTADAS as readonly unknown[]).includes(v) ? (v as EstiloPortada) : "card";
}
export function efectoDe(v: unknown): Efecto {
  return (EFECTOS as readonly unknown[]).includes(v) ? (v as Efecto) : "plano";
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL TRADUCTOR DE ACABADOS — de `efecto` a CSS de verdad
 * ════════════════════════════════════════════════════════════════════
 *
 * Existe para que `vista-pagina.tsx` no tenga cinco ramas de estilo
 * repetidas en la card de lista, en la de grilla y en el encabezado.
 * Un solo lugar decide cómo se ve una pieza; el JSX solo la pide.
 *
 * `destacada` es la puerta del menú: es el producto, y en todos los
 * acabados se distingue por el acento. No es un color aparte, es el
 * mismo acabado subido de tono.
 */
export function estiloDePieza(
  efecto: Efecto,
  p: Paleta,
  opciones: { destacada?: boolean; radio: number; conFoto?: boolean } = { radio: 14 },
): React.CSSProperties {
  const { destacada = false, radio, conFoto = false } = opciones;
  const base: React.CSSProperties = { borderRadius: radio };

  // Con foto detrás, el relleno lo pone la foto y su velo: cualquier
  // superficie encima la taparía. Lo único que sobrevive del acabado es
  // el borde y la sombra, que sí siguen leyéndose.
  if (conFoto) {
    return {
      ...base,
      border: `1px solid ${destacada ? p.acento : p.borde}`,
      boxShadow: efecto === "elevado" ? "0 10px 24px -12px rgba(0,0,0,.55)" : undefined,
    };
  }

  switch (efecto) {
    case "vidrio":
      return {
        ...base,
        background: p.superficie,
        border: `1px solid ${destacada ? p.acento : p.borde}`,
        backdropFilter: "blur(14px) saturate(1.3)",
        WebkitBackdropFilter: "blur(14px) saturate(1.3)",
      };
    case "elevado":
      // Sin borde a propósito: el borde y la sombra juntos ensucian el
      // canto. La sombra es azul de marca con alfa, como las tres del
      // sistema — una sombra gris sobre fondo de color se ve sucia.
      return {
        ...base,
        background: p.superficie,
        border: destacada ? `1px solid ${p.acento}` : "1px solid transparent",
        boxShadow: "0 12px 26px -14px rgba(6,12,26,.55), 0 2px 5px rgba(6,12,26,.18)",
      };
    case "contorno":
      return {
        ...base,
        background: "transparent",
        border: `2px solid ${destacada ? p.acento : p.borde}`,
      };
    case "degradado":
      return {
        ...base,
        // 14%/0% de alfa sobre el acento: se nota el tinte pero el texto
        // sigue leyéndose contra la tinta del tema, que es lo que se
        // audita. Un degradado al acento sólido cambiaría el contraste
        // de la mitad de la card y ya no habría un solo par medido.
        background: destacada
          ? `linear-gradient(135deg, ${p.acento} 0%, ${p.acento}cc 100%)`
          : `linear-gradient(135deg, ${p.superficie} 0%, ${p.acento}24 100%)`,
        border: `1px solid ${destacada ? p.acento : p.borde}`,
      };
    default:
      return { ...base, background: p.superficie, border: `1px solid ${destacada ? p.acento : p.borde}` };
  }
}

/**
 * El velo que va SOBRE la foto de fondo de una pieza.
 *
 * No es configurable a propósito: con una foto detrás, el texto puede
 * quedar ilegible con cualquier combinación de colores, y la
 * legibilidad no es una preferencia. El negocio elige la foto; el
 * contraste lo garantiza el sistema. Se calcula del FONDO del tema, no
 * del acento, porque la tinta que va encima es la del tema.
 */
export function veloDeFoto(p: Paleta): string {
  const oscuro = esOscuro(p.tinta) === false; // tinta clara ⇒ tema oscuro
  return oscuro
    ? "linear-gradient(180deg, rgba(6,10,22,.42) 0%, rgba(6,10,22,.78) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.86) 100%)";
}
