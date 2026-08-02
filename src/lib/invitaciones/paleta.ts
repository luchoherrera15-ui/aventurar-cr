/**
 * La paleta de una invitación, para que su álbum de fotos se vea de la
 * misma familia.
 *
 * El problema: la invitación NO guarda su paleta en ningún lado. El
 * campo `tema` quedó vestigial — todas las que se venden usan
 * `html_personalizado`, que es CSS escrito a la medida por el agente
 * diseñador. Así que el color hay que sacarlo de ahí.
 *
 * Esto es una heurística y se equivoca a veces: un diseño puede tener
 * doce colores y ninguno mandar de verdad. Por eso el resultado es un
 * DEFECTO, no una sentencia: `invitaciones.paleta` (0089) lo pisa
 * cuando alguien lo corrige a mano desde el panel.
 *
 * Módulo neutral (sin "use client"): lo usa la página del álbum en el
 * servidor y el formulario del admin en el navegador.
 */

export type Paleta = {
  /** El lienzo. */
  fondo: string;
  /** El texto sobre ese lienzo. */
  tinta: string;
  /** Detalles: el pie, los remates. */
  acento: string;
};

/** El crema y navy con que nació el álbum; se usa si no hay de dónde sacar. */
export const PALETA_ALBUM_DEFECTO: Paleta = {
  fondo: "#f7f2ea",
  tinta: "#16295e",
  acento: "#16295e",
};

const HEX_CORTO = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LARGO = /^#([0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

/** Cualquier notación CSS de color a "#rrggbb". null si no se entiende. */
export function normalizarColor(valor: string): string | null {
  const v = valor.trim().toLowerCase();

  const corto = HEX_CORTO.exec(v);
  if (corto) return `#${corto[1]}${corto[1]}${corto[2]}${corto[2]}${corto[3]}${corto[3]}`;

  const largo = HEX_LARGO.exec(v);
  if (largo) return `#${largo[1].toLowerCase()}`;

  const rgb = RGB.exec(v);
  if (rgb) {
    const canal = (n: string) => {
      const x = Math.round(Number(n));
      return Math.max(0, Math.min(255, Number.isFinite(x) ? x : 0))
        .toString(16)
        .padStart(2, "0");
    };
    return `#${canal(rgb[1])}${canal(rgb[2])}${canal(rgb[3])}`;
  }

  return null;
}

/** Luminancia relativa (WCAG), 0 = negro, 1 = blanco. */
export function luminancia(hex: string): number {
  const n = normalizarColor(hex);
  if (!n) return 0;
  const canal = (i: number) => {
    const c = parseInt(n.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** Razón de contraste WCAG entre dos colores (1 = iguales, 21 = máximo). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** El texto que se lee sobre un fondo dado, cuando el original no sirve. */
export function tintaLegible(fondo: string): string {
  return luminancia(fondo) > 0.45 ? "#1a1a1a" : "#f7f5f2";
}

/** Cuenta apariciones y devuelve los colores del más usado al menos usado. */
function porFrecuencia(colores: string[]): string[] {
  const cuenta = new Map<string, number>();
  for (const c of colores) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/** Todos los colores de una lista de declaraciones CSS, ya normalizados. */
function coloresDe(html: string, propiedad: RegExp): string[] {
  const salida: string[] = [];
  for (const m of html.matchAll(propiedad)) {
    const valor = m[1] ?? "";
    // Un degradado sirve igual: su primer color es el que domina arriba.
    for (const token of valor.matchAll(/#[0-9a-f]{3,6}\b|rgba?\([^)]*\)/gi)) {
      const c = normalizarColor(token[0]);
      if (c) salida.push(c);
    }
  }
  return salida;
}

// `background`, `background-color` y `background-image` (degradados).
const DECL_FONDO = /background(?:-color|-image)?\s*:\s*([^;}"']+)/gi;
const DECL_TEXTO = /(?<!-)\bcolor\s*:\s*([^;}"']+)/gi;

/**
 * Deduce la paleta del HTML de una invitación. Devuelve null si el
 * diseño no da ninguna pista utilizable.
 *
 * Cómo elige:
 *  · fondo — el color de fondo más repetido. En una invitación de una
 *    sola pieza, el lienzo se declara muchas más veces que cualquier
 *    detalle.
 *  · tinta — el `color:` más repetido, siempre que se lea sobre ese
 *    fondo; si no contrasta, se cambia por negro o blanco.
 *  · acento — el fondo siguiente más usado que no sea ninguno de los
 *    dos y que se distinga del lienzo. Si no hay, se usa la tinta.
 */
export function extraerPaleta(html: string | null | undefined): Paleta | null {
  if (!html || html.length < 20) return null;

  const fondos = porFrecuencia(coloresDe(html, DECL_FONDO));
  const textos = porFrecuencia(coloresDe(html, DECL_TEXTO));
  if (fondos.length === 0 && textos.length === 0) return null;

  const fondo = fondos[0] ?? PALETA_ALBUM_DEFECTO.fondo;

  // 4.5:1 es el mínimo de WCAG para texto normal. Un diseño puede
  // permitirse texto de bajo contraste sobre una foto de portada; una
  // grilla de fotos con leyendas, no.
  const candidata = textos.find((t) => contraste(t, fondo) >= 4.5);
  const tinta = candidata ?? tintaLegible(fondo);

  // El acento tiene que despegarse del lienzo, o el pie del álbum
  // desaparece contra el fondo.
  const acento =
    fondos.slice(1).find((c) => c !== tinta && contraste(c, fondo) >= 2) ??
    textos.find((c) => c !== tinta && contraste(c, fondo) >= 3) ??
    tinta;

  return { fondo, tinta, acento };
}

/** Una paleta guardada a mano en `invitaciones.paleta` (0089). */
export function paletaGuardada(valor: unknown): Paleta | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as Record<string, unknown>;
  const fondo = normalizarColor(String(v.fondo ?? ""));
  const tinta = normalizarColor(String(v.tinta ?? ""));
  const acento = normalizarColor(String(v.acento ?? ""));
  // Los tres o ninguno: media paleta deja el álbum peor que el defecto.
  if (!fondo || !tinta || !acento) return null;
  return { fondo, tinta, acento };
}

/**
 * La paleta que le toca al álbum, en orden de prioridad: lo que se
 * corrigió a mano, lo que se deduce del diseño, y el crema de siempre.
 */
export function paletaDelAlbum({
  paleta,
  htmlPersonalizado,
}: {
  paleta?: unknown;
  htmlPersonalizado?: string | null;
}): Paleta {
  return (
    paletaGuardada(paleta) ??
    extraerPaleta(htmlPersonalizado) ??
    PALETA_ALBUM_DEFECTO
  );
}

/** "#16295e" + 0.55 → "rgba(22,41,94,0.55)", para opacidades inline. */
export function conAlfa(hex: string, alfa: number): string {
  const n = normalizarColor(hex) ?? "#000000";
  const c = (i: number) => parseInt(n.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgba(${c(0)}, ${c(1)}, ${c(2)}, ${alfa})`;
}
