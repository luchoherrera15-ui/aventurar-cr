import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { cuerpoDelFallo, historialDeLaTarjeta, leerPedidoHistorialImpulsos } from "@/lib/plataforma/foorkie-impulsos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/impulsos/historial — los mensajes de los
 * impulsos de la tarjeta (qué salió, a quién, cuándo y qué pasó), de a 25,
 * del más nuevo al más viejo. Ver `src/lib/plataforma/foorkie-impulsos.ts`.
 *
 *   { rancho_id, programa_id,
 *     estado?: "todos" | "programada" | "pendiente" | "procesando" | "enviada" |
 *              "entregada" | "omitida" | "fallida" | "cancelada",
 *     impulso_id?: uuid | null,     solo los de ese impulso
 *     pagina?: number }             desde 0
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, filas: FilaHistorial[], total, pagina, porPagina: 25 }
 *       FilaHistorial = { id, impulsoId, impulsoNombre, cliente (nombre de pila),
 *         canal, estado, ejecutarEn, enviadaEn, intentos, motivo (el código),
 *         motivoTexto (listo para mostrar, en la voz de Foorkie), detalle,
 *         titulo, cuerpo, reintentable, reintentoConRiesgo }
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   400 datos             un filtro mal armado
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   404 sin_tarjeta · 503 sin_migracion · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 *
 * Solo lee.
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoHistorialImpulsos);
  if (!panel.ok) return panel.respuesta;

  const r = await historialDeLaTarjeta(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder(cuerpoDelFallo(r), r.status);
  return responder({ ok: true, filas: r.filas, total: r.total, pagina: r.pagina, porPagina: r.porPagina });
}
