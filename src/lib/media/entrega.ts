import type { Variante } from "./tipos";

/**
 * LA URL DE ENTREGA DE UNA IMAGEN RECIÉN SUBIDA A CLOUDFLARE IMAGES.
 *
 * Cuando el navegador sube un archivo con un permiso de subida directa
 * (Direct Creator Upload), lo que se guarda es la URL de entrega:
 * `https://imagedelivery.net/<hash>/<id>/<variante>`.
 *
 * La variante que se GUARDA es `gallery` (1600, conserva la proporción):
 * es la única de las cuatro que no recorta. Las variantes están
 * definidas en `tipos.ts`; acá solo se nombra la canónica.
 *
 * Módulo neutral: sin red ni secretos. La base de entrega llega por
 * parámetro (sale de `configuracionCF()` en el servidor).
 */

/** La variante que se guarda: no recorta, conserva la proporción real. */
export const VARIANTE_CANONICA: Variante = "gallery";

/** La URL de entrega canónica de una imagen recién subida. */
export function urlDeEntrega(deliveryUrl: string, imageId: string): string {
  return `${deliveryUrl.trim().replace(/\/+$/, "")}/${imageId}/${VARIANTE_CANONICA}`;
}
