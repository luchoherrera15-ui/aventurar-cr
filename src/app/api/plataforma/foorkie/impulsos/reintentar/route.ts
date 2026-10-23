import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { cuerpoDelFallo, leerPedidoReintentarImpulso, reintentarDeFoorkie } from "@/lib/plataforma/foorkie-impulsos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/impulsos/reintentar — vuelve a la cola un
 * mensaje que falló. Ver `src/lib/plataforma/foorkie-impulsos.ts`.
 *
 *   { rancho_id, programa_id, tarea_id: uuid, confirmar_riesgo?: boolean }
 *   firmado en `x-foorkie-firma`.
 *
 *   El mensaje vuelve como si fuera nuevo: el motor revalida todo antes de
 *   mandarlo (consentimiento, vigencia, condiciones, tope diario). Solo se
 *   reintentan los que FALLARON y cuyo impulso sigue ACTIVO. Si el envío
 *   quedó con resultado incierto (no se sabe si salió), hace falta
 *   `confirmar_riesgo: true`: el cliente podría recibirlo dos veces
 *   (`reintentoConRiesgo` en el historial lo avisa). Dos pedidos seguidos no
 *   lo encolan dos veces.
 *
 *   200 { ok: true }
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   409 riesgo_de_duplicado    resultado incierto y no vino `confirmar_riesgo`
 *   409 tarea_no_reintentable  no existe en esta tarjeta, no falló, ya cambió
 *                              de estado, o su impulso no está activo
 *   404 sin_tarjeta
 *   400 datos             falta el mensaje (tarea_id) o `confirmar_riesgo` no es booleano
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   503 sin_migracion (faltan las tablas de la 0254) · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoReintentarImpulso);
  if (!panel.ok) return panel.respuesta;

  const r = await reintentarDeFoorkie(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder(cuerpoDelFallo(r), r.status);

  revalidatePath(`/lealtad/panel/${panel.pedido.ranchoId}`);
  return responder({ ok: true });
}
