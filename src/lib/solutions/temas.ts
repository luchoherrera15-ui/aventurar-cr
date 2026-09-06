/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS TEMAS DE SOLUTIONS — el vestido de /s/<slug>
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (4 sep 2026): que el negocio elija el diseño y el
 * tipo de card, «casi un creador de mini-websites». Y el 6 sep 2026:
 * «que sea MUY personalizable, con animaciones, tipo Linktree».
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
 *
 * ── LAS OPCIONES FINAS VIVEN EN `Diseno` (0236) ─────────────────────
 * Animación de entrada, efecto al pasar, fondo, estilo de botón, forma
 * y tamaño del logo, alineación, densidad, vitrina y fila de redes.
 * Se guardan en UN jsonb (`solutions_negocios.diseno`) y se sanean
 * acá con `disenoDe`, llave por llave, igual que `temaDe` sanea el
 * tema: la base guarda, este archivo decide qué vale.
 */

export const TEMAS = [
  "marca", "noche", "claro", "crema", "bosque", "vino",
  // 0236: siete más, para que un lavacar, una boutique o un creador
  // encuentren el suyo sin pasar por «restaurante de noche».
  "arena", "cielo", "grafito", "menta", "neon", "lavanda", "oceano",
] as const;
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

// ════════════════════════════════════════════════════════════════════
//  LAS OPCIONES FINAS (0236) — cada una, una lista cerrada
// ════════════════════════════════════════════════════════════════════

/** Cómo entran las piezas cuando se abre la página. */
export const ANIMACIONES = ["ninguna", "aparecer", "subir", "escalar", "deslizar"] as const;
export type Animacion = (typeof ANIMACIONES)[number];

/** Qué hace un botón cuando el mouse pasa por encima. */
export const HOVERS = ["suave", "elevar", "crecer", "brillo", "ninguno"] as const;
export type Hover = (typeof HOVERS)[number];

/** El fondo de la página, detrás de todo. */
export const FONDOS = ["liso", "diagonal", "puntos", "cuadricula", "rayas", "aurora", "burbujas"] as const;
export type Fondo = (typeof FONDOS)[number];

/** El estilo del botón, por encima del acabado. */
export const BOTONES = ["acabado", "solido", "contorno", "sombra"] as const;
export type Boton = (typeof BOTONES)[number];

export const LOGO_FORMAS = ["auto", "circulo", "redondeado", "cuadrado"] as const;
export type LogoForma = (typeof LOGO_FORMAS)[number];

export const LOGO_TAMANOS = ["medio", "chico", "grande"] as const;
export type LogoTamano = (typeof LOGO_TAMANOS)[number];

export const ALINEACIONES = ["auto", "izquierda", "centro"] as const;
export type Alineacion = (typeof ALINEACIONES)[number];

export const DENSIDADES = ["normal", "compacta", "amplia"] as const;
export type Densidad = (typeof DENSIDADES)[number];

/** Cómo aparece el catálogo en el link hub: un botón, los destacados o entero. */
export const VITRINAS = ["boton", "destacados", "todo"] as const;
export type Vitrina = (typeof VITRINAS)[number];

/** Dónde va la fila de íconos de redes. */
export const REDES = ["arriba", "abajo", "ocultas"] as const;
export type Redes = (typeof REDES)[number];

/** El titular: normal, grande o en mayúsculas espaciadas. */
export const TITULOS = ["normal", "grande", "mayusculas"] as const;
export type Titulo = (typeof TITULOS)[number];

export type Diseno = {
  animacion: Animacion;
  hover: Hover;
  fondo: Fondo;
  boton: Boton;
  logoForma: LogoForma;
  logoTamano: LogoTamano;
  alineacion: Alineacion;
  densidad: Densidad;
  vitrina: Vitrina;
  redes: Redes;
  titulo: Titulo;
};

/** Los defaults = cómo se veía la página antes de la 0236. */
export const DISENO_BASE: Diseno = {
  animacion: "ninguna",
  hover: "suave",
  fondo: "liso",
  boton: "acabado",
  logoForma: "auto",
  logoTamano: "medio",
  alineacion: "auto",
  densidad: "normal",
  vitrina: "boton",
  redes: "arriba",
  titulo: "normal",
};

type Opcion = { nombre: string; pie: string };

