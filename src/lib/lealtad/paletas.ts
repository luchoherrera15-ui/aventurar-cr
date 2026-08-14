import { TIPOS_TARJETA_ID, type TipoTarjeta } from "./tipos-tarjeta";

/**
 * LAS OCHO PALETAS DE LA TARJETA, en un solo lugar.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ------------------------------------------------------------------
 * Los hexadecimales vivían dentro de `contenido-tipos.ts`, o sea dentro
 * del CONTENIDO de la landing. El visitante veía ocho tarjetas
 * diseñadas —el café marrón, el súper verde, la barbería grafito— y
 * después, al crear la suya, el panel le ofrecía dos ruedas de color
 * arrancando en el navy de Bookea. Elegía del menú y en la cocina le
 * daban los ingredientes sueltos.
 *
 * Ahora la landing y el creador leen de acá. No es orden por el orden:
 * si el creador tuviera su propia copia de los hexadecimales, el día
 * que alguien retoque el marrón de la landing las dos listas dejarían
 * de coincidir y nadie se enteraría hasta que un dueño diga «yo elegí
 * ese café y me salió otro».
 *
 * ------------------------------------------------------------------
 * SON TRES COLORES Y LA TARJETA USA DOS
 * ------------------------------------------------------------------
 * La terna va de lo más oscuro a lo más claro y así se usa:
 *
 *   · `colores[0]` → `pase_color_fondo`. Es el fondo del pase, tanto en
 *     la maqueta de la landing (`telefono-mockup.tsx` lo pone como
 *     `background` del pase) como en el pase real (`coloresDe`).
 *   · `colores[1]` es el TONO DEL MEDIO. Solo lo usa el degradado
 *     «orgánico» del fondo de la landing (`--c2`); el pase de Wallet no
 *     tiene dónde ponerlo — Apple pinta fondo, texto blanco y el color
 *     de las etiquetas, nada más.
 *   · `colores[2]` → `pase_color_sello`, el acento. Es el más claro de
 *     los tres, que es exactamente lo que hace falta para que un sello
 *     encendido se despegue del fondo oscuro. Con `colores[1]` los
 *     sellos quedarían a un paso del fondo y «llevás 5» se leería igual
 *     que «te faltan 5».
 *
 * ------------------------------------------------------------------
 * LAS OCHO SON OSCURAS, Y ESO NO ES GUSTO
 * ------------------------------------------------------------------
 * Apple pinta el texto del pase de blanco fijo
 * (`foregroundColor: rgb(255,255,255)` en `construirPassJson`). Un
 * fondo claro no es una tarjeta fea: es una tarjeta que no se lee.
 */

/** Del fondo al acento: oscuro → medio → claro. */
export type TernaColor = readonly [string, string, string];

export type Paleta = {
  /**
   * La paleta se identifica por el TIPO que la estrenó en la landing,
   * no por un id propio: así `PALETAS[tipo]` es la que el dueño vio
   * cuando eligió ese tipo, sin una tabla de traducción en el medio.
   */
  id: TipoTarjeta;
  /** Cómo se llama en el creador. Nunca el nombre del negocio de ejemplo. */
  nombre: string;
  colores: TernaColor;
};

export const PALETAS: Record<TipoTarjeta, Paleta> = {
  sellos: { id: "sellos", nombre: "Café tostado", colores: ["#4a2f1d", "#8a5a33", "#c98f4e"] },
  puntos: { id: "puntos", nombre: "Cosecha", colores: ["#123528", "#1f6b4a", "#3fae74"] },
  cupon: { id: "cupon", nombre: "Horno de leña", colores: ["#5c1717", "#a8321f", "#e0713a"] },
  descuento: { id: "descuento", nombre: "Grafito", colores: ["#16161c", "#3a3a48", "#6f6f82"] },
  membresia: { id: "membresia", nombre: "Club azul", colores: ["#16233d", "#2c4a80", "#5b86c9"] },
  giftcard: { id: "giftcard", nombre: "Violeta", colores: ["#2c1c3d", "#5b3a7a", "#9b6fc4"] },
  evento: { id: "evento", nombre: "Laguna", colores: ["#0d2c33", "#1c6b73", "#38a9a4"] },
  cashback: { id: "cashback", nombre: "Marea", colores: ["#0b2540", "#155285", "#2f8ccc"] },
};

/**
 * Las ocho en el orden del catálogo de tipos.
 *
 * Sale de `TIPOS_TARJETA_ID` y no de `Object.values`: el orden de las
 * claves de un objeto es un detalle del motor, y la fila de plantillas
 * del creador no debería reordenarse sola.
 */
export const PALETAS_LISTA: readonly Paleta[] = TIPOS_TARJETA_ID.map((id) => PALETAS[id]);

/** Los dos colores que la tarjeta guarda de verdad. */
export function coloresDePaleta(paleta: Paleta): { fondo: string; sello: string } {
  return { fondo: paleta.colores[0], sello: paleta.colores[2] };
}

/**
 * Qué plantilla está marcada, si alguna.
 *
 * Se DERIVA de los dos colores en vez de guardarse aparte, y por eso
 * afinar una rueda no borra nada: simplemente ninguna plantilla coincide
 * y ninguna queda marcada. Con un `paletaElegida` en el estado habría
 * dos verdades —la marcada y los colores— y se separarían al primer
 * toque.
 */
export function paletaDeLosColores(fondo: string, sello: string): Paleta | null {
  const f = fondo.trim().toLowerCase();
  const s = sello.trim().toLowerCase();
  return (
    PALETAS_LISTA.find(
      (p) => p.colores[0].toLowerCase() === f && p.colores[2].toLowerCase() === s,
    ) ?? null
  );
}
