import { HOST_GRAPH, HOST_OAUTH_TOKEN, type ConfigMeta } from "./config";
import { TOPES_IG, type ErrorMeta, type PublicacionIg } from "./tipos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL CLIENTE DE GRAPH (Instagram API with Instagram Login)
 * ════════════════════════════════════════════════════════════════════
 *
 * Cada función es UN endpoint documentado por Meta, con su método, su
 * ruta y su forma, y nada más. Host: graph.instagram.com/<versión>
 * (los dos endpoints de tokens van sin versión, como los muestra la
 * doc). Referencias en docs/instagram-auto-reply.md.
 *
 * ── EL TOKEN NUNCA VIAJA EN LA URL ──────────────────────────────────
 * Graph acepta `Authorization: Bearer`. Ponerlo como `?access_token=`
 * lo deja en logs de proxies, en `referer` y en cualquier traza; en la
 * cabecera no. Las dos excepciones son los endpoints de canje y
 * refresco de token, que por diseño de Meta lo reciben como parámetro:
 * ahí va, y esas URLs no se registran en ningún lado.
 *
 * ── LOS ERRORES SE TRADUCEN, NO SE REENVÍAN ─────────────────────────
 * `clasificarErrorMeta` convierte `{ error: { code, error_subcode,
 * message } }` en uno de nuestros códigos y un mensaje corto y
 * REDACTADO (cualquier cosa con forma de token se borra). Es lo único
 * que llega a la base y al panel.
 *
 * Todo pasa por `fetch` global: las pruebas lo reemplazan.
 */

export type ResultadoGraph<T> = { ok: true; data: T } | { ok: false; error: ErrorMeta };

const TIMEOUT_MS = 8000;

/** Quita lo que parezca un token o un secreto de un texto de error. */
export function redactar(texto: string): string {
  return (texto ?? "")
    .replace(/access_token=[^&\s]+/gi, "access_token=[oculto]")
    .replace(/\b(IGQ|IGA|EAA)[A-Za-z0-9_-]{20,}/g, "[token]")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=[oculto]")
    .slice(0, TOPES_IG.notaError);
}

type CuerpoError = { error?: { message?: unknown; type?: unknown; code?: unknown; error_subcode?: unknown } };

/**
 * Los códigos de Graph son los generales de la plataforma (no hay una
 * lista aparte para respuestas privadas):
 *   190              token inválido o vencido → reconectar
 *   10, 200–299, 3   sin permiso → reconectar aceptando todo
 *   4, 17, 32, 613,
 *   80001, 80002,    límite de llamadas (80002 = Instagram) → reintentar
 *   80007, HTTP 429
 *   100              parámetro inválido (comentario/medio inexistente)
 *   551              la persona no está disponible para mensajes
 *   1, 2, HTTP 5xx   caída temporal → reintentar
 * Un `code 10` CON subcódigo es la forma en que Messaging rechaza un
 * envío por política (ventana, límite por comentario): DM rechazado, no
 * un problema de permisos.
 */
export function clasificarErrorMeta(status: number, cuerpo: unknown): ErrorMeta {
  const e = (cuerpo && typeof cuerpo === "object" ? (cuerpo as CuerpoError).error : undefined) ?? {};
  const code = typeof e.code === "number" ? e.code : undefined;
  const sub = typeof e.error_subcode === "number" ? e.error_subcode : undefined;
  const mensaje = redactar(typeof e.message === "string" && e.message ? e.message : `Instagram respondió ${status}`);
  const base = { mensaje, metaCode: code, metaSubcode: sub };

  if (code === 190) return { ...base, codigo: "token_vencido", transitorio: false };
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80001 || code === 80002 || code === 80007 || status === 429) {
    return { ...base, codigo: "rate_limit", transitorio: true };
  }
  if (code === 10 && sub !== undefined) return { ...base, codigo: "dm_rechazado", transitorio: false };
  if (code === 551) return { ...base, codigo: "dm_rechazado", transitorio: false };
  if (code === 10 || code === 3 || (code !== undefined && code >= 200 && code <= 299)) {
    return { ...base, codigo: "permisos", transitorio: false };
  }
  if (code === 100) return { ...base, codigo: "no_procesable", transitorio: false };
  if (code === 1 || code === 2 || status >= 500) return { ...base, codigo: "api_no_disponible", transitorio: true };
  return { ...base, codigo: "desconocido", transitorio: false };
}

function errorDeRed(motivo: string): ErrorMeta {
  return { codigo: "api_no_disponible", mensaje: redactar(motivo), transitorio: true };
}

async function pedir<T>(url: string, init: RequestInit): Promise<ResultadoGraph<T>> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: control.signal, cache: "no-store" });
    let cuerpo: unknown = null;
    try {
      cuerpo = await res.json();
    } catch {
      cuerpo = null;
    }
    const conError = cuerpo && typeof cuerpo === "object" && "error" in (cuerpo as Record<string, unknown>);
    if (!res.ok || conError) return { ok: false, error: clasificarErrorMeta(res.status, cuerpo) };
    return { ok: true, data: cuerpo as T };
  } catch (e) {
    return { ok: false, error: errorDeRed(e instanceof Error ? e.message : "sin respuesta") };
  } finally {
    clearTimeout(reloj);
  }
}

