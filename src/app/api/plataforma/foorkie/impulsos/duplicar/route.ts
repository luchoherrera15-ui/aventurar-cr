import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { cuerpoDelFallo, duplicarImpulsoDeFoorkie, leerPedidoDeUnImpulso } from "@/lib/plataforma/foorkie-impulsos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/impulsos/duplicar — una copia en BORRADOR de
 * un impulso («Copia de …»), para armar una variante sin tocar el original.
 * Ver `src/lib/plataforma/foorkie-impulsos.ts`.
 *
 *   { rancho_id, programa_id, impulso_id: uuid }  firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, id }     el id de la copia
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   409 limite            ya tiene los 40 impulsos
 *   404 sin_impulso · 404 sin_tarjeta
 *   400 datos             falta el impulso (impulso_id)
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   503 sin_migracion (faltan las tablas de la 0254) · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 *
 * `creado_por` de la copia es el dueño del negocio.
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoDeUnImpulso);
  if (!panel.ok) return panel.respuesta;

  const r = await duplicarImpulsoDeFoorkie(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder(cuerpoDelFallo(r), r.status);

  revalidatePath(`/lealtad/panel/${panel.pedido.ranchoId}`);
  return responder({ ok: true, id: r.id });
}
