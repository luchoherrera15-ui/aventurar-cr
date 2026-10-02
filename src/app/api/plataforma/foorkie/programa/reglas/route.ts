import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { leerPedidoReglas, reglasDeLaTarjeta } from "@/lib/plataforma/foorkie-reglas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/programa/reglas — las reglas de la tarjeta
 * de un local de Foorkie, como el motor las aplica hoy, para la sección
 * «Reglas de la tarjeta» de su panel. Ver
 * `src/lib/plataforma/foorkie-reglas.ts`.
 *
 *   { rancho_id, programa_id }  firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, reglas: {
 *         tipo: "cashback" | "sellos" | "puntos",
 *         cashback: { porcentaje, compraMinima, topePorCompra, minimoCanje, canjeLibre } | null,
 *         sellos:   { requeridos, inicial, repetible, sellosPor: "compra" | "monto", montoPorSello } | null,
 *         vencimiento: { meses: 1..60 | null, desde: ISO | null, diasDeAviso: 14 } } }
 *       Montos en colones enteros; null = sin mínimo / sin tope / nunca.
 *   403 no_es_de_foorkie   vinculada pero sin la marca `lealtad_por_foorkie`
 *   404 sin_programa · 409 tipo_sin_reglas (gift card, cupón…) · 500 error_base
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 *
 * Solo lee.
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoReglas);
  if (!panel.ok) return panel.respuesta;

  const r = await reglasDeLaTarjeta(panel.db, panel.pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);
  return responder({ ok: true, reglas: r.reglas });
}
