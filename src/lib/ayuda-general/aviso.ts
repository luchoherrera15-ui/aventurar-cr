import { avisarAAdministradores } from "@/lib/correo/administradores";
import { enviarCorreo, escaparHtml } from "@/lib/email";
import { SITIO } from "@/lib/sitio";
import type { HiloAyudaGeneral, MensajeAyudaGeneral } from "./tipos";

/**
 * LOS DOS AVISOS DE «HABLÁ CON BOOKEA» (0182).
 *
 * Nunca son fatales ni bloquean nada: la FILA en `mensajes_ayuda_general`
 * es la fuente de verdad (mismo criterio que 0126/0149 — "si el correo
 * se pierde, el pedido sigue visible en el panel"). Quien llama estos
 * dos envuelve la llamada en `after()`, así el correo sale después de
 * responderle a quien escribió, nunca antes.
 */

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `hilo.nombre` para el logueado sale de `perfiles.nombre` — texto libre,
 * sin límite de largo ni de saltos de línea a nivel de base. El resto de
 * este archivo pasa cada dato por `escaparHtml()` porque va dentro del
 * cuerpo HTML; el ASUNTO no se renderiza como HTML (escaparlo ahí no
 * protege nada), así que acá se sanea aparte: sin control chars ni
 * saltos de línea, y con un tope de largo.
 */
function asuntoSeguro(texto: string): string {
  const CONTROL = new RegExp("[\\r\\n\\t\\x00-\\x1f\\x7f]", "g");
  return texto.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, 150);
}

/** A los administradores, cuando alguien abre una conversación nueva. */
export async function avisarNuevoHiloAyuda(hilo: HiloAyudaGeneral): Promise<void> {
  const primero = hilo.mensajes[0];
  if (!primero) return;

  await avisarAAdministradores({
    subject: `AYUDA — ${asuntoSeguro(hilo.nombre)} escribió`,
    html: `
      <h2 style="margin:0 0 12px">Alguien escribió a "Hablá con Bookea"</h2>
      <p style="margin:0 0 6px;font-size:14px"><b>Nombre:</b> ${escaparHtml(hilo.nombre)}</p>
      <p style="margin:0 0 12px;font-size:14px"><b>Contacto:</b> ${escaparHtml(hilo.contacto)}</p>
      <blockquote style="margin:0 0 16px;border-left:3px solid #ddd;padding-left:12px;font-size:14px">
        ${escaparHtml(primero.texto).replaceAll("\n", "<br>")}
      </blockquote>
      <p style="margin:0;font-size:14px">
        Se contesta desde <a href="${SITIO}/admin/ayuda">la bandeja de ayuda</a> — el hilo
        queda ahí aunque este correo se pierda.
      </p>
    `,
  });
}

/**
 * A la PERSONA, cuando Bookea le contesta — solo si su contacto tiene
 * forma de correo (lo que dejó puede ser un número de WhatsApp, y a eso
 * no hay cómo escribirle desde acá). Best-effort explícito: si no
 * matchea, no es un error, es que hay que contestarle por otra vía.
 */
export async function avisarRespuestaBookea(
  hilo: HiloAyudaGeneral,
  mensaje: MensajeAyudaGeneral,
): Promise<void> {
  const contacto = hilo.contacto.trim();
  if (!CORREO_REGEX.test(contacto)) return;

  await enviarCorreo({
    to: contacto,
    subject: "Bookea te respondió",
    html: `
      <p style="margin:0 0 12px;font-size:15px">
        Hola${hilo.nombre ? ` ${escaparHtml(hilo.nombre)}` : ""}, te contestamos en Bookea:
      </p>
      <blockquote style="margin:0 0 16px;border-left:3px solid #ddd;padding-left:12px;font-size:15px">
        ${escaparHtml(mensaje.texto).replaceAll("\n", "<br>")}
      </blockquote>
      <p style="margin:0;font-size:15px">
        Seguí la conversación desde <a href="${SITIO}/ayuda">bookea.lat/ayuda</a>.
      </p>
    `,
  });
}
