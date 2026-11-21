import { responder } from "@/lib/plataforma/foorkie-api";
import { ajustarSaldoCore, leerPedidoAjustar, referenciaDelAjuste } from "@/lib/plataforma/foorkie-ajuste";
import { abrirLaCaja, codigoDeRechazo } from "@/lib/plataforma/foorkie-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/clientes/ajustar — el dueño modifica a mano
 * el saldo de un cliente desde su ficha en el panel de Foorkie (dar o
 * quitar puntos, sellos o cashback; p. ej. «le entregaron más por error»).
 * Ver `src/lib/plataforma/foorkie-ajuste.ts` y la migración 0258.
 *
 *   { rancho_id, programa_id, miembro_id,
 *     puntos: en la moneda de la tarjeta, CON SIGNO (+ da, − quita; ≠ 0),
 *     motivo: 3 a 90 letras (obligatorio: queda en el historial),
 *     intento_id: uuid (uno por operación),
 *     operador?: quién lo hizo en Foorkie (≤ 80) }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, puntos, saldo, ya_estaba }
 *       `puntos` = lo que se movió (con signo) y `saldo` = cómo quedó, los dos
 *       en la moneda de la tarjeta. `ya_estaba: true` = ese intento ya se
 *       había aplicado: NO se movió nada de nuevo.
 *   200 { ok: false, codigo, motivo[, saldo] }   el motor dijo que no
 *       (`saldo_insuficiente` si quedaría bajo cero, `cantidad_invalida`,
 *       `miembro_ajeno`, `membresia_inactiva`…)
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado
 *
 * El movimiento queda en el historial como «Ajuste» (canal «Panel») con el
 * motivo y, entre paréntesis, quién fue. No cuenta como visita ni como lo
 * ganado, y el cliente recibe «Tu tarjeta se modificó» en su Wallet si el
 * negocio tiene ese mensaje activo.
 */
export async function POST(request: Request) {
  const puerta = await abrirLaCaja(request, leerPedidoAjustar);
  if (!puerta.ok) return puerta.respuesta;
  const { db, pedido } = puerta;

  const r = await ajustarSaldoCore({
    db,
    programaId: pedido.programaId,
    miembroId: pedido.miembroId,
    puntos: pedido.puntos,
    motivo: pedido.motivo,
    referencia: referenciaDelAjuste(pedido.miembroId, pedido.intentoId),
    operador: pedido.operador,
  });

  if (!r.ok) {
    return responder({ ok: false, codigo: codigoDeRechazo(r.codigo), motivo: r.motivo, ...(r.saldo !== undefined ? { saldo: r.saldo } : {}) });
  }
  return responder({ ok: true, puntos: r.puntos, saldo: r.saldo, ya_estaba: r.yaEstaba });
}
