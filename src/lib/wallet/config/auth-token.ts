import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Comparación en tiempo constante — copia deliberada de la de
 * `servicio.ts` en vez de importarla: `servicio.ts` necesita importar
 * DE este archivo (para verificar tokens Apple), así que importar en
 * sentido contrario crearía un ciclo. Es una función de 6 líneas; el
 * ciclo es peor que la duplicación acá.
 */
function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/**
 * AUTHENTICATIONTOKEN DE APPLE — VERSIONADO (Wallet V2, Fase 2B).
 *
 * `pases_wallet.auth_token_version`:
 *   0    = legacy. El token real es el valor guardado en `auth_token`
 *          (aleatorio, 32 bytes, tal como funciona hoy). Ningún pase
 *          existente se toca — "no cambiar el token de un pase ya
 *          instalado" es una regla dura de esta fase.
 *   >=1  = HMAC versionado. El token NUNCA se guarda: se recalcula al
 *          vuelo con
 *
 *            token = base64url(HMAC-SHA256(secreto_version_N,
 *                                            passTypeIdentifier + ":" + serialNumber))
 *
 *          Es determinístico (mismo pase → mismo token, siempre), así
 *          que no hace falta persistir nada sensible — `auth_token`
 *          queda NULL para estos pases.
 *
 * SEGURIDAD:
 *   - El secreto de cada versión vive en su PROPIA variable de entorno
 *     (`APPLE_PASS_AUTH_SECRET_V1`, `_V2`, ...) — nunca se reutiliza
 *     `APPLE_PASS_KEY_B64` (esa es la llave privada del certificado
 *     X.509, un secreto de una naturaleza distinta con su propio ciclo
 *     de vida; mezclarlas acopla la rotación de una a la otra).
 *   - Rotar el secreto de una versión NO invalida los pases de
 *     versiones anteriores: cada pase recuerda su propia versión, y
 *     esta función soporta tener varios secretos vigentes a la vez
 *     mientras existan pases emitidos con cada uno.
 *   - Nunca se loguea el token ni el secreto — ni siquiera parcialmente.
 */

const PREFIJO_SECRETO = "APPLE_PASS_AUTH_SECRET_V";

function nombreVariableDeVersion(version: number): string {
  return `${PREFIJO_SECRETO}${version}`;
}

/**
 * El secreto de una versión, o null si no está configurada. Nunca
 * devuelve el nombre de la variable junto con el valor en un mismo
 * log — el llamador decide qué hacer con el null.
 */
function secretoDeVersion(version: number, env: Record<string, string | undefined> = process.env): string | null {
  return env[nombreVariableDeVersion(version)] || null;
}

/**
 * Calcula el token HMAC de un pase, para una versión de secreto dada.
 * Devuelve null si esa versión no tiene secreto configurado — el
 * llamador debe tratar eso como "no se puede autenticar", nunca como
 * "token vacío es válido".
 */
export function calcularTokenHmac(
  version: number,
  passTypeIdentifier: string,
  serialNumber: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const secreto = secretoDeVersion(version, env);
  if (!secreto) return null;
  return createHmac("sha256", secreto).update(`${passTypeIdentifier}:${serialNumber}`).digest("base64url");
}

/** ¿Hay al menos una versión de secreto HMAC configurada (para emitir pases nuevos con ella)? */
export function versionHmacVigente(env: Record<string, string | undefined> = process.env): number | null {
  // Hoy solo existe la v1. Se busca la más ALTA configurada, no la v1
  // a secas, para que subir de versión sea agregar la variable nueva
  // y nada más — sin tocar código.
  for (let v = 9; v >= 1; v--) {
    if (secretoDeVersion(v, env)) return v;
  }
  return null;
}

export type IdentidadDePaseApple = {
  passTypeIdentifier: string;
  serialNumber: string;
  /** pases_wallet.auth_token_version */
  version: number;
  /** pases_wallet.auth_token — SOLO se usa si version === 0. */
  tokenLegacyGuardado: string | null;
};

/**
 * El token que ESTE pase debería mostrar — recalculado para HMAC,
 * leído tal cual para legacy. Devuelve null si no se puede resolver
 * (versión HMAC sin secreto configurado, o legacy sin token guardado):
 * un null acá SIEMPRE debe traducirse a "rechazar", nunca a "aceptar
 * cualquier cosa".
 */
export function tokenEsperadoDe(pase: IdentidadDePaseApple, env: Record<string, string | undefined> = process.env): string | null {
  if (pase.version === 0) return pase.tokenLegacyGuardado;
  return calcularTokenHmac(pase.version, pase.passTypeIdentifier, pase.serialNumber, env);
}

/** Compara el token recibido contra el esperado, en tiempo constante. */
export function verificarTokenApple(
  tokenRecibido: string,
  pase: IdentidadDePaseApple,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const esperado = tokenEsperadoDe(pase, env);
  if (!esperado) return false;
  return igualSeguro(tokenRecibido, esperado);
}
