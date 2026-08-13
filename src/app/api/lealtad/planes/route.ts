import { NextResponse } from "next/server";
import { catalogoPublico } from "@/lib/lealtad/catalogo-publico";

/**
 * GET /api/lealtad/planes — el catálogo de Lealtad, público.
 *
 * Es la MISMA información que ya está impresa en la landing de
 * /lealtad: nombres, precios, topes y viñetas de los paquetes que se
 * ofrecen hoy. Nada que no se pueda leer sin sesión.
 *
 * Lo consume la app móvil (`mobile/src/lib/planes-lealtad.ts`), que es
 * otro proyecto npm y no puede importar `src/lib/lealtad/planes.ts`.
 * Antes ese catálogo estaba copiado a mano en la pantalla de la app y
 * llevaba tres precios que ya no existían.
 *
 * ------------------------------------------------------------------
 * ESTÁTICA A PROPÓSITO
 * ------------------------------------------------------------------
 * `force-static`: no hay sesión, ni base, ni nada que dependa del
 * pedido — el cuerpo sale de constantes del código. Sin esto Next 16
 * trata los route handlers como dinámicos y cada teléfono despertaría
 * una función serverless para recibir el mismo JSON de siempre.
 *
 * Y SIN `revalidate`, que acá no serviría de nada: el catálogo no sale
 * de una base que pueda cambiar sola, sale de `planes.ts`. O sea que
 * cambia cuando se despliega el sitio, y Vercel invalida su caché en
 * cada despliegue. Un precio nuevo llega a los teléfonos con un deploy
 * del sitio, sin pasar por la revisión de la App Store.
 *
 * El `Access-Control-Allow-Origin` es para que también lo pueda pedir
 * un cliente web (la app corre nativa y no hace preflight): es un
 * catálogo público, no hay nada que proteger con el origen.
 */

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(catalogoPublico(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      // 5 minutos en el teléfono, un día en el CDN, una semana
      // sirviendo el viejo mientras se refresca. El teléfono además
      // guarda su propia copia, así que este encabezado es la segunda
      // red y no la única.
      "cache-control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
