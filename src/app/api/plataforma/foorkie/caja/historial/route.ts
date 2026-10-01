import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja, historialDeLaCaja, leerPedidoHistorial } from "@/lib/plataforma/foorkie-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/caja/historial — lo acreditado y lo
 * canjeado en la tarjeta de un local, del más nuevo al más viejo. Ver
 * `src/lib/plataforma/foorkie-caja.ts`.
 *
 *   { rancho_id, programa_id, limite?: 1..100 (30), antes?: ISO }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, movimientos: [{ id, fecha, tipo, puntos, cliente,
 *         correo, canal, detalle }], siguiente: ISO | null }
 *       Para la página siguiente se manda `antes: siguiente`, tal cual.
 *   400 datos · 401 firma · 403 no_vinculado · 500 error_base · 503 no_configurado
 *
 * Sale del ledger de ESTA tarjeta: los pedidos en línea de Foorkie, la
 * caja, el escáner y el panel de Bookea, los canjes, los ajustes y las
 * reversiones. De cada cliente, solo el nombre de pila y el correo
 * enmascarado.
 */
export async function POST(request: Request) {
  const caja = await abrirLaCaja(request, leerPedidoHistorial);
  if (!caja.ok) return caja.respuesta;

  const historial = await historialDeLaCaja(caja.db, caja.pedido);
  if (!historial) {
    return responder({ ok: false, codigo: "error_base", motivo: "No pudimos leer el historial. Probá de nuevo." }, 500);
  }
  return responder({ ok: true, movimientos: historial.movimientos, siguiente: historial.siguiente });
}
