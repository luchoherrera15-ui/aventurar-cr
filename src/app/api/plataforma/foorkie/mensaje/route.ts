import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirElPanel, leerPedidoMensaje, mandarMensajeDeFoorkie } from "@/lib/plataforma/foorkie-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Apple y Google se avisan por tandas, con pausas entre ellas: puede tardar.
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/mensaje — el aviso que le llega al Wallet
 * a todos los clientes de la tarjeta de un local («MIÉRCOLES MATCHAS
 * 2X1»). Ver `src/lib/plataforma/foorkie-panel.ts`.
 *
 *   { rancho_id, programa_id, texto (3 a 120 caracteres, una línea), intento_id: uuid }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, enviados, ya_estaba: false }   salió: `enviados` = pases
 *       que reciben el aviso (Apple de la tarjeta + Google que lo aceptó)
 *   200 { ok: true, enviados: 0, ya_estaba: true }  ese intento YA se había
 *       mandado (un reintento): no salió nada de nuevo
 *   409 sin_cupo      el paquete ya usó sus avisos de este mes
 *   500 no_enviado    no salió (se puede reintentar con el MISMO intento_id)
 *   400 datos · 401 firma · 403 no_vinculado · 500 error_base · 503 no_configurado
 *
 * ESTE ARCHIVO NO DECIDE NADA: el cupo del paquete, el envío a Apple y a
 * Google y la liberación del cupo si falla son el núcleo del botón
 * «Enviar a todos» de Bookea y de sus campañas automáticas. El
 * `intento_id` lo genera Foorkie UNA vez por aviso y lo repite en los
 * reintentos. Sin datos de personas en la respuesta.
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoMensaje);
  if (!panel.ok) return panel.respuesta;

  const r = await mandarMensajeDeFoorkie(panel.db, panel.pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);
  return responder({ ok: true, enviados: r.enviados, ya_estaba: r.yaEstaba });
}
