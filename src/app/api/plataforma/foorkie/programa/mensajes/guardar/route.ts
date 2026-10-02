import { after } from "next/server";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirElPanel, leerPedidoGuardarMensajes } from "@/lib/plataforma/foorkie-panel";
import { guardarMensajesDeLaTarjeta } from "@/lib/plataforma/foorkie-mensajes";
import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El refresco de los pases instalados corre después de responder, por tandas.
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/programa/mensajes/guardar — el panel de
 * LEALTAD de Foorkie cambia los mensajes automáticos de la tarjeta. Ver
 * `src/lib/plataforma/foorkie-mensajes.ts`.
 *
 *   { rancho_id, programa_id,
 *     mensajes: { sumar?: { activo?, texto? }, quitar?: {…}, canjear?: {…} } }
 *   firmado en `x-foorkie-firma`.
 *
 *   Lo que no viene se queda como estaba. `texto`: de 3 a 120
 *   caracteres, en una línea (los saltos y espacios de más se juntan).
 *
 *   200 { ok: true, mensajes: { sumar, quitar, canjear } }   los tres, ya guardados
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   400 datos             un evento que no existe, un texto corto o largo…
 *   400 rechazado         la base no aceptó el cambio (el motivo dice por qué)
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   404 sin_programa · 500 error_base
 *   503 sin_migracion     falta la columna `configuracion` (migración 0251):
 *                         mientras tanto los mensajes salen con los de fábrica
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta del panel)
 *
 * Los mensajes salen solos después de cada movimiento de la tarjeta, al
 * pase de Apple y al de Google de ESE cliente (`avisarCambioDePase`).
 * Guardar no le manda un mensaje a nadie: si algo cambió, refresca EN
 * SILENCIO los pases instalados, como un cambio de diseño
 * (`avisarCambioDeDiseno`). Es para Apple: avisa cuando un campo que ya
 * estaba cambia de valor, no cuando aparece, así que el renglón «Último
 * mensaje» tiene que estar en el iPhone ANTES del primer mensaje para que
 * ese primero también suene.
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoGuardarMensajes);
  if (!panel.ok) return panel.respuesta;

  const r = await guardarMensajesDeLaTarjeta(panel.db, panel.pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);

  if (r.cambio) {
    const { programaId } = panel.pedido;
    after(() => avisarCambioDeDiseno(programaId));
  }
  return responder({ ok: true, mensajes: r.mensajes });
}