/** Cómo se llama cada opción en el editor. */
export const DISENO_OPCION: {
  animacion: Record<Animacion, Opcion>;
  hover: Record<Hover, Opcion>;
  fondo: Record<Fondo, Opcion>;
  boton: Record<Boton, Opcion>;
  logoForma: Record<LogoForma, Opcion>;
  logoTamano: Record<LogoTamano, Opcion>;
  alineacion: Record<Alineacion, Opcion>;
  densidad: Record<Densidad, Opcion>;
  vitrina: Record<Vitrina, Opcion>;
  redes: Record<Redes, Opcion>;
  titulo: Record<Titulo, Opcion>;
} = {
  animacion: {
    ninguna: { nombre: "Sin animación", pie: "Todo aparece de una" },
    aparecer: { nombre: "Aparecer", pie: "Se funde, pieza por pieza" },
    subir: { nombre: "Subir", pie: "Entra desde abajo, en cascada" },
    escalar: { nombre: "Escalar", pie: "Crece hasta su tamaño" },
    deslizar: { nombre: "Deslizar", pie: "Entra desde la izquierda" },
  },
  hover: {
    suave: { nombre: "Suave", pie: "Se atenúa un poco" },
    elevar: { nombre: "Elevar", pie: "Sube 3 px con sombra" },
    crecer: { nombre: "Crecer", pie: "Se agranda apenas" },
    brillo: { nombre: "Brillo", pie: "Se ilumina" },
    ninguno: { nombre: "Ninguno", pie: "Quieto" },
  },
  fondo: {
    liso: { nombre: "Liso", pie: "El degradado del tema" },
    diagonal: { nombre: "Diagonal", pie: "Con un toque de tu acento" },
    puntos: { nombre: "Puntos", pie: "Trama de puntos finos" },
    cuadricula: { nombre: "Cuadrícula", pie: "Líneas finas, tipo papel" },
    rayas: { nombre: "Rayas", pie: "Diagonales muy suaves" },
    aurora: { nombre: "Aurora", pie: "Manchas de color que se mueven" },
    burbujas: { nombre: "Burbujas", pie: "Círculos que suben despacio" },
  },
  boton: {
    acabado: { nombre: "Del efecto", pie: "Sigue el acabado de arriba" },
    solido: { nombre: "Sólido", pie: "Relleno con tu acento" },
    contorno: { nombre: "Contorno", pie: "Borde de tu acento" },
    sombra: { nombre: "Sombra", pie: "Borde grueso y sombra desplazada, tipo cartel" },
  },
  logoForma: {
    auto: { nombre: "Automática", pie: "Círculo en cuadrícula, redondeado en lista" },
    circulo: { nombre: "Círculo", pie: "" },
    redondeado: { nombre: "Redondeado", pie: "" },
    cuadrado: { nombre: "Cuadrado", pie: "" },
  },
  logoTamano: {
    chico: { nombre: "Chico", pie: "" },
    medio: { nombre: "Medio", pie: "" },
    grande: { nombre: "Grande", pie: "" },
  },
  alineacion: {
    auto: { nombre: "Automática", pie: "Centrado en cuadrícula, a la izquierda en lista" },
    izquierda: { nombre: "Izquierda", pie: "" },
    centro: { nombre: "Centrado", pie: "" },
  },
  densidad: {
    compacta: { nombre: "Compacta", pie: "Más piezas a la vista" },
    normal: { nombre: "Normal", pie: "" },
    amplia: { nombre: "Amplia", pie: "Más aire entre piezas" },
  },
  vitrina: {
    boton: { nombre: "Un botón", pie: "«Ver el catálogo» lleva a la página" },
    destacados: { nombre: "Destacados", pie: "Los primeros, con foto y precio" },
    todo: { nombre: "Todo", pie: "El catálogo entero en la página" },
  },
  redes: {
    arriba: { nombre: "Bajo el nombre", pie: "" },
    abajo: { nombre: "Al pie", pie: "" },
    ocultas: { nombre: "Ocultas", pie: "" },
  },
  titulo: {
    normal: { nombre: "Normal", pie: "" },
    grande: { nombre: "Grande", pie: "" },
    mayusculas: { nombre: "Mayúsculas", pie: "Espaciadas" },
  },
};

function unoDe<T extends string>(lista: readonly T[], v: unknown, base: T): T {
  return (lista as readonly unknown[]).includes(v) ? (v as T) : base;
}

