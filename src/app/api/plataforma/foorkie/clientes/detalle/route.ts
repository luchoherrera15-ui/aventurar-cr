import { responder } from "@/lib/plataforma/foorkie-api";
import {
  abrirElPanel,
  detalleDelCliente,
  leerPedidoDetalleCliente,
  movimientoParaFoorkie,
} from "@/lib/plataforma/foorkie-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/clientes/detalle — UN cliente de la
 * tarjeta de un local y sus movimientos, para el panel de Foorkie. Solo
 * lee, y vale para cualquier tarjeta vinculada a un local de Foorkie. Ver
 * `src/lib/plataforma/foorkie-panel.ts`.
 *
 *   { rancho_id, programa_id, miembro_id, limite?: 1..100 (50), antes?: ISO }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true,
 *         cliente: { miembro_id, nombre, correo, telefono, saldo, acumulado,
 *                    visitas, canjes, ultimo_canje, desde, ultima_actividad, estado },
 *         movimientos: [{ id, fecha, tipo, puntos, saldo, canal, detalle,
 *                         premio, monto, operador, revertido }],
 *         siguiente: ISO | null }
 *
 *       Del más nuevo al más viejo; la página siguiente se pide con
 *       `antes: siguiente`, tal cual.
 *       `tipo`: "acredito" (sumó) | "canjeo" | "ajuste" | "reverso" |
 *       "vencimiento" (los sellos que se vencieron). `puntos` con signo y
 *       `saldo` = cómo quedó después. `canal`: "pedido" | "caja" |
 *       "escaneo" | "panel" | "otro". `detalle`: lo que se compró (o el
 *       motivo de un ajuste); `premio`: el del canje; `monto`: colones de la
 *       compra si se registraron; `operador`: quién atendió, solo cuando se
 *       sabe; `revertido`: una compra o un canje que después se revirtió.
 *   400 datos · 401 firma · 403 no_vinculado · 404 no_encontrado (no es
 *   un cliente de esta tarjeta, o se dio de baja) · 500 error_base · 503 no_configurado
 *
 * Del cliente, el nombre de pila (o «Cliente»), el correo y el teléfono
 * enmascarados: nunca un contacto completo. De quien atendió, el nombre
 * de pila (o el correo enmascarado si no tiene nombre).
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoDetalleCliente);
  if (!panel.ok) return panel.respuesta;

  const r = await detalleDelCliente(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);
  return responder({
    ok: true,
    cliente: r.detalle.cliente,
    movimientos: r.detalle.movimientos.map(movimientoParaFoorkie),
    siguiente: r.detalle.siguiente,
  });
}
