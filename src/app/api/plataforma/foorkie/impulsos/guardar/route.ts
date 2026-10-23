import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import {
  cuerpoDelFallo,
  guardarImpulsoDeFoorkie,
  leerPedidoGuardarImpulso,
  MAX_CUERPO_IMPULSO,
} from "@/lib/plataforma/foorkie-impulsos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/impulsos/guardar — crea un impulso (nace
 * BORRADOR) o guarda los cambios de uno existente. Ver
 * `src/lib/plataforma/foorkie-impulsos.ts`.
 *
 *   { rancho_id, programa_id,
 *     impulso_id: uuid | null,      null (o ausente) = uno nuevo
 *     impulso: { nombre, descripcion, activador, activador_config, condiciones,
 *                canal, titulo, cuerpo, retraso_minutos, horario, vigente_desde,
 *                vigente_hasta, espera_minima_horas, plantilla } }
 *   firmado en `x-foorkie-firma`. El cuerpo puede llegar a 16.000 caracteres.
 *
 *   El `impulso` llega crudo y Bookea lo RECONSTRUYE campo por campo (tipos y
 *   rangos forzados; lo que no esté en la lista no pasa: ni el estado, ni la
 *   versión, ni el negocio). Se valida con las mismas reglas del panel de
 *   Bookea, en la voz de Foorkie. Guardar un borrador a medias se puede;
 *   uno ACTIVO no puede quedar inválido. Un impulso archivado no se edita.
 *   Cambiar qué lo dispara cancela los mensajes que esperaban. Hasta 40
 *   impulsos por tarjeta (sin contar los archivados).
 *
 *   200 { ok: true, id, avisos: string[] }
 *
 *   Si no: { ok: false, codigo, motivo, problemas? } con su status —
 *   422 validacion        no pasa la validación; `problemas: [{ campo, mensaje }]`
 *   409 no_editable       archivado, o activo que con el cambio quedaría inválido
 *                         (en ese caso trae `problemas` también)
 *   409 limite            ya tiene los 40 impulsos
 *   404 sin_impulso · 404 sin_tarjeta
 *   400 datos             el cuerpo no trae lo que tiene que traer
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   503 sin_migracion (faltan las tablas de la 0254) · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 *
 * `creado_por` de lo que se crea es el dueño del negocio.
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoGuardarImpulso, MAX_CUERPO_IMPULSO);
  if (!panel.ok) return panel.respuesta;

  const r = await guardarImpulsoDeFoorkie(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder(cuerpoDelFallo(r), r.status);

  revalidatePath(`/lealtad/panel/${panel.pedido.ranchoId}`);
  return responder({ ok: true, id: r.id, avisos: r.avisos });
}
