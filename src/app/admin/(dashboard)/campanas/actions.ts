"use server";

import { requireAdmin } from "@/lib/auth";
import { enviarCorreo, escaparHtml, plantillaCampana } from "@/lib/email";
import { enlacesBaja } from "@/lib/correo/baja";
import { filtrarDestinatariosMarketing } from "@/lib/correo/marketing";
import { enviarEnLotes } from "@/lib/correo/lotes";
import {
  construirCampana,
  plantillaPorId,
  type EdicionCampana,
} from "@/lib/correo/plantillas-campana";

/**
 * Envío de campañas de correo desde el panel admin. El texto lo escribe
 * el admin en un textarea: se escapa igual que cualquier dato de un
 * formulario antes de meterlo en el HTML del correo.
 *
 * Antes de enviar, la lista pasa por el filtro de consentimiento
 * (0082): fuera los correos que rebotaron o se quejaron, y los que se
 * dieron de baja. Cada correo sale con SU link de baja en el pie y en
 * las cabeceras List-Unsubscribe.
 */

/* `escaparHtml` sale de @/lib/email y ya no se copia acá: había una
   segunda versión idéntica en este archivo, y dos escapadores son dos
   verdades el día que haya que cubrir un carácter más. */

export type ResultadoCampana = {
  error: string | null;
  enviados: number;
  fallidos: number;
  /** Fuera por consentimiento: dados de baja, rebotados o con queja. */
  excluidos?: number;
};

