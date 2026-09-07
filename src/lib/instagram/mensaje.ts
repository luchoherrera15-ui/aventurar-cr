import { TOPES_IG } from "./tipos";

/**
 * EL MENSAJE PRIVADO Y SU ENLACE — puro, probado.
 *
 * Meta (Messaging API): «el texto del mensaje va en UTF-8 y pesa 1000
 * bytes como máximo; los enlaces tienen que ser URLs bien formadas».
 * No hay botones ni tarjetas para las respuestas privadas a un
 * comentario: es texto, y el enlace va adentro del texto. Eso es
 * exactamente lo que se manda.
 *
 * ── EL ENLACE NO ES UNA URL CUALQUIERA ──────────────────────────────
 * El enlace lo escribe el dueño del negocio y nuestro servidor lo
 * incluye en un mensaje que mandamos nosotros. No lo visitamos (no hay
 * SSRF en el sentido clásico), pero sí lo firmamos con nuestra
 * reputación, así que se exige https, un host con forma de dominio
 * público, nada de credenciales en la URL, ni IPs, ni localhost, ni
 * esquemas raros. Un enlace a la propia página de Linksy es el caso
 * normal y pasa sin más.
 */

export const MAX_BYTES_DM = 1000;

export function bytesUtf8(texto: string): number {
  return Buffer.byteLength(texto, "utf8");
}

const HOST_PUBLICO = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function esIpv4(h: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
}

export type ValidacionEnlace = { ok: true; url: string } | { ok: false; motivo: string };

export function validarEnlace(entrada: string | null | undefined): ValidacionEnlace {
  const crudo = (entrada ?? "").trim();
  if (!crudo) return { ok: false, motivo: "Escribí el enlace." };
  if (crudo.length > TOPES_IG.enlace) return { ok: false, motivo: `El enlace es demasiado largo (máximo ${TOPES_IG.enlace}).` };
  let u: URL;
  try {
    u = new URL(crudo);
  } catch {
    return { ok: false, motivo: "El enlace no es una URL válida. Tiene que empezar con https://" };
  }
  if (u.protocol !== "https:") return { ok: false, motivo: "El enlace tiene que empezar con https://" };
  if (u.username || u.password) return { ok: false, motivo: "El enlace no puede llevar usuario ni contraseña." };
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, motivo: "Ese enlace no es público." };
  }
  if (host.startsWith("[") || esIpv4(host)) return { ok: false, motivo: "El enlace tiene que ser un dominio, no una IP." };
  if (!HOST_PUBLICO.test(host)) return { ok: false, motivo: "El dominio del enlace no parece válido." };
  return { ok: true, url: u.toString() };
}

/** El texto final del DM: el mensaje y, si hay, el enlace en su propia línea. */
export function armarMensajePrivado(mensaje: string, enlace: string | null | undefined): string {
  const m = (mensaje ?? "").trim();
  const e = (enlace ?? "").trim();
  return e ? `${m}\n\n${e}` : m;
}

export type ValidacionMensaje = { ok: true; texto: string; enlace: string | null } | { ok: false; motivo: string };

/** Valida mensaje + enlace juntos y devuelve el texto listo para Meta. */
export function validarMensajePrivado(mensaje: string, enlace: string | null | undefined): ValidacionMensaje {
  const m = (mensaje ?? "").trim();
  if (m.length < 2) return { ok: false, motivo: "Escribí el mensaje que va a recibir la persona." };
  if (m.length > TOPES_IG.mensajePrivado) return { ok: false, motivo: `El mensaje es demasiado largo (máximo ${TOPES_IG.mensajePrivado} caracteres).` };
  let url: string | null = null;
  if ((enlace ?? "").trim()) {
    const v = validarEnlace(enlace);
    if (!v.ok) return { ok: false, motivo: v.motivo };
    url = v.url;
  }
  const texto = armarMensajePrivado(m, url);
  if (bytesUtf8(texto) > MAX_BYTES_DM) {
    return { ok: false, motivo: "Mensaje y enlace juntos pasan el tope de Instagram (1000 bytes). Acortá el mensaje." };
  }
  return { ok: true, texto, enlace: url };
}

/** La respuesta pública: solo largo. */
export function validarMensajePublico(mensaje: string | null | undefined): ValidacionMensaje {
  const m = (mensaje ?? "").trim();
  if (m.length < 2) return { ok: false, motivo: "Escribí la respuesta pública." };
  if (m.length > TOPES_IG.mensajePublico) return { ok: false, motivo: `La respuesta pública es demasiado larga (máximo ${TOPES_IG.mensajePublico}).` };
  return { ok: true, texto: m, enlace: null };
}
