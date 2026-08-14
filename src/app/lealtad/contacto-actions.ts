"use server";

import { avisarAAdministradores, correosDeAdministradores } from "@/lib/correo/administradores";
import { escaparHtml } from "@/lib/email";

/**
 * LA BURBUJA DE CHAT DE LA LANDING DE LEALTAD — el contacto directo con
 * Bookea para quien todavía NO tiene cuenta ni negocio.
 *
 * Por qué NO es el mismo camino que la ayuda de diseño (0149): esa tabla
 * (`ayuda_diseno`) cuelga de un `rancho_id` — sirve para "ya tengo mi
 * tarjeta y quiero ayuda con ella". Acá quien escribe puede no tener
 * NADA todavía: está mirando la landing, decidiendo si esto le sirve.
 * Forzarlo a pasar por un negocio que no existe sería inventar una
 * tenencia falsa.
 *
 * Por eso es más simple a propósito: sin tabla nueva, un correo a los
 * administradores (mismo mecanismo que ya usa el pedido de invitación y
 * la ayuda de diseño) con el contacto de la persona para que el equipo
 * le responda por fuera de la plataforma. Si algún día esto necesita
 * conversación de ida y vuelta DENTRO de Bookea, ahí sí se justifica una
 * tabla — no antes.
 */

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPE_MENSAJE = 800;

export type ConsultaLanding = {
  nombre: string;
  contacto: string; // correo o WhatsApp, texto libre — la persona elige cómo prefiere que le escriban
  mensaje: string;
  /** Campo señuelo: invisible para una persona, tentador para un bot. Si viene con algo, se descarta en silencio. */
  panal: string;
};

type Resultado = { ok: true } | { ok: false; motivo: string };

export async function enviarConsultaLanding(datos: ConsultaLanding): Promise<Resultado> {
  // El bot que completa TODOS los campos de un formulario también
  // completa este, que ningún humano ve. Se contesta "éxito" para no
  // enseñarle al bot que falló — simplemente no se manda nada.
  if (datos.panal.trim() !== "") return { ok: true };

  const nombre = datos.nombre.trim().slice(0, 100);
  const contacto = datos.contacto.trim().slice(0, 150);
  const mensaje = datos.mensaje.trim().slice(0, TOPE_MENSAJE);

  if (nombre.length < 2) return { ok: false, motivo: "Contanos tu nombre." };
  if (contacto.length < 5) return { ok: false, motivo: "Dejanos un correo o un WhatsApp para responderte." };
  if (mensaje.length < 5) return { ok: false, motivo: "Escribinos qué necesitás (unas palabras alcanzan)." };

  const destinatarios = await correosDeAdministradores();
  if (destinatarios.length === 0) {
    return { ok: false, motivo: "No se pudo enviar — escribinos directamente por WhatsApp." };
  }

  const pareceCorreo = CORREO_REGEX.test(contacto);

  await avisarAAdministradores({
    subject: `LEALTAD — consulta desde la landing: ${nombre}`,
    html: `
      <h2 style="margin:0 0 12px">Alguien escribió desde bookea.lat/lealtad</h2>
      <p style="margin:0 0 6px;font-size:14px"><b>Nombre:</b> ${escaparHtml(nombre)}</p>
      <p style="margin:0 0 12px;font-size:14px">
        <b>${pareceCorreo ? "Correo" : "Contacto"}:</b> ${escaparHtml(contacto)}
      </p>
      <blockquote style="margin:0;border-left:3px solid #ddd;padding-left:12px;font-size:14px">
        ${escaparHtml(mensaje).replaceAll("\n", "<br>")}
      </blockquote>
      <p style="margin:16px 0 0;font-size:12.5px;color:#777">
        Escrito desde la landing pública — todavía no tiene cuenta ni negocio en Bookea.
        Contestale directo a su contacto de arriba.
      </p>
    `,
  });

  return { ok: true };
}
