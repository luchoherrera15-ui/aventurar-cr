import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { cuerpoDelFallo, leerPedidoPlantillaImpulso, plantillaDeFoorkie } from "@/lib/plataforma/foorkie-impulsos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/impulsos/plantilla — crea un impulso desde
 * una de las plantillas (`plantillas` de la ruta `impulsos`). Ver
 * `src/lib/plataforma/foorkie-impulsos.ts`.
 *
 *   { rancho_id, programa_id, plantilla_id: string }  firmado en `x-foorkie-firma`.
 *
 *   SIEMPRE nace BORRADOR: el negocio lee el texto, lo ajusta a su voz y
 *   recién ahí lo activa. El texto se adapta al tipo de tarjeta (un sello no
 *   es un punto).
 *
 *   200 { ok: true, id }
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   404 plantilla_no_existe
 *   409 plantilla_no_disponible   hoy no se puede cumplir; el `motivo` dice por qué
 *   409 limite                    ya tiene los 40 impulsos
 *   404 sin_tarjeta
 *   400 datos             falta la plantilla (plantilla_id)
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   503 sin_migracion (faltan las tablas de la 0254) · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 *
 * `creado_por` es el dueño del negocio.
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoPlantillaImpulso);
  if (!panel.ok) return panel.respuesta;

  const r = await plantillaDeFoorkie(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder(cuerpoDelFallo(r), r.status);

  revalidatePath(`/lealtad/panel/${panel.pedido.ranchoId}`);
  return responder({ ok: true, id: r.id });
}
