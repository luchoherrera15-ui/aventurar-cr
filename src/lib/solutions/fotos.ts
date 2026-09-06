/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS FOTOS DE SOLUTIONS — de Cloudflare Images, con sus variantes
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026): «quiero que TODO lo que sean imágenes
 * y fotos se almacene y cargue desde Cloudflare».
 *
 * ── CÓMO VIAJA UNA FOTO AHORA ──────────────────────────────────────
 *   1. El panel pide un permiso de subida (`prepararSubidaSolutions`,
 *      una server action): el servidor le pide a Cloudflare un Direct
 *      Creator Upload y devuelve la URL de un solo uso.
 *   2. El navegador manda el archivo DIRECTO a esa URL. Nunca pasa por
 *      Vercel: ni cuenta contra el body del server action ni gasta CPU.
 *   3. Cloudflare responde con el id; el panel guarda la URL de entrega
 *      `https://imagedelivery.net/<hash>/<id>/gallery`.
 *   4. Al mostrarla, cada lugar pide la VARIANTE que necesita
 *      (`conVariante(url, "thumb")`): la lista del menú baja 400 px y
 *      no 1600. Eso es lo que baja el costo por restaurante que se
 *      midió el 5 sep (≈ US$1 → US$0,25 al mes): el egreso, no el
 *      almacenamiento.
 *
 * ── LAS VARIANTES SON LAS DE LA CUENTA ─────────────────────────────
 * `thumb` (400²), `card` (768×576), `gallery` (1600, conserva
 * proporción), `hero` (1920×1080). Están definidas en
 * `src/lib/media/tipos.ts`; acá solo se nombran. La canónica que se
 * guarda es `gallery` porque es la única que no recorta.
 *
 * ── LAS DE SUPABASE SIGUEN FUNCIONANDO ─────────────────────────────
 * Las fotos subidas antes al bucket `solutions-fotos` quedan donde
 * están: `conVariante` devuelve la misma URL si no es de Cloudflare.
 * No hay migración forzada; lo nuevo va a Cloudflare, lo viejo se ve.
 *
 * Módulo neutral: sin red ni secretos. La parte con token vive en
 * `src/lib/media/cloudflare-images.ts` (solo servidor).
 */

import type { Variante } from "@/lib/media/tipos";

/** El host de entrega de Cloudflare Images. Público por definición. */
const HOST_ENTREGA = "imagedelivery.net";

/** La variante que se GUARDA: no recorta, conserva la proporción real. */
export const VARIANTE_CANONICA: Variante = "gallery";

/**
 * ¿Es una URL de entrega de Cloudflare Images de NUESTRA cuenta?
 *
 * Se compara el hash de cuenta (el primer segmento) contra el que
 * viene de `CLOUDFLARE_IMAGES_DELIVERY_URL`; sin ese dato (cliente,
 * tests) se acepta cualquier hash del host — la comprobación fuerte
 * la hace el servidor al guardar.
 */
export function esUrlDeCloudflare(url: string, deliveryUrl?: string | null): boolean {
  let u: URL;
  try {
    u = new URL((url ?? "").trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.host.toLowerCase() !== HOST_ENTREGA) return false;
  const partes = u.pathname.split("/").filter(Boolean);
  if (partes.length !== 3) return false;
  const [hash, id] = partes;
  if (!/^[A-Za-z0-9_-]{6,}$/.test(hash) || !/^[A-Za-z0-9_-]{8,}$/.test(id)) return false;
  if (deliveryUrl) {
    const esperado = deliveryUrl.trim().replace(/\/+$/, "").split("/").pop();
    if (esperado && esperado !== hash) return false;
  }
  return true;
}

/**
 * La misma foto en otra variante. Una URL que no es de Cloudflare
 * vuelve tal cual: las de Supabase no tienen variantes.
 */
export function conVariante(url: string | null | undefined, variante: Variante): string | null {
  if (!url) return null;
  if (!esUrlDeCloudflare(url)) return url;
  const partes = url.split("/");
  partes[partes.length - 1] = variante;
  return partes.join("/");
}

/** La URL de entrega canónica de una imagen recién subida. */
export function urlDeEntrega(deliveryUrl: string, imageId: string): string {
  return `${deliveryUrl.trim().replace(/\/+$/, "")}/${imageId}/${VARIANTE_CANONICA}`;
}
