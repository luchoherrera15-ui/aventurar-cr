/**
 * BOOKEA MEDIA — Cloudflare Turnstile para las subidas anónimas.
 *
 * ⚠️ Server-only: la secret key jamás sale de acá.
 *
 * Álbumes y comprobantes se suben sin cuenta. Turnstile es lo que
 * separa "un invitado en una boda" de "un script pidiendo URLs de
 * escritura a R2 en un bucle". No identifica a nadie —no es una
 * sesión— pero encarece muchísimo el abuso automatizado.
 *
 * ── FALLA CERRADA EN PRODUCCIÓN ──────────────────────────────────────
 *
 * Sin `TURNSTILE_SECRET_KEY` configurada, en producción se RECHAZA la
 * subida. Un default permisivo acá convertiría un olvido de variable en
 * un endpoint anónimo sin ninguna defensa.
 *
 * ── EL BYPASS DE DESARROLLO ──────────────────────────────────────────
 *
 * Levantar Supabase local y probar una subida no debería exigir una
 * cuenta de Cloudflare. Por eso existe `MEDIA_TURNSTILE_BYPASS`, que
 * **solo** funciona fuera de producción: si `NODE_ENV === "production"`
 * se ignora por completo, aunque esté puesta. Es la única forma de que
 * un bypass de desarrollo no se convierta en un agujero de producción
 * por copiar una variable de entorno de más.
 */

import "server-only";

const VERIFICAR_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 8_000;

export type CodigoErrorTurnstile =
  | "sin-configuracion"
  | "sin-token"
  | "rechazado"
  | "timeout"
  | "respuesta-invalida"
  | "fallo-proveedor";

export type ResultadoTurnstile =
  | { ok: true; via: "verificado" | "bypass-desarrollo" }
  | { ok: false; codigo: CodigoErrorTurnstile; mensaje: string };

export type DependenciasTurnstile = {
  fetch?: typeof fetch;
  entorno?: NodeJS.ProcessEnv;
  timeoutMs?: number;
};

const fallo = (codigo: CodigoErrorTurnstile, mensaje: string): ResultadoTurnstile => ({
  ok: false,
  codigo,
  mensaje,
});

/** ¿Está Turnstile configurado del lado del servidor? */
export function turnstileConfigurado(entorno: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(entorno.TURNSTILE_SECRET_KEY?.trim());
}

/**
 * El bypass, con su única condición: NUNCA en producción.
 *
 * Se comprueba `NODE_ENV` primero y se sale: ni siquiera se mira la
 * variable de bypass si estamos en producción.
 */
export function bypassPermitido(entorno: NodeJS.ProcessEnv = process.env): boolean {
  if (entorno.NODE_ENV === "production") return false;
  return entorno.MEDIA_TURNSTILE_BYPASS === "1";
}

/**
 * Verifica el token contra Cloudflare.
 *
 * `remoteip` es OPCIONAL y va solo si quien llama lo pasa. No se usa
 * como autorización: Turnstile la usa como señal adicional, nada más.
 */
export async function verificarTurnstile(
  params: { token: string | null | undefined; remoteip?: string | null },
  deps: DependenciasTurnstile = {},
): Promise<ResultadoTurnstile> {
  const entorno = deps.entorno ?? process.env;

  if (bypassPermitido(entorno)) {
    return { ok: true, via: "bypass-desarrollo" };
  }

  const secret = entorno.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    // En producción esto es un rechazo; en desarrollo también, salvo
    // que se haya pedido el bypass explícitamente arriba.
    return fallo(
      "sin-configuracion",
      "La verificación anti-abuso no está configurada en el servidor.",
    );
  }

  const token = (params.token ?? "").trim();
  if (!token) return fallo("sin-token", "Falta la verificación anti-abuso.");

  const cuerpo = new URLSearchParams();
  cuerpo.set("secret", secret);
  cuerpo.set("response", token);
  if (params.remoteip) cuerpo.set("remoteip", params.remoteip);

  const hacerFetch = deps.fetch ?? fetch;
  const timeout = deps.timeoutMs ?? TIMEOUT_MS;

  let respuesta: Response;
  try {
    respuesta = await hacerFetch(VERIFICAR_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: cuerpo.toString(),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "ErrorDesconocido";
    if (nombre === "TimeoutError" || nombre === "AbortError") {
      return fallo("timeout", "La verificación anti-abuso no respondió a tiempo.");
    }
    return fallo("fallo-proveedor", "No se pudo completar la verificación anti-abuso.");
  }

  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    return fallo("respuesta-invalida", "La verificación anti-abuso devolvió algo inesperado.");
  }

  if (typeof datos !== "object" || datos === null || !("success" in datos)) {
    return fallo("respuesta-invalida", "La verificación anti-abuso devolvió algo inesperado.");
  }

  if ((datos as { success: unknown }).success !== true) {
    // Los `error-codes` de Cloudflare NO se reenvían al cliente: dicen
    // cosas como `invalid-input-secret`, que es información sobre
    // nuestra configuración, no sobre su intento.
    return fallo("rechazado", "No se pudo verificar que seas una persona. Probá de nuevo.");
  }

  return { ok: true, via: "verificado" };
}