/** GET/POST a graph.instagram.com/<versión>/<ruta>, con el token en la cabecera. */
async function graph<T>(
  cfg: ConfigMeta,
  ruta: string,
  { method = "GET", token, params, body }: { method?: "GET" | "POST"; token: string; params?: Record<string, string>; body?: Record<string, unknown> },
): Promise<ResultadoGraph<T>> {
  const u = new URL(`${HOST_GRAPH}/${cfg.version}/${ruta.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params ?? {})) u.searchParams.set(k, v);
  return pedir<T>(u.toString(), {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── OAuth: el canje del código y los tokens largos ──────────────────

export type TokenCorto = { access_token: string; user_id: string | number; permissions?: string[] | string };
export type TokenLargo = { access_token: string; token_type?: string; expires_in: number };

/** POST api.instagram.com/oauth/access_token — el código por un token corto (1 h). */
export async function intercambiarCodigo(cfg: ConfigMeta, code: string): Promise<ResultadoGraph<TokenCorto>> {
  const form = new URLSearchParams({
    client_id: cfg.igAppId,
    client_secret: cfg.igAppSecret,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
    code,
  });
  return pedir<TokenCorto>(HOST_OAUTH_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
}

/** GET graph.instagram.com/access_token?grant_type=ig_exchange_token — 60 días. */
export async function tokenLargo(cfg: ConfigMeta, tokenCorto: string): Promise<ResultadoGraph<TokenLargo>> {
  const u = new URL(`${HOST_GRAPH}/access_token`);
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", cfg.igAppSecret);
  u.searchParams.set("access_token", tokenCorto);
  return pedir<TokenLargo>(u.toString(), { method: "GET" });
}

/** GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token — otros 60 días. */
export async function refrescarTokenLargo(token: string): Promise<ResultadoGraph<TokenLargo>> {
  const u = new URL(`${HOST_GRAPH}/refresh_access_token`);
  u.searchParams.set("grant_type", "ig_refresh_token");
  u.searchParams.set("access_token", token);
  return pedir<TokenLargo>(u.toString(), { method: "GET" });
}

// ── La cuenta ───────────────────────────────────────────────────────

export type PerfilIg = {
  id?: string;
  user_id?: string | number;
  username?: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
};

/** GET /me?fields=… — quién es la cuenta y de qué tipo. */
export function perfilInstagram(cfg: ConfigMeta, token: string): Promise<ResultadoGraph<PerfilIg>> {
  return graph<PerfilIg>(cfg, "me", { token, params: { fields: "id,user_id,username,name,account_type,profile_picture_url" } });
}

/** POST /me/subscribed_apps?subscribed_fields=comments — que los comentarios lleguen al webhook. */
export async function suscribirComentarios(cfg: ConfigMeta, token: string): Promise<ResultadoGraph<{ success?: boolean }>> {
  return graph(cfg, "me/subscribed_apps", { method: "POST", token, params: { subscribed_fields: "comments" } });
}

/** GET /<IG_ID>/media?fields=… — las publicaciones, para elegir una. */
export async function publicacionesInstagram(cfg: ConfigMeta, igUserId: string, token: string, limite = 25): Promise<ResultadoGraph<PublicacionIg[]>> {
  const r = await graph<{ data?: PublicacionIg[] }>(cfg, `${igUserId}/media`, {
    token,
    params: { fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp", limit: String(limite) },
  });
  if (!r.ok) return r;
  const lista = Array.isArray(r.data.data) ? r.data.data : [];
  return {
    ok: true,
    data: lista
      .filter((m) => m && typeof m.id === "string")
      .map((m) => ({
        id: m.id,
        caption: typeof m.caption === "string" ? m.caption : null,
        media_type: typeof m.media_type === "string" ? m.media_type : null,
        media_product_type: typeof m.media_product_type === "string" ? m.media_product_type : null,
        media_url: typeof m.media_url === "string" ? m.media_url : null,
        thumbnail_url: typeof m.thumbnail_url === "string" ? m.thumbnail_url : null,
        permalink: typeof m.permalink === "string" ? m.permalink : null,
        timestamp: typeof m.timestamp === "string" ? m.timestamp : null,
      })),
  };
}

// ── Las dos respuestas ──────────────────────────────────────────────

/**
 * POST /<IG_ID>/messages con `recipient: { comment_id }` — la respuesta
 * PRIVADA a un comentario. Meta: una sola por comentario, dentro de los
 * 7 días, texto de hasta 1000 bytes.
 */
export async function enviarRespuestaPrivada(
  cfg: ConfigMeta,
  igUserId: string,
  token: string,
  comentarioId: string,
  texto: string,
): Promise<ResultadoGraph<{ recipient_id?: string; message_id?: string }>> {
  return graph(cfg, `${igUserId}/messages`, {
    method: "POST",
    token,
    body: { recipient: { comment_id: comentarioId }, message: { text: texto } },
  });
}

/** POST /<COMMENT_ID>/replies?message=… — la respuesta PÚBLICA al comentario. */
export async function responderComentario(cfg: ConfigMeta, comentarioId: string, token: string, texto: string): Promise<ResultadoGraph<{ id?: string }>> {
  return graph(cfg, `${comentarioId}/replies`, { method: "POST", token, params: { message: texto } });
}
