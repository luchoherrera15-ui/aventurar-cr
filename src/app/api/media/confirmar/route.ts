/**
 * POST /api/media/confirmar — cierra una subida.
 *
 * Verifica contra R2 que el objeto está, que pesa lo que se dijo y que
 * su FIRMA REAL corresponde al tipo declarado; recién entonces escribe
 * el sello. Si es una imagen que lleva copia visual, le pasa a
 * Cloudflare una URL firmada de vida corta para que importe exactamente
 * ese objeto.
 *
 * Acepta dos autorizaciones: la sesión de quien administra el asset, o
 * una capacidad anónima que cubra ese asset EXACTO. Un `asset_id` suelto
 * no autoriza nada.
 *
 * La lógica está en `src/lib/media/servicio.ts`.
 */

import { manejarConfirmar } from "@/lib/media/servicio";
import { metodoNoPermitido, preflight } from "@/lib/media/respuestas";

/**
 * Node, NO Edge. Acá se lee una muestra del objeto con el SDK de AWS y
 * se calculan HMAC con `node:crypto`.
 */
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Esta ruta habla con R2 (HEAD + rango) y con Cloudflare (importación),
 * en serie. Con una imagen pesada y una red lenta puede pasar de los 10
 * segundos que Vercel da por defecto a una función Node.
 *
 * 60 s es el techo del plan actual; el `maxDuration` real lo impone la
 * cuenta y este valor solo pide hasta ahí.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  return manejarConfirmar(request);
}

export async function OPTIONS(request: Request) {
  return preflight({ origen: request.headers.get("origin") });
}

const noPermitido = (request: Request) =>
  metodoNoPermitido({ origen: request.headers.get("origin") });

export const GET = noPermitido;
export const PUT = noPermitido;
export const PATCH = noPermitido;
export const DELETE = noPermitido;
