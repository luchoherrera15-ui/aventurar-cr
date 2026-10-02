import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import {
  abrirElPanel,
  avisarCambioDeMeta,
  guardarRecompensaDeFoorkie,
  leerPedidoGuardarRecompensa,
} from "@/lib/plataforma/foorkie-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Si cambia la meta, los pases se avisan después de responder (`after`).
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/recompensas/guardar — el panel de Foorkie
 * crea o edita una regalía de la tarjeta de un local. Ver
 * `src/lib/plataforma/foorkie-panel.ts`.
 *
 *   { rancho_id, programa_id, recompensa_id?: uuid (si viene, edita),
 *     nombre, descripcion?, costo: entero ≥ 1, activo: boolean,
 *     tipo?: "producto" | "servicio" | "descuento_porcentaje" | "descuento_fijo" | "personalizada" | null,
 *     valor?: número (el % o los colones de un descuento) | null }
 *   firmado en `x-foorkie-firma`.
 *
 *   Al editar, lo que no viene se conserva (y el stock, el tope por
 *   cliente, el SKU y las instrucciones, que no se editan desde Foorkie,
 *   siempre). Al crear, lo que no viene queda vacío.
 *
 *   200 { ok: true, recompensa: { id, nombre, descripcion, costo, activo, tipo, valor } }
 *   400 datos (las reglas de `guardarRecompensa`) · 400 rechazado (la base dijo que no)
 *   404 recompensa_ajena · 409 ultima_recompensa (apagar la única activa
 *   de una tarjeta activa de sellos o puntos) · 401 firma · 403 no_vinculado · 500 · 503
 *
 * Valida y escribe con el mismo código que el panel de Bookea
 * (`validarRecompensa` + `escribirRecompensa`). Si el cambio mueve la
 * meta que dibuja el pase, se les avisa a los pases instalados igual que
 * cuando Bookea edita la tarjeta (Apple y la clase de Google).
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoGuardarRecompensa);
  if (!panel.ok) return panel.respuesta;
  const { db, pedido } = panel;

  const r = await guardarRecompensaDeFoorkie(db, pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);

  if (r.metaCambio) avisarCambioDeMeta(pedido.ranchoId, pedido.programaId);
  revalidatePath(`/lealtad/panel/${pedido.ranchoId}`);
  revalidatePath(`/admin/lealtad/${pedido.ranchoId}`);
  return responder({ ok: true, recompensa: r.recompensa });
}
