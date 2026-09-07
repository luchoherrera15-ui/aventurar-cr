import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { HOST_OAUTH_AUTORIZAR, SCOPES_IG } from "./config";

/**
 * EL `state` DE OAUTH — firmado, con vencimiento y atado a la persona.
 *
 * Meta devuelve el `state` tal cual en el callback; sirve para dos
 * cosas y las dos importan:
 *
 *   1. CSRF: que el callback que llega sea de UN flujo que nosotros
 *      empezamos. Se firma con HMAC-SHA256 y se compara en tiempo
 *      constante; además el `nonce` viaja en una cookie httpOnly y
 *      tiene que coincidir (doble llave: el link y el navegador).
 *   2. Contexto: A QUÉ negocio y A QUÉ usuario pertenece esta
 *      conexión. Sin eso, el callback tendría que confiar en la sesión
 *      del momento, y una persona podría terminar conectando SU
 *      Instagram al negocio de otra si el link se abriera en otro
 *      navegador. El callback exige que el usuario de la sesión sea el
 *      mismo que firmó el state.
 *
 * Vence a los 10 minutos: es el tiempo de una pantalla de permisos, no
 * de una tarde.
 */

export const VIDA_ESTADO_MS = 10 * 60 * 1000;
export const COOKIE_NONCE = "ig_oauth_nonce";

export type EstadoOAuth = {
  negocioId: string;
  usuarioId: string;
  nonce: string;
  /** Epoch ms. */
  exp: number;
};

function firma(payloadB64: string, secreto: string): string {
  return createHmac("sha256", secreto).update(payloadB64).digest("base64url");
}

export function nuevoNonce(): string {
  return randomBytes(16).toString("base64url");
}

export function firmarEstado(
  datos: { negocioId: string; usuarioId: string; nonce: string },
  secreto: string,
  ahora: number = Date.now(),
): string {
  const estado: EstadoOAuth = { ...datos, exp: ahora + VIDA_ESTADO_MS };
  const payload = Buffer.from(JSON.stringify(estado), "utf8").toString("base64url");
  return `${payload}.${firma(payload, secreto)}`;
}

export type VerificacionEstado = { ok: true; estado: EstadoOAuth } | { ok: false; motivo: string };

/**
 * Verifica la firma, el vencimiento y la forma. NO compara el nonce con
 * la cookie: eso lo hace el callback, que es quien la tiene.
 */
export function verificarEstado(token: string | null | undefined, secreto: string, ahora: number = Date.now()): VerificacionEstado {
  const t = (token ?? "").trim();
  const partes = t.split(".");
  if (partes.length !== 2 || !partes[0] || !partes[1]) return { ok: false, motivo: "state ausente o malformado" };
  const [payload, firmaRecibida] = partes;
  const esperada = firma(payload, secreto);
  const a = Buffer.from(firmaRecibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, motivo: "firma inválida" };

  let estado: unknown;
  try {
    estado = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, motivo: "state ilegible" };
  }
  if (!estado || typeof estado !== "object") return { ok: false, motivo: "state ilegible" };
  const e = estado as Record<string, unknown>;
  if (typeof e.negocioId !== "string" || typeof e.usuarioId !== "string" || typeof e.nonce !== "string" || typeof e.exp !== "number") {
    return { ok: false, motivo: "state incompleto" };
  }
  if (e.exp <= ahora) return { ok: false, motivo: "state vencido" };
  return { ok: true, estado: { negocioId: e.negocioId, usuarioId: e.usuarioId, nonce: e.nonce, exp: e.exp } };
}

/** La URL de la pantalla de permisos de Instagram. */
export function urlAutorizacion({ appId, redirectUri, state }: { appId: string; redirectUri: string; state: string }): string {
  const u = new URL(HOST_OAUTH_AUTORIZAR);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES_IG.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}