/** Lee el jsonb crudo y devuelve un `Diseno` completo y válido. */
export function disenoDe(v: unknown): Diseno {
  const d = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  return {
    animacion: unoDe(ANIMACIONES, d.animacion, DISENO_BASE.animacion),
    hover: unoDe(HOVERS, d.hover, DISENO_BASE.hover),
    fondo: unoDe(FONDOS, d.fondo, DISENO_BASE.fondo),
    boton: unoDe(BOTONES, d.boton, DISENO_BASE.boton),
    logoForma: unoDe(LOGO_FORMAS, d.logoForma, DISENO_BASE.logoForma),
    logoTamano: unoDe(LOGO_TAMANOS, d.logoTamano, DISENO_BASE.logoTamano),
    alineacion: unoDe(ALINEACIONES, d.alineacion, DISENO_BASE.alineacion),
    densidad: unoDe(DENSIDADES, d.densidad, DISENO_BASE.densidad),
    vitrina: unoDe(VITRINAS, d.vitrina, DISENO_BASE.vitrina),
    redes: unoDe(REDES, d.redes, DISENO_BASE.redes),
    titulo: unoDe(TITULOS, d.titulo, DISENO_BASE.titulo),
  };
}

// ════════════════════════════════════════════════════════════════════
//  LA PALETA
// ════════════════════════════════════════════════════════════════════

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
  arena: {
    id: "arena",
    nombre: "Arena",
    pie: "Tierra y sol",
    fondo: "#efe6d6",
    fondo2: "#e6d9c2",
    tinta: "#2d261c",
    suave: "rgba(45,38,28,0.66)",
    superficie: "rgba(45,38,28,0.06)",
    borde: "rgba(45,38,28,0.16)",
    acentoSugerido: "#c2543f",
  },
  cielo: {
    id: "cielo",
    nombre: "Cielo",
    pie: "Azul claro, fresco",
    fondo: "#eaf3fb",
    fondo2: "#dbe9f7",
    tinta: "#0f2a44",
    suave: "rgba(15,42,68,0.64)",
    superficie: "rgba(255,255,255,0.7)",
    borde: "rgba(15,42,68,0.14)",
    acentoSugerido: "#1f6fd6",
  },
  grafito: {
    id: "grafito",
    nombre: "Grafito",
    pie: "Gris carbón, moderno",
    fondo: "#1b1b1f",
    fondo2: "#26262c",
    tinta: "#f4f4f5",
    suave: "rgba(244,244,245,0.66)",
    superficie: "rgba(255,255,255,0.07)",
    borde: "rgba(255,255,255,0.14)",
    acentoSugerido: "#ff6a3d",
  },
  menta: {
    id: "menta",
    nombre: "Menta",
    pie: "Verde claro, natural",
    fondo: "#e8f5ee",
    fondo2: "#d8ecdf",
    tinta: "#0f2e23",
    suave: "rgba(15,46,35,0.64)",
    superficie: "rgba(255,255,255,0.65)",
    borde: "rgba(15,46,35,0.14)",
    acentoSugerido: "#1f8a5b",
  },
  neon: {
    id: "neon",
    nombre: "Neón",
    pie: "Negro con lima, para destacar",
    fondo: "#0c0c0c",
    fondo2: "#161616",
    tinta: "#ffffff",
    suave: "rgba(255,255,255,0.66)",
    superficie: "rgba(255,255,255,0.08)",
    borde: "rgba(255,255,255,0.18)",
    acentoSugerido: "#d4ff3b",
  },
  lavanda: {
    id: "lavanda",
    nombre: "Lavanda",
    pie: "Lila suave",
    fondo: "#ede9f8",
    fondo2: "#e1dbf3",
    tinta: "#2a1f4d",
    suave: "rgba(42,31,77,0.64)",
    superficie: "rgba(255,255,255,0.65)",
    borde: "rgba(42,31,77,0.14)",
    acentoSugerido: "#6b4de6",
  },
  oceano: {
    id: "oceano",
    nombre: "Océano",
    pie: "Azul profundo",
    fondo: "#06283d",
    fondo2: "#0b3a55",
    tinta: "#eef7fb",
    suave: "rgba(238,247,251,0.66)",
    superficie: "rgba(255,255,255,0.07)",
    borde: "rgba(255,255,255,0.15)",
    acentoSugerido: "#47b5ff",
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

/** Un hex con alfa, como rgba(). Un color que no sea hex vuelve gris translúcido. */
export function conAlfa(hex: string, alfa: number): string {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(127,127,127,${alfa})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(127,127,127,${alfa})`;
  return `rgba(${r},${g},${b},${alfa})`;
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
 *
 * `boton` (0236) va POR ENCIMA del acabado: «sólido» rellena con el
 * acento, «contorno» deja solo el borde del acento y «sombra» pone el
 * borde grueso con sombra desplazada. «acabado» = lo de siempre.
 */
export function estiloDePieza(
  efecto: Efecto,
  p: Paleta,
  opciones: { destacada?: boolean; radio: number; conFoto?: boolean; boton?: Boton } = { radio: 14 },
): React.CSSProperties {
  const { destacada = false, radio, conFoto = false, boton = "acabado" } = opciones;
  const base: React.CSSProperties = { borderRadius: radio };

  // Con foto detrás, el relleno lo pone la foto y su velo: cualquier
  // superficie encima la taparía. Lo único que sobrevive del acabado es
  // el borde y la sombra, que sí siguen leyéndose.
  if (conFoto) {
    return {
      ...base,
      border: `${boton === "sombra" ? 2 : 1}px solid ${destacada || boton === "contorno" ? p.acento : p.borde}`,
      boxShadow:
        boton === "sombra"
          ? `4px 4px 0 ${p.tinta}`
          : efecto === "elevado"
            ? "0 10px 24px -12px rgba(0,0,0,.55)"
            : undefined,
    };
  }

  // ── El estilo del botón manda sobre el acabado (0236) ──────────────
  if (boton === "solido") {
    return {
      ...base,
      background: p.acento,
      color: p.tintaSobreAcento,
      border: `1px solid ${p.acento}`,
      boxShadow: efecto === "elevado" ? `0 12px 26px -14px ${conAlfa(p.acento, 0.7)}` : undefined,
    };
  }
  if (boton === "contorno") {
    return {
      ...base,
      background: destacada ? conAlfa(p.acento, 0.12) : "transparent",
      border: `2px solid ${p.acento}`,
    };
  }
  if (boton === "sombra") {
    return {
      ...base,
      background: destacada ? p.acento : p.fondo,
      color: destacada ? p.tintaSobreAcento : p.tinta,
      border: `2px solid ${p.tinta}`,
      boxShadow: `4px 4px 0 ${p.tinta}`,
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
 * El fondo de la página según `diseno.fondo` (0236).
 *
 * Todo son capas de `background` sobre el degradado del tema: la trama
 * (puntos, cuadrícula, rayas) se dibuja con la TINTA del tema a muy
 * baja alfa, así que sale clara sobre oscuro y oscura sobre claro sin
 * elegir nada más. Aurora y burbujas no van acá: son piezas animadas
 * que el renderizador monta aparte (`FondoAnimado`), porque un
 * `background` no se puede animar sin disparar repintado.
 */
export function fondoDePagina(fondo: Fondo, p: Paleta): React.CSSProperties {
  const base = `linear-gradient(180deg, ${p.fondo} 0%, ${p.fondo2} 100%)`;
  const tinta = (a: number) => conAlfa(p.tinta, a);
  switch (fondo) {
    case "diagonal":
      return { background: `linear-gradient(135deg, ${p.fondo} 0%, ${p.fondo2} 55%, ${conAlfa(p.acento, 0.28)} 100%)` };
    case "puntos":
      return {
        backgroundImage: `radial-gradient(${tinta(0.16)} 1px, transparent 1.6px), ${base}`,
        backgroundSize: "18px 18px, 100% 100%",
      };
    case "cuadricula":
      return {
        backgroundImage: `linear-gradient(${tinta(0.09)} 1px, transparent 1px), linear-gradient(90deg, ${tinta(0.09)} 1px, transparent 1px), ${base}`,
        backgroundSize: "28px 28px, 28px 28px, 100% 100%",
      };
    case "rayas":
      return {
        backgroundImage: `repeating-linear-gradient(135deg, ${tinta(0.06)} 0 10px, transparent 10px 26px), ${base}`,
      };
    default:
      return { background: base };
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
