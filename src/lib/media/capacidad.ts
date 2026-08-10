/**
 * BOOKEA MEDIA — las primitivas de la subida anónima.
 *
 * ⚠️ Server-only: acá se generan secretos y se usa la sal del servidor.
 *
 * Dos cosas, las dos con la misma regla: **lo que se guarda nunca es lo
 * que se recibió**.
 *
 *   · El TOKEN de capacidad se genera acá, viaja una vez al navegador y
 *     no se persiste: en `media_capacidades` vive solo su SHA-256. Un
 *     volcado de esa tabla no le sirve a nadie para subir nada.
 *
 *   · La IP nunca se guarda en claro. Se guarda un HMAC con la sal del
 *     servidor, y SOLO para contar intentos. La IP no autoriza: detrás
 *     de un NAT móvil hay una boda entera compartiendo dirección.
 */

import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Un álbum emite 10 usos: el mismo tope por tanda que ya tiene la pantalla. */
export const USOS_ALBUM = 10;
/** Un comprobante, uno solo. */
export const USOS_COMPROBANTE = 1;

/** Vida de la capacidad. Corta: minutos, no horas. */
export const TTL_CAPACIDAD_S = 15 * 60;

/** Tope de una foto anónima. El mismo de Cloudflare Images. */
export const MAX_BYTES_ANONIMO = 10 * 1024 * 1024;

// ------------------------------------------------------------
// Token de capacidad
// ------------------------------------------------------------

/**
 * 32 bytes de aleatoriedad criptográfica en base64url.
 *
 * No es un uuid: un uuid v4 tiene 122 bits y un formato conocido que
 * invita a probar. Esto son 256 bits sin estructura.
 */
export function generarTokenCapacidad(): string {
  return randomBytes(32).toString("base64url");
}

/** El SHA-256 hex, que es lo ÚNICO que se guarda. */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Compara dos hashes en tiempo constante.
 *
 * Con `===`, el tiempo de respuesta revela cuántos caracteres acertó
 * quien prueba, y un hash se puede reconstruir carácter por carácter.
 * Es el mismo criterio que ya usa `borrarFotoAlbum` (0089) para las
 * llaves de borrado del álbum.
 */
export function hashesIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ------------------------------------------------------------
// La IP, siempre como HMAC
// ------------------------------------------------------------

/**
 * La sal del HMAC de IP.
 *
 * Reutiliza `VISITAS_SALT`, que el proyecto ya tiene y ya usa
 * exactamente para esto (ver src/lib/visitas.ts: convierte IP +
 * navegador + día en un hash para no guardar la IP en claro). Si algún
 * día conviene separarlas, `MEDIA_IP_SALT` la pisa.
 *
 * Sin ninguna de las dos devuelve null y quien llama decide: el
 * endpoint cae al rate limit por capacidad, que no depende de la IP.
 */
function salDeIp(entorno: NodeJS.ProcessEnv): string | null {
  const sal = (entorno.MEDIA_IP_SALT ?? entorno.VISITAS_SALT ?? "").trim();
  return sal.length > 0 ? sal : null;
}

/**
 * El HMAC de una IP. **Nunca** devuelve la IP.
 *
 * Devuelve null si no hay sal o no hay IP — no hay fallback a texto
 * plano, que es justamente lo que no se quiere.
 */
export function hmacDeIp(
  ip: string | null | undefined,
  entorno: NodeJS.ProcessEnv = process.env,
): string | null {
  const limpia = (ip ?? "").trim();
  if (!limpia) return null;
  const sal = salDeIp(entorno);
  if (!sal) return null;
  return createHmac("sha256", sal).update(limpia, "utf8").digest("hex");
}

/**
 * La IP del cliente detrás de Vercel.
 *
 * `x-forwarded-for` puede traer una cadena de proxies; la primera es la
 * del cliente. Se devuelve tal cual para pasarla a `hmacDeIp` o a
 * Turnstile — NUNCA para guardarla.
 */
export function ipDeLaPeticion(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const primera = xff.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

// ------------------------------------------------------------
// Claves de rate limiting
// ------------------------------------------------------------

/**
 * Las claves que se le pasan a `media_rate_limit_tomar`.
 *
 * Se prefijan por ámbito para que dos límites distintos no compartan
 * contador por accidente, y NUNCA contienen una IP en claro.
 */
export function clavePorIp(hmac: string, ambito: string): string {
  return `ip:${ambito}:${hmac}`;
}

export function clavePorCapacidad(tokenHash: string): string {
  return `cap:${tokenHash}`;
}

export function clavePorEntidad(entityType: string, entityId: string): string {
  return `ent:${entityType}:${entityId}`;
}

/**
 * Los límites del flujo anónimo.
 *
 * Son conservadores a propósito: una boda de 200 invitados subiendo 10
 * fotos cada uno son 20 emisiones de capacidad por hora y entidad, muy
 * por debajo de estos números; un script en bucle los toca en segundos.
 */
export const LIMITES_ANONIMOS = {
  /** Emisiones de capacidad por IP y hora. */
  emisionPorIp: { limite: 20, ventanaSegundos: 3600 },
  /** Emisiones por entidad y hora — protege un álbum concreto. */
  emisionPorEntidad: { limite: 300, ventanaSegundos: 3600 },
  /** Reservas por capacidad: nunca más que los usos que trae. */
  reservaPorCapacidad: { limite: USOS_ALBUM, ventanaSegundos: TTL_CAPACIDAD_S },
} as const;
