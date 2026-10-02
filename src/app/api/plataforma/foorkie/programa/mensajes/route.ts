import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirElPanel, leerPedidoMensajes } from "@/lib/plataforma/foorkie-panel";
import { mensajesDeLaTarjeta } from "@/lib/plataforma/foorkie-mensajes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/programa/mensajes — los mensajes
 * automáticos de la tarjeta de un local de Foorkie, para el panel de
 * LEALTAD. Ver `src/lib/plataforma/foorkie-mensajes.ts`.
 *
 *   { rancho_id, programa_id }  firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, mensajes: {
 *         sumar:   { activo, texto },   al acreditar sellos, saldo o puntos
 *         quitar:  { activo, texto },   un ajuste o una reversión del negocio
 *         canjear: { activo, texto } } } al entregar un premio
 *       Mientras el restaurante no guarde nada, los de fábrica (activos):
 *       «¡Gracias por preferirnos!», «Tu tarjeta se modificó.» y
 *       «¡Gracias! Disfrutá tu premio.».
 *   403 no_es_de_foorkie   vinculada pero sin la marca `lealtad_por_foorkie`
 *       (como Pura Matcha): estos mensajes no existen para ella
 *   404 sin_programa · 500 error_base
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado (la puerta del panel)
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoMensajes);
  if (!panel.ok) return panel.respuesta;

  const r = await mensajesDeLaTarjeta(panel.db, panel.pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);
  return responder({ ok: true, mensajes: r.mensajes });
}
