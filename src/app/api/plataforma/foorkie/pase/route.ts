import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { leerLinkPase } from "@/lib/plataforma/foorkie-api";
import { generarPaseDeLealtad } from "@/lib/wallet/generar";
import { generarPaseGoogle } from "@/lib/wallet/google";

// Firmar el pase y dibujar la tira no cabe en edge (igual que /api/pases).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/plataforma/foorkie/pase?t=<link firmado> — la tarjeta de un
 * miembro en Apple Wallet (.pkpass) o Google Wallet (redirige a «Guardar»),
 * desde «Mi cuenta → Lealtad» de Foorkie. Ver `foorkie-api.ts`.
 *
 * La identidad NO sale de la cookie de Bookea (allá no la hay): sale del
 * link, que Bookea firmó para ESE miembro hace menos de 30 minutos y solo
 * le dio a Foorkie para el correo de quien tiene la sesión. El miembro ya
 * existe, así que el generador no afilia a nadie: solo emite su pase.
 */

const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c] ?? c);

function pantalla(tituloCrudo: string, textoCrudo: string, status: number) {
  const titulo = escapar(tituloCrudo);
  const texto = escapar(textoCrudo);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f5f6fa;color:#141a33;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}main{max-width:420px;background:#fff;border-radius:20px;padding:28px;box-shadow:0 10px 30px -18px rgba(20,26,51,.4)}h1{font-size:20px;margin:0 0 8px}p{margin:0;line-height:1.5;color:#4b5270}</style></head><body><main><h1>${titulo}</h1><p>${texto}</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const secreto = process.env.FOORKIE_PLATAFORMA_SECRETO?.trim();
  if (!secreto) return pantalla("No disponible", "Las tarjetas desde Foorkie no están configuradas en este momento.", 503);

  const token = new URL(request.url).searchParams.get("t") ?? "";
  const link = leerLinkPase(token, secreto);
  if (!link) {
    return pantalla(
      "Este enlace venció",
      "Por seguridad, el enlace a tu tarjeta dura unos minutos. Volvé a abrir tu tarjeta desde Foorkie y tocá el botón de nuevo.",
      410,
    );
  }

  const db = createAdminClient();
  if (!db) return pantalla("No disponible", "No pudimos conectarnos. Probá de nuevo en un momento.", 503);

  const { data: miembro } = await db
    .from("miembros")
    .select("id, programa_id, persona_id, cliente_id, estado")
    .eq("id", link.m)
    .maybeSingle();
  if (!miembro || miembro.estado !== "activa") {
    return pantalla("Tarjeta no disponible", "Esta tarjeta ya no está activa. Consultá en el local.", 404);
  }

  const [{ data: programa }, { data: vinculo }] = await Promise.all([
    db.from("programa_lealtad").select("id, rancho_id").eq("id", miembro.programa_id).maybeSingle(),
    db.from("foorkie_restaurantes").select("id").eq("bookea_programa_id", miembro.programa_id).limit(1).maybeSingle(),
  ]);
  if (!programa || !vinculo) {
    return pantalla("Tarjeta no disponible", "Esta tarjeta no está vinculada a un local de Foorkie.", 404);
  }

  const identidad = {
    personaId: typeof miembro.persona_id === "string" ? miembro.persona_id : null,
    clienteId: typeof miembro.cliente_id === "string" ? miembro.cliente_id : null,
  };
  const ranchoId = String(programa.rancho_id);
  const programaId = String(programa.id);

  if (link.w === "google") {
    const r = await generarPaseGoogle({ ranchoId, programaId, ...identidad });
    if (!r.ok) {
      console.warn(`[foorkie/pase] google ${programaId} → ${r.codigo}: ${r.motivo}`);
      return pantalla("No pudimos abrir tu tarjeta", r.motivo, 409);
    }
    return NextResponse.redirect(r.url, 302);
  }

  const r = await generarPaseDeLealtad({ ranchoId, programaId, ...identidad, ahora: new Date() });
  if (!r.ok) {
    console.warn(`[foorkie/pase] apple ${programaId} → ${r.codigo}: ${r.motivo}`);
    return pantalla("No pudimos abrir tu tarjeta", r.motivo, 409);
  }
  return new NextResponse(new Uint8Array(r.pkpass), {
    headers: {
      "content-type": "application/vnd.apple.pkpass",
      "content-disposition": `attachment; filename="tarjeta-${r.serialNumber}.pkpass"`,
      "cache-control": "no-store",
    },
  });
}
