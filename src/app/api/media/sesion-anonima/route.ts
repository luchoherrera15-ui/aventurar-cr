/**
 * POST /api/media/sesion-anonima — la misma reserva, para quien NO tiene
 * cuenta: el invitado que sube fotos al álbum de una boda y quien
 * adjunta el comprobante de un SINPE.
 *
 * Dos esquemas cerrados (`tipo: "album"` y `tipo: "comprobante"`), sin
 * ningún `entity_type` libre. La entidad, la visibilidad y la clave las
 * decide el servidor; el cliente no elige nada de eso.
 *
 * La lógica está en `src/lib/media/servicio.ts`.
 */

import { manejarSesionAnonima } from "@/lib/media/servicio";
import { metodoNoPermitido, preflight } from "@/lib/media/respuestas";

/** Node, NO Edge: el SDK de AWS y `node:crypto` no existen en Edge. */
export const runtime = "nodejs";

/** La respuesta trae una URL de escritura firmada. Nunca se cachea. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return manejarSesionAnonima(request);
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
