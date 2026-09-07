import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { configMeta, configWebhook, faltantesMeta } from "@/lib/instagram/config";
import { CABECERA_FIRMA, extraerComentarios, responderVerificacion, verificarFirmaMeta } from "@/lib/instagram/webhook";
import { procesarComentario } from "@/lib/instagram/motor";
import { depsReales } from "@/lib/instagram/repo";

/**
 * /api/webhooks/instagram — EL WEBHOOK DE META.
 *
 * GET: la verificación (hub.mode / hub.verify_token / hub.challenge).
 * POST: los avisos de comentarios.
 *
 * ── SÍNCRONO, Y POR QUÉ ─────────────────────────────────────────────
 * El proyecto no tiene cola. Las dos opciones eran: responder 200 y
 * procesar «después» con `after()`, o procesar y responder según lo que
 * pasó. Se eligió la segunda: si el envío falla por algo TRANSITORIO
 * (rate limit, caída de Meta) se responde 500 y Meta reenvía el aviso
 * —reintenta por 36 horas—; con `after()` un fallo así se perdería
 * para siempre. Cada aviso trae normalmente UN comentario y el trabajo
 * es una llamada a Graph, así que cabe de sobra en la ventana de la
 * función. La idempotencia (índice único + «una respuesta privada por
 * comentario» de Meta) garantiza que el reenvío nunca duplique un DM.
 *
 * ── PRIMERO LA FIRMA, DESPUÉS TODO ──────────────────────────────────
 * Sin `X-Hub-Signature-256` válida: 401 y nada más. Ni una fila, ni un
 * log del contenido. Mismo criterio que el webhook de Stripe del repo.
 *
 * ── LA VERIFICACIÓN NO ESPERA AL OAUTH ──────────────────────────────
 * Meta verifica esta URL al configurar el webhook, antes de que la app
 * de Instagram tenga sus variables cargadas. Por eso el GET y la firma
 * usan `configWebhook` (token + secreto de la app de Meta) y solo el
 * PROCESAMIENTO pide `configMeta` entera: sin ella, se responde 200 y
 * se deja constancia — reintentar no cambiaría nada.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_COMENTARIOS_POR_AVISO = 25;
const MAX_BYTES_CUERPO_GUARDADO = 16 * 1024;

export async function GET(request: Request) {
  const cfg = configWebhook();
  if (!cfg) return new NextResponse("Instagram sin configurar", { status: 503 });
  const r = responderVerificacion(new URL(request.url).searchParams, cfg.verifyToken);
  if (!r.ok) return new NextResponse("Forbidden", { status: 403 });
  // Meta espera el challenge tal cual, en texto plano.
  return new NextResponse(r.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  const firma = configWebhook();
  if (!firma) return new NextResponse("Instagram sin configurar", { status: 503 });

  const cuerpo = await request.text();
  if (!verificarFirmaMeta(cuerpo, request.headers.get(CABECERA_FIRMA), firma.appSecret)) {
    return new NextResponse("Firma inválida", { status: 401 });
  }

  const cfg = configMeta();
  if (!cfg) {
    console.error("[instagram] webhook firmado pero faltan variables:", faltantesMeta().join(", "));
    return NextResponse.json({ ok: true, ignorado: "sin_configurar" });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    // Firmado pero ilegible: se acepta para que Meta no lo reenvíe.
    return NextResponse.json({ ok: true, ignorado: "json" });
  }
  const comentarios = extraerComentarios(payload).slice(0, MAX_COMENTARIOS_POR_AVISO);

  const admin = createAdminClient();
  if (!admin) return new NextResponse("Sin llave de servicio", { status: 500 });

  // El rastro crudo, recortado. Falla en silencio: la bitácora útil es
  // la de eventos; esta es para depurar.
  {
    const objeto = payload && typeof payload === "object" ? String((payload as Record<string, unknown>).object ?? "") : "";
    const recortado = cuerpo.length > MAX_BYTES_CUERPO_GUARDADO ? { recortado: true, inicio: cuerpo.slice(0, MAX_BYTES_CUERPO_GUARDADO) } : payload;
    await admin.from("solutions_instagram_webhooks").insert({ objeto, comentarios: comentarios.length, cuerpo: recortado });
  }

  if (comentarios.length === 0) return NextResponse.json({ ok: true, comentarios: 0 });

  const deps = depsReales(admin, cfg);
  let transitorios = 0;
  const resumen: Record<string, number> = {};
  for (const c of comentarios) {
    try {
      const r = await procesarComentario(c, deps);
      resumen[r.accion] = (resumen[r.accion] ?? 0) + 1;
      if (r.accion === "error" && r.transitorio) transitorios += 1;
    } catch (e) {
      // Un fallo inesperado del servidor es transitorio por definición:
      // que Meta reenvíe. Se loguea el motivo, nunca el payload.
      console.error("[instagram] error procesando comentario:", e instanceof Error ? e.message : e);
      transitorios += 1;
    }
  }

  if (transitorios > 0) {
    return NextResponse.json({ ok: false, reintentar: true, resumen }, { status: 500 });
  }
  return NextResponse.json({ ok: true, resumen });
}
