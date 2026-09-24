/**
 * ════════════════════════════════════════════════════════════════════
 *  EL HOME TIENE DOS MODOS Y UNA SOLA RUTA
 * ════════════════════════════════════════════════════════════════════
 *
 *   `/` sin parámetros de búsqueda  → MODO PLATAFORMA
 *                                     qué es Bookea, para el dueño
 *                                     de un negocio que todavía no
 *                                     lo conoce.
 *
 *   `/` con parámetros de búsqueda  → MODO DESCUBRIR
 *                                     el buscador y el catálogo, tal
 *                                     como funcionó siempre.
 *
 * ── POR QUÉ UNA RUTA Y NO DOS ───────────────────────────────────────
 *
 * Porque `/` ya no es solo una portada: es LA PÁGINA DE RESULTADOS del
 * sitio. Cuando se borraron los directorios `/citas` y `/eventos`, sus
 * 301 quedaron apuntando acá **con el query intacto** (ver
 * `next.config.ts`), y ahí siguen cayendo links compartidos por
 * WhatsApp, favoritos del navegador y resultados de Google todavía
 * indexados. El buscador del héroe tampoco manda a otro lado: escribe
 * los parámetros y vuelve acá mismo.
 *
 * Mandar esa gente a una landing de producto sería contestarle «mirá
 * qué linda plataforma» a alguien que preguntó «¿dónde hay una
 * barbería en Heredia?». Por eso el modo se decide por la URL y no por
 * una ruta nueva: no hay redirect que reescribir ni link que se rompa.
 *
 * ── LA REGLA: LA PRESENCIA MANDA, NO EL VALOR ───────────────────────
 *
 * Alcanza con que el parámetro ESTÉ para que sea una búsqueda, aunque
 * venga vacío. Un `?q=` sin texto hoy muestra el catálogo entero, y
 * tiene que seguir mostrándolo: quien llega con ese link espera
 * resultados, no una presentación. Es también lo que menos cambia —
 * cualquier URL que hoy renderiza el catálogo lo va a seguir
 * renderizando.
 *
 * ── LOS OCHO PARÁMETROS ─────────────────────────────────────────────
 *
 * No son cinco. `urlBusqueda()` (buscador-home-datos.ts) emite además
 * `categoria`, `subcategoria` y `pais`, y aunque la portada hoy no los
 * lea, quien llega con ellos venía buscando. Se incluyen para que el
 * modo nunca contradiga la intención de quien escribió la URL.
 *
 * Módulo PURO a propósito: sin "use client", sin Supabase y sin
 * `next/navigation`. Es la costura del home y tiene que poder probarse
 * sin levantar nada (ver home-modo.test.ts).
 */

export type ModoHome = "plataforma" | "descubrir";

/** Todo lo que, presente en la URL, significa «vengo a buscar». */
export const PARAMS_BUSQUEDA = [
  // Los que la portada lee hoy.
  "q",
  "lugar",
  "provincia",
  "rubro",
  "sub",
  // Los que el buscador emite y la portada todavía no usa.
  "categoria",
  "subcategoria",
  "pais",
] as const;

export type ParamsHome = { [clave: string]: string | string[] | undefined };

/**
 * ¿Esta URL trae intención de búsqueda?
 *
 * Un parámetro presente cuenta aunque su valor sea `""`: ver «la
 * presencia manda» arriba.
 */
export function hayBusqueda(params: ParamsHome): boolean {
  return PARAMS_BUSQUEDA.some((clave) => params[clave] !== undefined);
}

/**
 * Qué modo le toca a esta petición.
 *
 * Dos banderas lo fuerzan a Descubrir, por motivos distintos:
 *
 * · `demo` — `/demo-bookea` existe para enseñar el catálogo lleno de
 *   negocios de muestra; en modo Plataforma dejaría de mostrar lo
 *   único que la hace existir.
 *
 * · `forzarDescubrir` — `/all` es la dirección FIJA del marketplace
 *   (dueño, 24 sep 2026). Sin esto, entrar a `/all` sin filtros caería
 *   en la landing de producto, que es exactamente lo contrario de lo
 *   que esa dirección promete.
 *
 * `demo` implica `forzarDescubrir`: una demostración del catálogo que
 * no muestre el catálogo no es una demostración.
 */
export function modoHome(
  params: ParamsHome,
  opciones?: { demo?: boolean; forzarDescubrir?: boolean },
): ModoHome {
  if (opciones?.demo || opciones?.forzarDescubrir) return "descubrir";
  return hayBusqueda(params) ? "descubrir" : "plataforma";
}
