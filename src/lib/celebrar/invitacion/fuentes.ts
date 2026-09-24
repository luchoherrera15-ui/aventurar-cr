/**
 * Las tipografías que puede usar una invitación. Google Fonts, cargadas
 * bajo demanda con un <link> (el editor cambia de letra en vivo, así que
 * `next/font` —que es estático— no sirve acá). Cada una con su pila de
 * respaldo y su carácter, para que el generador de plantillas combine
 * con criterio (una script para títulos siempre va con una sans o una
 * serif tranquila para el texto).
 */

export type CaracterFuente = "serif" | "sans" | "script" | "display";

export type Fuente = {
  id: string;
  familia: string;
  pila: string;
  caracter: CaracterFuente;
  /** Pesos que se piden a Google. */
  pesos: readonly number[];
  /** Cómo se llama en el editor. */
  nombre: string;
};

export const FUENTES = [
  { id: "montserrat", familia: "Montserrat", pila: "system-ui, sans-serif", caracter: "sans", pesos: [400, 600, 700, 800], nombre: "Montserrat" },
  { id: "poppins", familia: "Poppins", pila: "system-ui, sans-serif", caracter: "sans", pesos: [400, 600, 700], nombre: "Poppins" },
  { id: "raleway", familia: "Raleway", pila: "system-ui, sans-serif", caracter: "sans", pesos: [400, 600, 700], nombre: "Raleway" },
  { id: "josefin", familia: "Josefin Sans", pila: "system-ui, sans-serif", caracter: "sans", pesos: [400, 600, 700], nombre: "Josefin Sans" },
  { id: "nunito", familia: "Nunito", pila: "system-ui, sans-serif", caracter: "sans", pesos: [400, 700, 800], nombre: "Nunito" },
  { id: "quicksand", familia: "Quicksand", pila: "system-ui, sans-serif", caracter: "sans", pesos: [400, 600, 700], nombre: "Quicksand" },
  { id: "fredoka", familia: "Fredoka", pila: "system-ui, sans-serif", caracter: "sans", pesos: [400, 600, 700], nombre: "Fredoka" },
  { id: "baloo", familia: "Baloo 2", pila: "system-ui, sans-serif", caracter: "sans", pesos: [400, 700, 800], nombre: "Baloo 2" },
  { id: "playfair", familia: "Playfair Display", pila: "Georgia, serif", caracter: "serif", pesos: [400, 700], nombre: "Playfair Display" },
  { id: "cormorant", familia: "Cormorant Garamond", pila: "Georgia, serif", caracter: "serif", pesos: [400, 600, 700], nombre: "Cormorant" },
  { id: "lora", familia: "Lora", pila: "Georgia, serif", caracter: "serif", pesos: [400, 600, 700], nombre: "Lora" },
  { id: "libre", familia: "Libre Baskerville", pila: "Georgia, serif", caracter: "serif", pesos: [400, 700], nombre: "Libre Baskerville" },
  { id: "cinzel", familia: "Cinzel", pila: "Georgia, serif", caracter: "serif", pesos: [400, 700], nombre: "Cinzel" },
  { id: "dmserif", familia: "DM Serif Display", pila: "Georgia, serif", caracter: "display", pesos: [400], nombre: "DM Serif Display" },
  { id: "abril", familia: "Abril Fatface", pila: "Georgia, serif", caracter: "display", pesos: [400], nombre: "Abril Fatface" },
  { id: "bebas", familia: "Bebas Neue", pila: "Impact, sans-serif", caracter: "display", pesos: [400], nombre: "Bebas Neue" },
  { id: "oswald", familia: "Oswald", pila: "Impact, sans-serif", caracter: "display", pesos: [400, 600, 700], nombre: "Oswald" },
  { id: "greatvibes", familia: "Great Vibes", pila: "cursive", caracter: "script", pesos: [400], nombre: "Great Vibes" },
  { id: "dancing", familia: "Dancing Script", pila: "cursive", caracter: "script", pesos: [400, 700], nombre: "Dancing Script" },
  { id: "parisienne", familia: "Parisienne", pila: "cursive", caracter: "script", pesos: [400], nombre: "Parisienne" },
  { id: "pacifico", familia: "Pacifico", pila: "cursive", caracter: "script", pesos: [400], nombre: "Pacifico" },
  { id: "sacramento", familia: "Sacramento", pila: "cursive", caracter: "script", pesos: [400], nombre: "Sacramento" },
] as const satisfies readonly Fuente[];

export type FuenteId = (typeof FUENTES)[number]["id"];

export const FUENTE_POR_ID: Record<string, Fuente> = Object.fromEntries(FUENTES.map((f) => [f.id, f]));

export function esFuenteId(v: unknown): v is FuenteId {
  return typeof v === "string" && v in FUENTE_POR_ID;
}

export function pilaDe(id: string): string {
  const f = FUENTE_POR_ID[id] ?? FUENTE_POR_ID.montserrat;
  return `"${f.familia}", ${f.pila}`;
}

/**
 * La URL de Google Fonts para las fuentes de un estilo (título y texto,
 * sin repetir). `display=swap` para que el texto se vea con la pila de
 * respaldo mientras baja la letra.
 */
export function urlGoogleFonts(ids: readonly string[]): string {
  const unicas = [...new Set(ids.map((id) => (id in FUENTE_POR_ID ? id : "montserrat")))];
  const familias = unicas.map((id) => {
    const f = FUENTE_POR_ID[id];
    return `family=${encodeURIComponent(f.familia).replace(/%20/g, "+")}:wght@${f.pesos.join(";")}`;
  });
  return `https://fonts.googleapis.com/css2?${familias.join("&")}&display=swap`;
}
