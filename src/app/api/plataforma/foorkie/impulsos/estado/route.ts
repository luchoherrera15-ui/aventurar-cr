import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { cambiarEstadoDeFoorkie, cuerpoDelFallo, leerPedidoEstadoImpulso } from "@/lib/plataforma/foorkie-impulsos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/impulsos/estado — activar, pausar, archivar
 * o devolver a borrador un impulso. Ver
 * `src/lib/plataforma/foorkie-impulsos.ts`.
 *
 *   { rancho_id, programa_id, impulso_id: uuid,
 *     estado: "activo" | "pausado" | "archivado" | "borrador" }
 *   firmado en `x-foorkie-firma`.
 *
 *   ACTIVAR vuelve a validar TODO (un borrador puede estar a medias; uno
 *   activo sale a clientes de verdad) y sella `activado_en`: el impulso solo
 *   toma lo que pase DESPUÉS de ese momento. Pausar, archivar o volver a
 *   borrador cancelan lo que todavía no salió. Un impulso archivado solo
 *   puede volver a borrador. Pedir el estado que ya tiene no hace nada.
 *
 *   200 { ok: true, estado, avisos: string[] }
 *
 *   Si no: { ok: false, codigo, motivo, problemas? } con su status —
 *   422 validacion        no se puede activar; `problemas: [{ campo, mensaje }]`
 *   409 estado_invalido   el cambio no está permitido (archivado → activo / pausado)
 *   404 sin_impulso · 404 sin_tarjeta
 *   400 datos             falta el impulso o el estado no es uno de los cuatro
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   503 sin_migracion (faltan las tablas de la 0254) · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoEstadoImpulso);
  if (!panel.ok) return panel.respuesta;

  const r = await cambiarEstadoDeFoorkie(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder(cuerpoDelFallo(r), r.status);

  revalidatePath(`/lealtad/panel/${panel.pedido.ranchoId}`);
  return responder({ ok: true, estado: r.estado, avisos: r.avisos });
}
