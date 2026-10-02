import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { guardarReglasDeLaTarjeta, leerPedidoGuardarReglas } from "@/lib/plataforma/foorkie-reglas";
import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El refresco de los pases instalados corre después de responder, por tandas.
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/programa/reglas/guardar — el panel de
 * Foorkie cambia las reglas de la tarjeta de un local suyo. Ver
 * `src/lib/plataforma/foorkie-reglas.ts`.
 *
 *   { rancho_id, programa_id,
 *     reglas: { cashback?:    { compraMinima?, topePorCompra?, minimoCanje? },
 *               sellos?:      { inicial?, repetible?, sellosPor?, montoPorSello? },
 *               vencimiento?: { meses: 1..60 | null } } }
 *   firmado en `x-foorkie-firma`.
 *
 *   Lo que no viene se queda como estaba. Montos en colones enteros (null
 *   = sin mínimo / sin tope); el tope por compra va de ₡1 a ₡100.000 (el
 *   CHECK de la base); los sellos de regalo, menos que la meta; el monto
 *   por sello, de ₡100 a ₡10.000.000. En una tarjeta de cashback guardar
 *   deja el canje libre prendido (siempre, en las de Foorkie).
 *
 *   200 { ok: true, cambio, reglas }   las reglas ya guardadas (la forma de `programa/reglas`)
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   400 datos             una regla fuera de rango, o que no le aplica a esta tarjeta
 *   400 rechazado         la base no aceptó el cambio (el motivo dice por qué)
 *   403 no_es_de_foorkie  vinculada pero sin la marca `lealtad_por_foorkie`
 *   404 sin_programa · 409 no_editable (archivada) · 409 tipo_sin_reglas
 *   503 sin_migracion (falta la 0180) · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 *
 * Si algo cambió, DESPUÉS de responder refresca EN SILENCIO los pases
 * instalados (`avisarCambioDeDiseno`, Apple y Google): el reverso dice
 * hasta cuándo vence el saldo, el frente el mínimo para usarlo, y el
 * cambio les llega sin esperar al próximo movimiento.
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoGuardarReglas);
  if (!panel.ok) return panel.respuesta;

  const r = await guardarReglasDeLaTarjeta(panel.db, panel.pedido);
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);

  if (r.cambio) {
    const { programaId, ranchoId } = panel.pedido;
    after(() => avisarCambioDeDiseno(programaId));
    revalidatePath(`/lealtad/panel/${ranchoId}`);
  }
  return responder({ ok: true, cambio: r.cambio, reglas: r.reglas });
}
