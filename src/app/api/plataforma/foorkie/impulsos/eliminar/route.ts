import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { cuerpoDelFallo, eliminarImpulsoDeFoorkie, leerPedidoDeUnImpulso } from "@/lib/plataforma/foorkie-impulsos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/impulsos/eliminar — elimina un impulso, con
 * protección. Ver `src/lib/plataforma/foorkie-impulsos.ts`.
 *
 *   { rancho_id, programa_id, impulso_id: uuid }  firmado en `x-foorkie-firma`.
 *
 *   Primero frena todo lo que esperaba salir. Un impulso que ya mandó (o
 *   intentó mandar) mensajes NO se borra: se ARCHIVA, porque el historial de
 *   lo que salió a clientes de verdad tiene que quedar. Uno que nunca salió
 *   se borra del todo.
 *
 *   200 { ok: true, resultado: "eliminado" | "archivado" }
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   404 sin_impulso · 404 sin_tarjeta
 *   400 datos             falta el impulso (impulso_id)
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   503 sin_migracion (faltan las tablas de la 0254) · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoDeUnImpulso);
  if (!panel.ok) return panel.respuesta;

  const r = await eliminarImpulsoDeFoorkie(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder(cuerpoDelFallo(r), r.status);

  revalidatePath(`/lealtad/panel/${panel.pedido.ranchoId}`);
  return responder({ ok: true, resultado: r.resultado });
}
