import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import {
  abrirElPanel,
  avisarCambioDeMeta,
  borrarRecompensaDeFoorkie,
  leerPedidoBorrarRecompensa,
} from "@/lib/plataforma/foorkie-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Si cambia la meta, los pases se avisan después de responder (`after`).
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/recompensas/borrar — el panel de Foorkie
 * borra una regalía de la tarjeta de un local. Ver
 * `src/lib/plataforma/foorkie-panel.ts`.
 *
 *   { rancho_id, programa_id, recompensa_id }  firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, borrada: true }    se borró
 *   200 { ok: true, borrada: false }   no estaba en esta tarjeta (ya borrada u
 *                                      otra): no se tocó nada, un reintento no es error
 *   409 ultima_recompensa   es la única activa de una tarjeta activa de sellos o puntos
 *   409 con_canjes          ya se canjeó alguna vez: no se borra, se apaga
 *   400 datos/rechazado · 401 firma · 403 no_vinculado · 500 error_base · 503
 *
 * Borra como el panel de Bookea (`eliminarRecompensa`: solo de ESTE
 * programa). Si el borrado mueve la meta que dibuja el pase, se les
 * avisa a los pases instalados.
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoBorrarRecompensa);
  if (!panel.ok) return panel.respuesta;
  const { db, pedido } = panel;

  const r = await borrarRecompensaDeFoorkie(db, pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);

  if (r.metaCambio) avisarCambioDeMeta(pedido.ranchoId, pedido.programaId);
  if (r.borrada) {
    revalidatePath(`/lealtad/panel/${pedido.ranchoId}`);
    revalidatePath(`/admin/lealtad/${pedido.ranchoId}`);
  }
  return responder({ ok: true, borrada: r.borrada });
}
