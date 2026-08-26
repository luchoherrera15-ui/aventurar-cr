"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { avisarAAdministradores } from "@/lib/correo/administradores";

/**
 * ════════════════════════════════════════════════════════════════════
 *  ALGUIEN DICE QUE UN NEGOCIO PUBLICADO ES SUYO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): «cuando alguien reclame ese negocio,
 * que nos avisen por admin mediante un correo, y nosotros poder cambiar
 * de dueño fácilmente ese seed».
 *
 * Acá NO se traspasa nada. Se guarda la solicitud y se avisa. El
 * traspaso lo hace una persona desde el panel, después de mirar quién
 * está del otro lado — porque «este negocio es mío» es una afirmación
 * que, si se acepta sola, le entrega la agenda y los clientes de un
 * negocio real a cualquiera que complete un formulario.
 */

/** Lo que la pantalla necesita saber para decir algo útil. */
export type ResultadoReclamo = { error: string | null };

const LIMITES = { nombre: 120, correo: 160, telefono: 40, mensaje: 1200 };

function limpio(v: FormDataEntryValue | null, tope: number): string {
  return String(v ?? "").trim().slice(0, tope);
}

export async function reclamarNegocio(
  _previo: ResultadoReclamo,
  formData: FormData,
): Promise<ResultadoReclamo> {
  const ranchoId = limpio(formData.get("ranchoId"), 64);
  const nombre = limpio(formData.get("nombre"), LIMITES.nombre);
  const correo = limpio(formData.get("correo"), LIMITES.correo).toLowerCase();
  const telefono = limpio(formData.get("telefono"), LIMITES.telefono);
  const mensaje = limpio(formData.get("mensaje"), LIMITES.mensaje);

  if (!ranchoId) return { error: "No se pudo identificar el negocio. Recargá la página." };
  if (nombre.length < 2) return { error: "Escribí tu nombre." };
  // Validación mínima y a propósito: un correo mal escrito lo detecta
  // el rebote, y una regex estricta rechaza direcciones válidas raras.
  // Lo que importa es que haya algo con arroba para poder contestar.
  if (!correo.includes("@") || correo.length < 5) {
    return { error: "Escribí un correo donde podamos contestarte." };
  }

  const supabase = await createClient();

  // Se lee el negocio ANTES de insertar, por dos motivos: para que el
  // correo del aviso pueda decir de qué negocio se trata (un aviso que
  // dice «alguien reclamó un negocio» obliga a abrir el panel para
  // saber cuál), y para no guardar un reclamo contra un id inventado.
  const { data: negocio } = await supabase
    .from("ranchos")
    .select("id, nombre, slug")
    .eq("id", ranchoId)
    .maybeSingle();

  if (!negocio) return { error: "Ese negocio ya no está publicado." };

  const { error } = await supabase.from("reclamos_negocio").insert({
    rancho_id: negocio.id,
    nombre,
    correo,
    telefono: telefono || null,
    mensaje: mensaje || null,
  });

  if (error) {
    console.error("[reclamo] No se pudo guardar:", error.message);
    return { error: "No se pudo enviar. Intentá de nuevo en un momento." };
  }

  /**
   * El aviso sale DESPUÉS de responderle a la persona.
   *
   * `after()` y no un `await`: quien acaba de reclamar no tiene por qué
   * esperar a que Resend conteste, y si el correo falla su solicitud ya
   * está guardada igual. El aviso es una comodidad para nosotros; la
   * fila es el dato.
   */
  after(async () => {
    const url = negocio.slug
      ? `https://www.bookea.lat/${negocio.slug}`
      : `https://www.bookea.lat`;
    await avisarAAdministradores({
      subject: `Reclamo de negocio: ${negocio.nombre}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
          <h2 style="margin:0 0 4px;font-size:18px">Alguien reclama «${negocio.nombre}»</h2>
          <p style="margin:0 0 16px;color:#555;font-size:14px">
            Dice ser el dueño y pide que se le pase la ficha.
          </p>
          <table style="font-size:14px;border-collapse:collapse">
            <tr><td style="padding:3px 12px 3px 0;color:#777">Nombre</td><td><strong>${nombre}</strong></td></tr>
            <tr><td style="padding:3px 12px 3px 0;color:#777">Correo</td><td><a href="mailto:${correo}">${correo}</a></td></tr>
            ${telefono ? `<tr><td style="padding:3px 12px 3px 0;color:#777">Teléfono</td><td>${telefono}</td></tr>` : ""}
          </table>
          ${mensaje ? `<p style="margin:16px 0 0;font-size:14px;white-space:pre-wrap">${mensaje}</p>` : ""}
          <p style="margin:22px 0 0;font-size:14px">
            <a href="https://www.bookea.lat/admin/reclamos" style="color:#16295e;font-weight:700">Revisarlo en el panel</a>
            &nbsp;·&nbsp;
            <a href="${url}" style="color:#777">ver la ficha</a>
          </p>
          <p style="margin:18px 0 0;font-size:12.5px;color:#888">
            El traspaso NO es automático: hay que aprobarlo desde el panel.
          </p>
        </div>
      `,
    });
  });

  return { error: null };
}
