/**
 * ¿ESTE NEGOCIO ES DE MUESTRA?
 *
 * Bookea tiene negocios sembrados por nosotros para que el directorio
 * no se vea vacío mientras entran los reales. Se publican a propósito,
 * pero SIEMPRE tienen que verse como lo que son: si un visitante hace
 * clic esperando reservar en un local que no existe, el directorio
 * entero deja de merecer confianza.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL CRITERIO ES DOBLE (y por qué antes fallaba)
 * ------------------------------------------------------------------
 * Los guiones de siembra marcan un demo de DOS maneras a la vez:
 *
 *   · `slug` que arranca con "demo-"  (seed-demo-citas.mjs, -eventos…)
 *   · `detalles.demo = true`          (todos, incluidos los de arriba)
 *
 * Pero la interfaz solo miraba el slug. Y hay demos cuyo slug NO lleva
 * el prefijo justamente porque se sembraron para verse como un negocio
 * de verdad —Café Oscuro y SILENCE BARBER SHOP, con
 * `detalles.demo = true` y `detalles.sembrado`—, así que salían en la
 * portada SIN el aviso, indistinguibles de un local real.
 *
 * `detalles.demo` es la marca autoritativa: la ponen todos los guiones.
 * El prefijo del slug se conserva en la comprobación porque es lo que
 * ya existe en la base y no cuesta nada — pero si alguna vez hay que
 * elegir uno solo, el que manda es `detalles`.
 *
 * Vive acá y no dentro de una card porque lo preguntan la card, el
 * carrusel y el home; tres copias del mismo criterio son tres formas de
 * que un demo se cuele sin etiqueta, que es exactamente lo que pasó.
 */
export function esDemo(
  slug: string | null | undefined,
  detalles?: Record<string, unknown> | null,
): boolean {
  if (detalles?.demo === true) return true;
  return !!slug?.startsWith("demo-");
}

/**
 * ¿Esta ficha es utilería del demo del marketplace (/demo-bookea)?
 *
 * El seed demo100 siembra 99 negocios con `en_marketplace = false` para
 * que no salgan en la portada — y esa es LA MISMA bandera con la que el
 * admin reconoce a un negocio de Lealtad. El 27 ago 2026 eso metió 99
 * fichas de mentira al panel de Lealtad del dueño («mezclás todos los
 * negocios del marketplace, esto no es así»), porque dos cosas
 * distintas —«no está en el directorio» y «es de Lealtad»— compartían
 * una sola marca.
 *
 * La marca que SÍ es exclusiva del lote es `detalles.lote`. Todo lo
 * que administre Lealtad debe excluir estas filas con esta función —
 * no re-derivar el criterio, que es como se llegó al enredo.
 *
 * ⚠️ Los demos VIEJOS de lealtad (Aqua Detail, Studio Aura Nails…) NO
 * caen acá a propósito: esos son el banco de pruebas de Lealtad y le
 * pertenecen a su panel.
 */
export function esUtileriaDemoMarketplace(
  detalles?: Record<string, unknown> | null,
): boolean {
  return detalles?.lote === "demo100";
}