export async function enviarCampana(
  destinatarios: string[],
  asunto: string,
  titulo: string,
  mensaje: string,
  cta?: { label: string; href: string },
): Promise<ResultadoCampana> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", enviados: 0, fallidos: 0 };

  // Correos únicos y sin vacíos: si un perfil llegó repetido, una sola vez.
  const correos = [
    ...new Set(
      (destinatarios ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  if (correos.length === 0) {
    return { error: "No hay destinatarios seleccionados.", enviados: 0, fallidos: 0 };
  }
  if (!asunto.trim() || !titulo.trim() || !mensaje.trim()) {
    return {
      error: "Faltan el asunto, el título o el mensaje.",
      enviados: 0,
      fallidos: 0,
    };
  }

  const ctaLimpio =
    cta && cta.label.trim() && cta.href.trim() ? { label: cta.label.trim(), href: cta.href.trim() } : undefined;
  if (ctaLimpio && !/^https?:\/\//i.test(ctaLimpio.href)) {
    return {
      error: "La URL del botón tiene que empezar con http:// o https://.",
      enviados: 0,
      fallidos: 0,
    };
  }

  // El filtro de consentimiento (0082): a quién NO se le puede mandar.
  // Si no se pudo verificar, no se manda nada — falla cerrado.
  const { permitidos, excluidos, error: errorFiltro } =
    await filtrarDestinatariosMarketing(correos);
  if (errorFiltro) {
    return { error: errorFiltro, enviados: 0, fallidos: 0, excluidos };
  }
  if (permitidos.length === 0) {
    return {
      error:
        excluidos > 0
          ? "Todos los seleccionados están dados de baja o con el correo rebotado."
          : "No hay destinatarios seleccionados.",
      enviados: 0,
      fallidos: 0,
      excluidos,
    };
  }

  // El mensaje es texto plano del textarea: se escapa y los saltos de
  // línea se vuelven <br>. El HTML se arma POR destinatario: cada uno
  // lleva su propio link de baja firmado.
  const tituloHtml = escaparHtml(titulo.trim());
  const mensajeHtml = escaparHtml(mensaje.trim()).replace(/\r?\n/g, "<br>");
  const ctaHtml = ctaLimpio
    ? { href: escaparHtml(ctaLimpio.href), label: escaparHtml(ctaLimpio.label) }
    : undefined;

  // El ritmo de envío lo lleva `enviarEnLotes` (lib/correo/lotes.ts):
  // este bucle estaba escrito dos veces con los mismos números.
  const { enviados, fallidos } = await enviarEnLotes(permitidos, (to) => {
    const baja = enlacesBaja(to);
    return enviarCorreo({
      to,
      subject: asunto.trim(),
      html: plantillaCampana({
        titulo: tituloHtml,
        mensajeHtml,
        cta: ctaHtml,
        bajaUrl: baja?.pagina,
      }),
      bajaOneClickUrl: baja?.oneClick,
    });
  });

  return { error: null, enviados, fallidos, excluidos };
}

/* ═══════════════════════════════════════════════════════════════════
   LAS CAMPAÑAS YA REDACTADAS (ago 2026)
   ═══════════════════════════════════════════════════════════════════

   Pedido del dueño: poder mandar «un mensaje ya hecho, algo profesional
   que enganche», con el mockup de los pases digitales adentro.

   Lo de arriba (`enviarCampana`) sigue igual: asunto + título + un
   textarea, para cuando hay que escribir algo puntual. Lo de acá abajo
   es el camino nuevo — se elige una plantilla, se ve cómo queda, y se
   manda.
   ═══════════════════════════════════════════════════════════════════ */

/**
 * El HTML del correo, tal como lo va a ver quien lo reciba.
 *
 * Vive en el servidor y no en el panel porque `construirCampana` usa
 * `layoutBento`, que sale de `@/lib/email` — y ese módulo arrastra el
 * cliente de Resend. Importarlo desde un componente de cliente metería
 * el SDK entero, con su API key, en el bundle del navegador.
 *
 * El `bajaUrl` de la vista previa es el de una dirección de muestra: el
 * link real se firma por destinatario al enviar.
 */
export async function previsualizarCampana(
  plantillaId: string,
  edicion: EdicionCampana,
): Promise<{ error: string | null; html: string }> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", html: "" };

  const plantilla = plantillaPorId(plantillaId);
  if (!plantilla) return { error: "Esa plantilla no existe.", html: "" };

  return {
    error: null,
    html: construirCampana(plantilla, edicion, escaparHtml, "#"),
  };
}

/**
 * Manda una campaña armada con una plantilla.
 *
 * Comparte con `enviarCampana` todo lo que no se puede saltar: el
 * filtro de consentimiento (que falla CERRADO), el link de baja firmado
 * por destinatario, las cabeceras `List-Unsubscribe` y el ritmo por
 * lotes. Lo único distinto es de dónde sale el HTML.
 */
export async function enviarCampanaConPlantilla(
  destinatarios: string[],
  plantillaId: string,
  asunto: string,
  edicion: EdicionCampana,
): Promise<ResultadoCampana> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", enviados: 0, fallidos: 0 };

  const plantilla = plantillaPorId(plantillaId);
  if (!plantilla) {
    return { error: "Esa plantilla no existe.", enviados: 0, fallidos: 0 };
  }
  if (!asunto.trim() || !edicion.titulo.trim()) {
    return { error: "Faltan el asunto o el título.", enviados: 0, fallidos: 0 };
  }

  const correos = [
    ...new Set(
      (destinatarios ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  if (correos.length === 0) {
    return { error: "No hay destinatarios seleccionados.", enviados: 0, fallidos: 0 };
  }

  const { permitidos, excluidos, error: errorFiltro } =
    await filtrarDestinatariosMarketing(correos);
  if (errorFiltro) return { error: errorFiltro, enviados: 0, fallidos: 0, excluidos };
  if (permitidos.length === 0) {
    return {
      error:
        excluidos > 0
          ? "Todos los seleccionados están dados de baja o con el correo rebotado."
          : "No hay destinatarios seleccionados.",
      enviados: 0,
      fallidos: 0,
      excluidos,
    };
  }

  const { enviados, fallidos } = await enviarEnLotes(permitidos, (to) => {
    const baja = enlacesBaja(to);
    return enviarCorreo({
      to,
      subject: asunto.trim(),
      // El HTML se arma POR destinatario: cada uno lleva SU link de baja
      // firmado. Armarlo una vez afuera del bucle mandaría el mismo link
      // a todos, y darse de baja daría de baja a otra persona.
      html: construirCampana(plantilla, edicion, escaparHtml, baja?.pagina),
      bajaOneClickUrl: baja?.oneClick,
    });
  });

  return { error: null, enviados, fallidos, excluidos };
}
