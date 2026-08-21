/**
 * ═══════════════════════════════════════════════════════════════════
 *  LA LLAVE PÚBLICA DE CADA TARJETA — un link y un QR por programa
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── EL PROBLEMA QUE CIERRA ──────────────────────────────────────────
 *
 * Hasta hoy el único link público de Lealtad era `/tarjeta/<negocio>`:
 * UNO por negocio. Mientras hubo una sola tarjeta por negocio (el
 * `unique(rancho_id)` que la 0134 liberó) eso alcanzaba. Con dos, el
 * mismo link tenía que elegir cuál servir — y esa elección la hacía
 * `elegirPrograma`, que ordenaba por UUID. O sea: crear una segunda
 * tarjeta podía cambiar, sin avisar y sin que nadie tocara nada, a qué
 * tarjeta lleva el QR YA IMPRESO y pegado en el mostrador.
 *
 * Reporte textual del dueño: «al crear otra tarjeta me parece que el
 * link de la primera desaparece, y no puede ser así ya que la primera
 * estaba asociada al QR que el cliente ya tiene expuesto».
 *
 * ── LA FORMA DE LA URL, Y POR QUÉ ESTA ──────────────────────────────
 *
 *     /tarjeta/<negocio>                     ← el de siempre, INTACTO
 *     /tarjeta/<negocio>/<llave-de-tarjeta>  ← uno por tarjeta
 *
 * Anidada bajo el negocio y no en una ruta corta global (`/t/<algo>`)
 * por tres razones:
 *
 *   1. la unicidad que hay que garantizar es POR NEGOCIO, no global —
 *      dos negocios pueden llamarle «Sellos» a su tarjeta sin pisarse;
 *   2. el link se lee en un póster y dice de quién es antes de decir
 *      qué es: `bookea.lat/tarjeta/puramatcha/paint-and-matcha`;
 *   3. la ruta vieja no se toca: sigue siendo su propio archivo, con su
 *      propia resolución. Un cambio en la nueva no puede romperla.
 *
 * ── LA LLAVE FUNCIONA ANTES Y DESPUÉS DE LA MIGRACIÓN ───────────────
 *
 * `programa_lealtad.slug` la agrega la 0199, y las migraciones se
 * aplican aparte del deploy. Para que el póster impreso el lunes siga
 * sirviendo el miércoles, la llave se resuelve en TRES escalones y los
 * dos primeros dan EXACTAMENTE el mismo texto:
 *
 *   1. la columna `slug`, si existe y tiene valor (lo que manda);
 *   2. el slug DERIVADO del nombre — el mismo algoritmo con el que la
 *      0199 rellena la columna, así que la URL no cambia al aplicarla;
 *   3. el `id` del programa, que existe siempre y no se puede escribir
 *      mal — la salida de emergencia.
 *
 * Al RESOLVER se aceptan los tres. Al MOSTRAR se ofrece el primero que
 * haya. Un link impreso con el slug derivado sigue resolviendo después
 * de la migración (escalón 1 = escalón 2), y un link con el id sigue
 * resolviendo siempre.
 *
 * Todo es puro: se prueba sin base, que es donde vive el riesgo real
 * (la estabilidad del texto, no el `select`).
 */

/** Lo más largo que puede salir de un nombre. Un póster no lee más. */
const LARGO_LLAVE = 48;

/**
 * De «Paint and Matcha ☕» a «paint-and-matcha».
 *
 * Sin acentos (NFD + quitar diacríticos) porque un `%C3%A9` en un
 * póster es ilegible y se teclea mal; sin nada que no sea `a-z0-9-`
 * porque la URL viaja escrita a mano desde un papel.
 *
 * Devuelve `""` cuando del nombre no queda nada utilizable (un nombre
 * de puros emojis, por ejemplo). Quien llama decide qué hacer con eso
 * — acá no se inventa un texto que después nadie podría reproducir.
 */
export function slugDeNombreDeTarjeta(nombre: string | null | undefined): string {
  return (nombre ?? "")
    // NFD parte «é» en «e» + tilde suelta, y la propiedad Unicode
    // `\p{M}` (marcas combinantes) se lleva la tilde. Con la propiedad
    // y no con el rango U+0300–U+036F escrito literal: ese rango son
    // caracteres INVISIBLES dentro del código fuente, imposibles de
    // revisar en un diff y fáciles de romper con un copiar y pegar.
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LARGO_LLAVE)
    .replace(/-+$/g, "");
}

/** Lo mínimo que hace falta de una tarjeta para poder darle un link. */
export type TarjetaConLlave = {
  id: string;
  nombre?: string | null;
  /** La columna de la 0199. `undefined` = la migración no está pegada. */
  slug?: string | null;
};

/** Una fila cruda (`select *`) leída como `TarjetaConLlave`. */
export function tarjetaConLlaveDeFila(fila: Record<string, unknown>): TarjetaConLlave {
  return {
    id: typeof fila.id === "string" ? fila.id : "",
    nombre: typeof fila.nombre === "string" ? fila.nombre : null,
    slug: typeof fila.slug === "string" ? fila.slug : null,
  };
}

/**
 * La llave que se PUBLICA: la que va en el link del panel y en el QR
 * del póster.
 *
 * Escalones 1 → 2 → 3 de la cabecera. Nunca vacía: el id siempre está.
 */
export function llaveDeTarjeta(tarjeta: TarjetaConLlave): string {
  const guardada = (tarjeta.slug ?? "").trim();
  if (guardada !== "") return guardada;

  const derivada = slugDeNombreDeTarjeta(tarjeta.nombre);
  if (derivada !== "") return derivada;

  return tarjeta.id;
}

/**
 * ¿Este texto de la URL apunta a esta tarjeta?
 *
 * Se aceptan los TRES: el slug guardado, el derivado del nombre y el
 * id. Un póster impreso antes de la 0199 —o antes de que el dueño le
 * cambiara el nombre a la tarjeta, si la columna todavía no está—
 * tiene que seguir llevando a algún lado.
 *
 * La comparación es en minúsculas y sin espacios: quien teclea la URL
 * desde un papel escribe a veces con mayúscula al inicio.
 */
export function llaveApuntaA(tarjeta: TarjetaConLlave, pedida: string): boolean {
  const buscada = pedida.trim().toLowerCase();
  if (buscada === "") return false;

  if ((tarjeta.slug ?? "").trim().toLowerCase() === buscada) return true;
  if (tarjeta.id.toLowerCase() === buscada) return true;

  const derivada = slugDeNombreDeTarjeta(tarjeta.nombre);
  return derivada !== "" && derivada === buscada;
}

/**
 * La tarjeta del negocio a la que apunta esta llave, o null.
 *
 * El orden de la lista lo decide quien llama (en la práctica llega ya
 * ordenada por antigüedad, ver `programa-principal.ts`): si dos
 * tarjetas derivan el mismo slug —posible solo mientras la 0199 no
 * esté pegada, porque su índice único lo impide después— gana la MÁS
 * VIEJA. Es el mismo criterio que protege al QR impreso: ante un
 * empate, nunca gana la recién creada.
 */
export function buscarPorLlave<T extends Record<string, unknown>>(
  filas: readonly T[],
  pedida: string,
): T | null {
  for (const fila of filas) {
    if (llaveApuntaA(tarjetaConLlaveDeFila(fila), pedida)) return fila;
  }
  return null;
}
