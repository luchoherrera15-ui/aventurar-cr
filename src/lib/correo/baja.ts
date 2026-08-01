import { createHmac, timingSafeEqual } from "crypto";

/**
 * El token firmado del link "Darme de baja" — solo servidor (usa
 * node:crypto y el secreto; jamás importar desde un componente
 * cliente).
 *
 * Sin base de datos de tokens a propósito: el link es un HMAC del
 * correo + el ámbito, así que verificar no cuesta una consulta y el
 * link no vence (la baja tiene que funcionar aunque el correo tenga
 * meses). Solo quien recibió el correo tiene su token: nadie puede
 * dar de baja a un tercero adivinando la URL.
 *
 * El secreto: BAJA_SECRET si está configurada; si no, se deriva de la
 * service key de Supabase (ya es secreta y ya vive en Vercel). Ojo:
 * rotar ese secreto invalida los links de baja ya enviados — los
 * correos futuros salen firmados con el nuevo y listo.
 */

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";

function secreto(): string | null {
  return process.env.BAJA_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function firmar(correo: string, ranchoId: string | null): string | null {
  const s = secreto();
  if (!s) return null;
  return createHmac("sha256", s)
    .update(`baja-v1|${correo}|${ranchoId ?? ""}`)
    .digest("base64url");
}

function normalizar(correo: string): string {
  return correo.trim().toLowerCase();
}

/**
 * Los dos enlaces de baja de un destinatario, con la MISMA firma:
 *
 *  - `pagina`: el link visible del pie del correo (/baja), que abre la
 *    página de confirmación.
 *  - `oneClick`: el endpoint POST del estándar List-Unsubscribe
 *    (RFC 8058) que llaman Gmail o Apple Mail desde su propio botón.
 *
 * `ranchoId` null = baja de toda la plataforma (campañas del admin);
 * puesto = solo de ese negocio. Devuelve null si no hay secreto
 * configurado (entorno local pelado) — el que llama decide si manda
 * el correo sin link o no lo manda.
 */
export function enlacesBaja(
  correo: string,
  ranchoId: string | null = null,
): { pagina: string; oneClick: string } | null {
  const c = normalizar(correo);
  const t = firmar(c, ranchoId);
  if (!t) return null;
  const params = new URLSearchParams({ e: Buffer.from(c, "utf8").toString("base64url"), t });
  if (ranchoId) params.set("r", ranchoId);
  const query = params.toString();
  return {
    pagina: `${SITIO_URL}/baja?${query}`,
    oneClick: `${SITIO_URL}/api/correo/baja?${query}`,
  };
}

/**
 * Valida los parámetros del link. Devuelve el correo (normalizado) y
 * el ámbito si la firma es legítima; null si no.
 */
export function verificarBaja(params: {
  e?: string;
  r?: string;
  t?: string;
}): { correo: string; ranchoId: string | null } | null {
  const { e, r, t } = params;
  if (!e || !t) return null;
  let correo: string;
  try {
    correo = normalizar(Buffer.from(e, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!correo.includes("@")) return null;
  const ranchoId = r && /^[0-9a-f-]{36}$/i.test(r) ? r : null;
  const esperado = firmar(correo, ranchoId);
  if (!esperado) return null;

  const a = Buffer.from(t);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { correo, ranchoId };
}
