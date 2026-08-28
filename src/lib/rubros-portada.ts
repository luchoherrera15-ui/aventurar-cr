/**
 * ════════════════════════════════════════════════════════════════════
 *  EL FILTRO DE LA PORTADA — `bookea.lat/?rubro=`
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): «el MARKETPLACE y la única página donde
 * se puedan ver los negocios es bookea.lat».
 *
 * Los directorios `/citas` y `/eventos` se borraron. Todo lo que antes
 * mandaba ahí —los nueve íconos del héroe, el mega menú, el cajón del
 * teléfono— ahora escribe `?rubro=` sobre la propia portada, y el
 * catálogo de abajo se recorta sin cambiar de página.
 *
 * ── LA CLAVE LLEVA LA VERTICAL, Y NO ES OPCIONAL ────────────────────
 *
 * `?rubro=citas-belleza`, no `?rubro=belleza`. Parece redundante hasta
 * que se mira la taxonomía completa: **«otros» existe en las DOS
 * verticales** (`otros` de Eventos y `otros` de Citas). Con la
 * categoría sola, `/?rubro=otros` tendría que adivinar cuál de las dos,
 * y elegiría siempre la misma — mostrando el catálogo equivocado sin
 * que nada avise.
 *
 * ── PERO LAS NUEVE VIEJAS SE SIGUEN ACEPTANDO ───────────────────────
 *
 * La primera versión de esto usó la categoría sola (`?rubro=unas`) y
 * estuvo en producción. Esas nueve son únicas entre sí, así que se
 * resuelven sin ambigüedad y se siguen entendiendo: un link compartido
 * o un favorito guardado en esa media hora no puede quedar roto.
 *
 * ── NO SE VALIDA CONTRA UNA LISTA DE CATEGORÍAS ─────────────────────
 *
 * A propósito. Enumerarlas acá sería una tercera taxonomía que se
 * despega de `CATEGORIAS`/`CATEGORIAS_CITAS` a la primera categoría
 * nueva. Si llega una que no existe, el filtro no devuelve negocios y
 * la portada dice «todavía no hay» — que es más honesto que ignorar el
 * filtro y mostrar el catálogo entero como si nada hubiera pasado.
 */

export type RubroPortada = {
  /** La vertical en la base: "citas" o "eventos". */
  vertical: string;
  /** La categoría en la base. */
  categoria: string;
  /** La subcategoría, si el destino la traía. La leen las DOS
   *  verticales de la portada: Eventos desde siempre, Citas desde la
   *  grilla de dos carriles (28 ago 2026). */
  subcategoria?: string;
  /** Cómo se lee en pantalla. Solo lo traen los nueve del héroe; para
   *  cualquier otra categoría lo resuelve quien lo necesite con
   *  `etiquetaDeCategoria` (carriles-home.ts).
   *
   *  ⚠️ NO se resuelve acá a propósito: `carriles-home` importa ESTE
   *  módulo para armar sus URLs, así que importarlo de vuelta cerraría
   *  un ciclo entre los dos. */
  label?: string;
};

/** Las verticales cuyo catálogo vive en la portada. */
const VERTICALES = ["citas", "eventos"] as const;

/**
 * Los nueve rubros con ícono en el héroe. Es una lista de PRESENTACIÓN
 * —qué se ofrece de un vistazo—, no la de categorías válidas: el filtro
 * acepta cualquiera (ver arriba).
 */
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

/** Un solo valor de texto, o null si vino repetido, vacío o ausente. */
function unico(valor: string | string[] | undefined): string | null {
  // Un `string[]` (`?rubro=a&rubro=b`) se rechaza entero en vez de
  // agarrar el primero: pedir dos rubros a la vez no es una intención
  // que la portada sepa cumplir, y adivinar sería peor que no filtrar.
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().toLowerCase();
  return limpio.length > 0 ? limpio : null;
}

/**
 * El rubro que pide la URL, o null si no hay filtro.
 *
 * `sub` llega aparte (`?sub=`) porque una subcategoría no es parte del
 * nombre del rubro: es un recorte DENTRO de él, y meterla en la misma
 * clave obligaría a partir el texto por guiones sabiendo que tanto la
 * vertical como la categoría pueden traer los suyos.
 */
export function rubroDeParametro(
  valor: string | string[] | undefined,
  sub?: string | string[] | undefined,
): RubroPortada | null {
  const crudo = unico(valor);
  if (!crudo) return null;

  const subcategoria = unico(sub) ?? undefined;

  // Forma nueva: «vertical-categoria».
  for (const vertical of VERTICALES) {
    const prefijo = `${vertical}-`;
    if (crudo.startsWith(prefijo)) {
      const categoria = crudo.slice(prefijo.length);
      if (!categoria) return null;
      return { vertical, categoria, subcategoria };
    }
  }

  // Forma vieja: la categoría sola. Solo las nueve del héroe, que son
  // únicas entre sí — ver la cabecera.
  const conocido = RUBROS_PORTADA.find((r) => r.categoria === crudo);
  return conocido ? { ...conocido, subcategoria } : null;
}

/**
 * El link de un rubro: la misma portada, filtrada, y bajando al
 * catálogo. Sin el ancla, filtrar dejaría a la persona mirando el mismo
 * héroe, convencida de que el clic no hizo nada.
 */
export function urlDeRubro(
  vertical: string,
  categoria: string,
  subcategoria?: string | null,
): string {
  const base = `/?rubro=${encodeURIComponent(`${vertical}-${categoria}`)}`;
  const conSub = subcategoria
    ? `${base}&sub=${encodeURIComponent(subcategoria)}`
    : base;
  return `${conSub}#catalogo`;
}
