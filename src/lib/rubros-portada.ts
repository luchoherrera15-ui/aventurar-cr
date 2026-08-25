/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS RUBROS DE LA PORTADA — una sola lista, dos lectores
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): «si presiono algún ícono de acá esto me
 * lleva a otra página, quiero que esto YA DEJE DE SER ASÍ — la idea es
 * que TODO se encuentre acá mismo, en la misma página de bookea.lat».
 *
 * Antes cada ícono del héroe era un link a `/citas?categoria=unas` o
 * `/eventos?categoria=lugares`: nueve puertas que sacaban al visitante
 * de la portada. Ahora los nueve filtran EN LA MISMA PÁGINA con
 * `?rubro=`, y el catálogo de abajo se recorta sin recargar de cero.
 *
 * ── POR QUÉ ESTA LISTA VIVE ACÁ Y NO EN EL COMPONENTE ───────────────
 *
 * Porque ahora la leen DOS lados que tienen que coincidir o el filtro
 * miente: `rubros-icono.tsx` (que arma los links) y `rieles-catalogo.tsx`
 * (que recorta el catálogo). Con la lista adentro del componente, el día
 * que se agregue un rubro habría que acordarse de tocar el otro lado —
 * y no hay nada que avise cuando no se hace.
 *
 * ── LA CATEGORÍA ALCANZA COMO CLAVE, Y ESTÁ COMPROBADO ──────────────
 *
 * El parámetro es `?rubro=unas`, no `?rubro=citas-unas`: las nueve
 * categorías son distintas entre sí aunque vengan de dos verticales
 * (unas, belleza, barberia, spa, consultorio | lugares, alimentacion,
 * animacion, decoracion). `rubros-portada.test.ts` lo verifica — si
 * algún día entra una categoría repetida en otra vertical, ese test se
 * pone rojo antes de que el filtro empiece a mezclar negocios.
 *
 * ── LOS NOMBRES NO SE INVENTAN ──────────────────────────────────────
 *
 * `vertical` y `categoria` son los valores REALES de la base (los mismos
 * que usa `categoriaIcono` y el resto del directorio). CLAUDE.md
 * prohíbe inventar categorías, y una lista escrita a mano acá sería
 * exactamente eso.
 */

export type RubroPortada = {
  /** La vertical en la base: "citas" o "eventos". */
  vertical: string;
  /** La categoría en la base. Es también la clave de `?rubro=`. */
  categoria: string;
  /** Cómo se lee en pantalla. */
  label: string;
};

export const RUBROS_PORTADA: readonly RubroPortada[] = [
  { vertical: "citas", categoria: "unas", label: "Uñas" },
  { vertical: "citas", categoria: "belleza", label: "Belleza" },
  { vertical: "citas", categoria: "barberia", label: "Barbería" },
  { vertical: "citas", categoria: "spa", label: "Spa" },
  { vertical: "citas", categoria: "consultorio", label: "Salud" },
  { vertical: "eventos", categoria: "lugares", label: "Lugares" },
  { vertical: "eventos", categoria: "alimentacion", label: "Catering" },
  { vertical: "eventos", categoria: "animacion", label: "Música" },
  { vertical: "eventos", categoria: "decoracion", label: "Decoración" },
] as const;

/**
 * El rubro que pide la URL, o null.
 *
 * Devuelve el objeto entero y no un booleano porque quien filtra
 * necesita la VERTICAL además de la categoría: hay categorías que
 * podrían repetirse el día de mañana en otra vertical, y filtrar solo
 * por categoría mezclaría negocios de dos catálogos distintos.
 *
 * Tolera `undefined` y `string[]` porque eso es exactamente lo que
 * entrega `searchParams` de Next cuando el parámetro falta o viene
 * repetido (`?rubro=a&rubro=b`). Un `string[]` se rechaza entero en vez
 * de agarrar el primero: pedir dos rubros a la vez no es una intención
 * que la portada sepa cumplir, y adivinar cuál vale sería peor que no
 * filtrar.
 */
export function rubroDeParametro(
  valor: string | string[] | undefined,
): RubroPortada | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().toLowerCase();
  return RUBROS_PORTADA.find((r) => r.categoria === limpio) ?? null;
}

/** El link del ícono: la misma portada, filtrada, y bajando al catálogo. */
export function urlDeRubro(categoria: string): string {
  return `/?rubro=${encodeURIComponent(categoria)}#catalogo`;
}
