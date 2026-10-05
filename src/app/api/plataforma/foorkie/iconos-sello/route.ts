import { catalogoDeIconos, leerPedidoFirmado, responder } from "@/lib/plataforma/foorkie-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/iconos-sello — los doce dibujos que puede
 * llevar un sello (`iconos-sello.ts`), para el selector del editor de
 * tarjetas de Foorkie. Solo lectura. Ver `foorkie-api.ts`.
 *
 *   {}  firmado en `x-foorkie-firma` (como las demás rutas de la puerta)
 *
 *   200 { ok: true, viewBox: "0 0 24 24", trazo: { grosor, puntas, uniones },
 *         iconos: [{ id, nombre, trazos: string[], viewBox }] }
 *   401 firma · 400 json · 503
 *
 * Se sirve desde acá y no se copia en Foorkie: el día que se redibuja un
 * ícono (pasó en ago 2026), el selector de Foorkie y el pase cambian
 * juntos. Los ids son los que acepta `iconoSello` en `negocio` y
 * `programa/guardar`; además de ellos están null (el logo) y "propio".
 */
export async function POST(request: Request) {
  const pedido = await leerPedidoFirmado(request, 500);
  if (!pedido.ok) return pedido.respuesta;
  return responder({ ok: true, ...catalogoDeIconos() });
}
