/**
 * POST /api/media/sesion — reserva una subida y devuelve una URL
 * prefirmada de R2, para quien TIENE cuenta.
 *
 * Toda la lógica está en `src/lib/media/servicio.ts`, que recibe sus
 * dependencias por parámetro y se prueba sin red. Acá solo queda el
 * pegamento del framework.
 */

import { manejarSesion } from "@/lib/media/servicio";
import { metodoNoPermitido, preflight } from "@/lib/media/respuestas";

/**
 * Node, NO Edge.
 *
 * No es una preferencia: `firma-archivo.ts` y `r2.ts` usan el SDK de
 * AWS, `node:crypto` y streams de Node. En el runtime Edge nada de eso
 * existe.
 */
export const runtime = "nodejs";

/**
 * Sin caché de ninguna clase. La respuesta trae una URL de ESCRITURA
 * firmada: cachearla, aunque fuera un segundo, sería servirle a alguien
 * la llave de subida de otro.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return manejarSesion(request);
}

export async function OPTIONS(request: Request) {
  return preflight({ origen: request.headers.get("origin") });
}

// Se declaran explícitamente para que un GET reciba el mismo JSON de
// error que el resto y se pueda probar, en vez de la respuesta que
// improvise el framework.
const noPermitido = (request: Request) =>
  metodoNoPermitido({ origen: request.headers.get("origin") });

export const GET = noPermitido;
export const PUT = noPermitido;
export const PATCH = noPermitido;
export const DELETE = noPermitido;
