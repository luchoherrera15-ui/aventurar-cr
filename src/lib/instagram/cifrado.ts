import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * EL CIFRADO DE LOS TOKENS DE INSTAGRAM — AES-256-GCM.
 *
 * El token de usuario de Meta es una credencial: con él se manda un DM
 * a nombre del negocio. No puede vivir en claro en la base (un volcado
 * de la tabla sería un volcado de todas las cuentas), así que se cifra
 * con una clave que solo existe en el entorno del servidor
 * (`META_TOKEN_ENCRYPTION_KEY`) y se descifra únicamente en el momento
 * de hablar con Meta.
 *
 * GCM y no CBC: GCM autentica — un byte cambiado en la base no
 * descifra a basura silenciosa, falla. Un IV nuevo por token, nunca se
 * reutiliza. El formato guardado es `v1.<iv>.<tag>.<cifrado>` en
 * base64url: el prefijo permite rotar el esquema sin adivinar qué hay.
 *
 * El repo ya tiene el patrón de secretos derivados con `node:crypto`
 * (llaves de la API de Lealtad); esto es la versión reversible, que es
 * la única que sirve acá: un hash no se puede volver a mandar a Meta.
 */

const VERSION = "v1";
const BYTES_IV = 12;
const BYTES_CLAVE = 32;

/**
 * La clave de 32 bytes a partir de lo que hay en el entorno: hex de 64
 * caracteres o base64 (estándar o url) de 44. null si no da 32 bytes —
 * mejor no cifrar que cifrar con una clave corta.
 */
export function claveDesdeTexto(valor: string | undefined | null): Buffer | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
  try {
    const b = Buffer.from(v, "base64");
    if (b.length === BYTES_CLAVE) return b;
  } catch {
    /* no es base64 */
  }
  return null;
}

export function cifrar(texto: string, clave: Buffer): string {
  if (clave.length !== BYTES_CLAVE) throw new Error("La clave de cifrado tiene que ser de 32 bytes.");
  const iv = randomBytes(BYTES_IV);
  const cipher = createCipheriv("aes-256-gcm", clave, iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), cifrado.toString("base64url")].join(".");
}

/** null si el blob está corrupto, fue manipulado o la clave no es la misma. */
export function descifrar(blob: string, clave: Buffer): string | null {
  try {
    const [version, ivB64, tagB64, datosB64] = (blob ?? "").split(".");
    if (version !== VERSION || !ivB64 || !tagB64 || !datosB64) return null;
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const datos = Buffer.from(datosB64, "base64url");
    if (iv.length !== BYTES_IV || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", clave, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(datos), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
