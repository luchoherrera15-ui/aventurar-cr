import { createAdminClient } from "@/lib/supabase/admin";
import { vinculoConFoorkie } from "@/lib/plataforma/foorkie";
import { leerPedidoFirmado, programaParaFoorkie, responder, sitioDeBookea, UUID } from "@/lib/plataforma/foorkie-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/programa — la tarjeta de un local de
 * Foorkie tal como es en Bookea: tipo, beneficio, diseño, meta, si está
 * en pausa y cuántos clientes la tienen. Lo usan la ficha del local
 * (app y web) y el panel del restaurante. Ver `foorkie-api.ts`.
 *
 *   { rancho_id, programa_id }  firmado en `x-foorkie-firma`
 *
 *   200 { ok: true, programa: {...} }
 *   403 no_vinculado · 404 sin_programa · 401 firma · 400 datos · 503
 */
export async function POST(request: Request) {
  const pedido = await leerPedidoFirmado(request, 2000);
  if (!pedido.ok) return pedido.respuesta;
  const ranchoId = typeof pedido.datos.rancho_id === "string" ? pedido.datos.rancho_id : "";
  const programaId = typeof pedido.datos.programa_id === "string" ? pedido.datos.programa_id : "";
  if (!UUID.test(ranchoId) || !UUID.test(programaId)) return responder({ ok: false, codigo: "datos" }, 400);

  const db = createAdminClient();
  if (!db) return responder({ ok: false, codigo: "no_configurado" }, 503);

  const vinculo = await vinculoConFoorkie(db, ranchoId, programaId);
  if (!vinculo) return responder({ ok: false, codigo: "no_vinculado" }, 403);

  const programa = await programaParaFoorkie(db, ranchoId, programaId, sitioDeBookea(request));
  if (!programa) return responder({ ok: false, codigo: "sin_programa" }, 404);
  return responder({ ok: true, programa });
}
