import { NextResponse } from "next/server";
import { acreditarPorMiembroCore } from "@/lib/lealtad/operar-core";
import { firmaValida, miembroPorCorreo, vinculoConFoorkie } from "@/lib/plataforma/foorkie";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/acreditar — un pedido de Foorkie ENTREGADO
 * suma en la tarjeta de lealtad del cliente (ver src/lib/plataforma/foorkie.ts).
 *
 *   { rancho_id, programa_id, pedido_id, correo, monto, producto? }
 *   firmado en `x-foorkie-firma`.
 *
 * Respuestas (200 salvo error de la puerta):
 *   { ok: true, otorgado: true,  puntos, saldo, tipo }       sumó
 *   { ok: true, otorgado: false, motivo: "ya_otorgado" }       ese pedido ya había sumado
 *   { ok: true, otorgado: false, motivo: "no_miembro" }        ese correo no tiene esta tarjeta
 *   { ok: false, codigo, motivo }                               el motor dijo que no (monto mínimo, tarjeta archivada…)
 *   401 firma · 403 negocio no vinculado · 400 datos · 503 sin configurar
 *
 * La referencia del ledger es `foorkie:<pedido>`: el mismo pedido nunca
 * suma dos veces (UNIQUE(miembro, referencia) del ledger), aunque Foorkie
 * reintente. El canal se lee «Foorkie» en las estadísticas del panel.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sinCache = { "Cache-Control": "no-store" };
const responder = (cuerpo: Record<string, unknown>, status = 200) => NextResponse.json(cuerpo, { status, headers: sinCache });

export async function POST(request: Request) {
  const secreto = process.env.FOORKIE_PLATAFORMA_SECRETO?.trim();
  if (!secreto) return responder({ ok: false, codigo: "no_configurado" }, 503);

  const cuerpo = await request.text();
  if (cuerpo.length > 4000) return responder({ ok: false, codigo: "muy_grande" }, 413);
  if (!firmaValida(cuerpo, request.headers.get("x-foorkie-firma"), secreto)) {
    return responder({ ok: false, codigo: "firma" }, 401);
  }

  let datos: Record<string, unknown>;
  try {
    const leido: unknown = JSON.parse(cuerpo);
    if (!leido || typeof leido !== "object") throw new Error("cuerpo");
    datos = leido as Record<string, unknown>;
  } catch {
    return responder({ ok: false, codigo: "json" }, 400);
  }

  const ranchoId = typeof datos.rancho_id === "string" ? datos.rancho_id : "";
  const programaId = typeof datos.programa_id === "string" ? datos.programa_id : "";
  const pedidoId = typeof datos.pedido_id === "string" ? datos.pedido_id : "";
  const correo = typeof datos.correo === "string" ? datos.correo : "";
  const monto = datos.monto;
  const producto = typeof datos.producto === "string" ? datos.producto.trim().slice(0, 80) || null : null;
  if (!UUID.test(ranchoId) || !UUID.test(programaId) || !UUID.test(pedidoId) || !correo) {
    return responder({ ok: false, codigo: "datos" }, 400);
  }
  if (typeof monto !== "number" || !Number.isInteger(monto) || monto < 0 || monto > 10_000_000) {
    return responder({ ok: false, codigo: "monto" }, 400);
  }

  const db = createAdminClient();
  if (!db) return responder({ ok: false, codigo: "no_configurado" }, 503);

  const vinculo = await vinculoConFoorkie(db, ranchoId, programaId);
  if (!vinculo) return responder({ ok: false, codigo: "no_vinculado" }, 403);

  const miembroId = await miembroPorCorreo(db, ranchoId, programaId, correo);
  if (!miembroId) return responder({ ok: true, otorgado: false, motivo: "no_miembro" });

  const r = await acreditarPorMiembroCore({
    db,
    ranchoId,
    quien: { usuarioId: vinculo.ownerId, permisos: { acreditar: true, canjear: false, revertir: false, auditoria: false } },
    monto,
    producto,
    miembroId,
    referencia: `foorkie:${pedidoId}`,
    via: "foorkie",
  });

  if (!r.ok) return responder({ ok: false, codigo: r.codigo ?? "rechazado", motivo: r.motivo });
  if (r.yaEstaba) return responder({ ok: true, otorgado: false, motivo: "ya_otorgado", saldo: r.saldo });
  return responder({ ok: true, otorgado: true, puntos: r.puntos, saldo: r.saldo, tipo: r.tipo });
}
