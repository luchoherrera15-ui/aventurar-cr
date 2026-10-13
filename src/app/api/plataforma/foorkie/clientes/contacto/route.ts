import { responder } from "@/lib/plataforma/foorkie-api";
import { contactosDeLaTarjeta, leerPedidoContacto } from "@/lib/plataforma/foorkie-contacto";
import { abrirElPanel } from "@/lib/plataforma/foorkie-panel";

/** 200 uuid en un JSON son ~8 KB: más que los 4000 de la puerta de siempre. */
const MAX_CUERPO = 12_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hasta 200 clientes por llamada: sus identidades y sus consentimientos se leen de a cien.
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/clientes/contacto — el contacto COMPLETO
 * (nombre, correo y teléfono) de los clientes de la tarjeta de un local
 * de Foorkie que aceptaron que el negocio los contacte. Ver
 * `src/lib/plataforma/foorkie-contacto.ts`. Solo lee.
 *
 *   { rancho_id, programa_id, miembro_ids: uuid[] (1..200) }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, contactos: [{ miembro_id, nombre, correo, telefono,
 *         acepta: { correo, whatsapp } }] }
 *
 *       Un contacto por cliente de ESTA tarjeta, en el orden del pedido
 *       (un `miembro_id` de otra tarjeta, dado de baja o inexistente no
 *       sale, igual que si no existiera).
 *       `acepta` dice por qué canal aceptó que el negocio le escriba
 *       (la última fila de `consentimientos_persona`, como `persona_acepta`).
 *       El `correo` sale SOLO si aceptó el canal de correo; el
 *       `telefono` (solo dígitos), SOLO si aceptó el de WhatsApp; el
 *       `nombre` completo, si aceptó alguno. Lo demás va en `null`: de
 *       quien revocó, de quien nunca aceptó y de las membresías sin
 *       persona no sale un solo dato.
 *   400 datos · 401 firma · 403 no_vinculado | no_es_de_foorkie
 *   404 sin_programa · 500 error_base · 503 no_configurado
 *
 * Solo las tarjetas que un local de Foorkie tiene vinculadas Y marcadas
 * `lealtad_por_foorkie`. Los lectores de siempre (`clientes`,
 * `clientes/detalle`) siguen entregando solo lo enmascarado.
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoContacto, MAX_CUERPO);
  if (!panel.ok) return panel.respuesta;

  const r = await contactosDeLaTarjeta(panel.db, panel.pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);
  return responder({ ok: true, contactos: r.contactos });
}
