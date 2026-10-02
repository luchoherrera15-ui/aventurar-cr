import { responder } from "@/lib/plataforma/foorkie-api";
import { leerVinculo } from "@/lib/plataforma/foorkie-caja";
import { abrirElPanel, recompensasDeLaTarjeta } from "@/lib/plataforma/foorkie-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/recompensas — las regalías de la tarjeta
 * de un local, activas y apagadas. Ver `src/lib/plataforma/foorkie-panel.ts`.
 *
 *   { rancho_id, programa_id }  firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, recompensas: [{ id, nombre, descripcion, costo, activo, tipo, valor }] }
 *       De la más barata a la más cara: la primera ACTIVA es la meta de
 *       la tarjeta (la que dibuja el pase). `tipo`: "producto" |
 *       "servicio" | "descuento_porcentaje" | "descuento_fijo" |
 *       "personalizada" | null; `valor` solo en los descuentos.
 *   400 datos · 401 firma · 403 no_vinculado · 500 error_base · 503 no_configurado
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerVinculo);
  if (!panel.ok) return panel.respuesta;

  const recompensas = await recompensasDeLaTarjeta(panel.db, panel.pedido.programaId);
  if (!recompensas) {
    return responder({ ok: false, codigo: "error_base", motivo: "No pudimos leer las recompensas. Probá de nuevo." }, 500);
  }
  return responder({ ok: true, recompensas });
}
