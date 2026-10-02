import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirElPanel, leerPedidoUbicaciones } from "@/lib/plataforma/foorkie-panel";
import { ubicacionesDeLaTarjeta } from "@/lib/plataforma/foorkie-ubicaciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/programa/ubicaciones — las ubicaciones del
 * aviso por cercanía (el iPhone muestra la tarjeta en la pantalla
 * bloqueada al pasar cerca) del negocio de una tarjeta de Foorkie. Ver
 * `src/lib/plataforma/foorkie-ubicaciones.ts`.
 *
 *   { rancho_id, programa_id }  firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, ubicaciones: [{ latitud, longitud, mensaje, nombre }] }
 *       en el orden en que se registraron (el que lleva el pase); vacía
 *       si el negocio no tiene ninguna. Son del NEGOCIO (0196), no de la
 *       tarjeta: todas sus tarjetas llevan las mismas.
 *   403 no_es_de_foorkie   vinculada pero sin la marca `lealtad_por_foorkie`
 *       (como Pura Matcha): no se leen
 *   503 sin_migracion (falta la 0196) · 500 error_base
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado (la puerta del panel)
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoUbicaciones);
  if (!panel.ok) return panel.respuesta;

  const r = await ubicacionesDeLaTarjeta(panel.db, panel.pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);
  return responder({ ok: true, ubicaciones: r.ubicaciones });
}
