import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * EL WEBHOOK DE META — lo puro: verificar, firmar, leer.
 *
 * Tres cosas, las tres documentadas por Meta (Webhooks → Getting
 * Started) y ninguna inventada:
 *
 *   1. LA VERIFICACIÓN. Al registrar la URL, Meta hace un GET con
 *      `hub.mode=subscribe`, `hub.verify_token=<lo que pusimos en el
 *      App Dashboard>` y `hub.challenge=<un número>`. Hay que responder
 *      el challenge tal cual, y solo si el token coincide.
 *
 *   2. LA FIRMA. Cada aviso llega con `X-Hub-Signature-256: sha256=<hex>`,
 *      un HMAC-SHA256 del CUERPO CRUDO con el App Secret. Se compara en
 *      tiempo constante. Sin firma válida no se lee ni una fila del
 *      payload — mismo criterio que el webhook de Stripe del repo.
 *
 *   3. LA LECTURA. Un aviso de comentarios tiene la forma
 *      { object: "instagram", entry: [{ id: <cuenta IG>, time,
 *        changes: [{ field: "comments", value: { id, text, from: { id,
 *        username }, media: { id, media_product_type }, parent_id? } }] }] }
 *      Se lee con tolerancia: lo que no tenga esa forma se ignora, lo que
 *      la tenga se devuelve plano. Cualquier otro `field` no es nuestro.
 *
 * Sin red, sin base: todo esto se prueba en webhook.test.ts.
 */

export const CABECERA_FIRMA = "x-hub-signature-256";

/** ¿El cuerpo crudo viene firmado con NUESTRO App Secret? */
export function verificarFirmaMeta(cuerpoCrudo: string, cabecera: string | null | undefined, appSecret: string): boolean {
  const h = (cabecera ?? "").trim();
  if (!h.startsWith("sha256=")) return false;
  const recibida = h.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(recibida)) return false;
  const esperada = createHmac("sha256", appSecret).update(cuerpoCrudo, "utf8").digest("hex");
  const a = Buffer.from(recibida, "hex");
  const b = Buffer.from(esperada, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type VerificacionWebhook = { ok: true; challenge: string } | { ok: false };

/** El GET de verificación: devuelve el challenge solo si el token coincide. */
export function responderVerificacion(params: URLSearchParams, verifyToken: string): VerificacionWebhook {
  const modo = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (modo !== "subscribe" || !challenge) return { ok: false };
  const a = Buffer.from(token);
  const b = Buffer.from(verifyToken);
  if (!verifyToken || a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  return { ok: true, challenge };
}

export type ComentarioWebhook = {
  /** El id de la cuenta profesional (entry.id): a quién le comentaron. */
  cuentaIgId: string;
  comentarioId: string;
  texto: string;
  /** Quién comentó (Instagram-scoped id) y su @. */
  deId: string | null;
  deUsername: string | null;
  mediaId: string | null;
  /** FEED, REELS, … tal como lo manda Meta. */
  mediaTipo: string | null;
  /** Presente cuando es respuesta a otro comentario. */
  parentId: string | null;
  /** entry.time, epoch en segundos. */
  tiempo: number | null;
};

function texto(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function idComoTexto(v: unknown): string | null {
  if (typeof v === "string" && v) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * Los comentarios que trae un aviso, planos. Solo `object: "instagram"`
 * y `field: "comments"`; el resto se ignora sin error — Meta puede
 * mandar más campos de los que pedimos.
 */
export function extraerComentarios(payload: unknown): ComentarioWebhook[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  if (p.object !== "instagram" || !Array.isArray(p.entry)) return [];
  const salida: ComentarioWebhook[] = [];
  for (const entrada of p.entry) {
    if (!entrada || typeof entrada !== "object") continue;
    const e = entrada as Record<string, unknown>;
    const cuentaIgId = idComoTexto(e.id);
    if (!cuentaIgId || !Array.isArray(e.changes)) continue;
    const tiempo = typeof e.time === "number" ? e.time : null;
    for (const cambio of e.changes) {
      if (!cambio || typeof cambio !== "object") continue;
      const c = cambio as Record<string, unknown>;
      if (c.field !== "comments" || !c.value || typeof c.value !== "object") continue;
      const v = c.value as Record<string, unknown>;
      const comentarioId = idComoTexto(v.id);
      if (!comentarioId) continue;
      const de = v.from && typeof v.from === "object" ? (v.from as Record<string, unknown>) : null;
      const media = v.media && typeof v.media === "object" ? (v.media as Record<string, unknown>) : null;
      salida.push({
        cuentaIgId,
        comentarioId,
        texto: typeof v.text === "string" ? v.text : "",
        deId: de ? idComoTexto(de.id) : null,
        deUsername: de ? texto(de.username) : null,
        mediaId: media ? idComoTexto(media.id) : null,
        mediaTipo: media ? texto(media.media_product_type) : null,
        parentId: idComoTexto(v.parent_id),
        tiempo,
      });
    }
  }
  return salida;
}
