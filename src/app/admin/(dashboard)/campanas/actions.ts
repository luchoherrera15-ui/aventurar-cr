"use server";

import { requireAdmin } from "@/lib/auth";
import { enviarCorreo, plantillaCampana } from "@/lib/email";
import { enlacesBaja } from "@/lib/correo/baja";
import { filtrarDestinatariosMarketing } from "@/lib/correo/marketing";

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

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ResultadoCampana = {
  error: string | null;
  enviados: number;
  fallidos: number;
  /** Fuera por consentimiento: dados de baja, rebotados o con queja. */
  excluidos?: number;
};

const TAMANO_LOTE = 10;
const PAUSA_ENTRE_LOTES_MS = 1000;

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

  // Lotes secuenciales con una pausa corta entre uno y otro para no
  // saturar Resend; dentro de cada lote los envíos van en paralelo.
  let enviados = 0;
  let fallidos = 0;
  for (let i = 0; i < permitidos.length; i += TAMANO_LOTE) {
    const lote = permitidos.slice(i, i + TAMANO_LOTE);
    const resultados = await Promise.all(
      lote.map((to) => {
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
      }),
    );
    for (const r of resultados) {
      if (r.enviado) enviados += 1;
      else fallidos += 1;
    }
    if (i + TAMANO_LOTE < permitidos.length) {
      await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_LOTES_MS));
    }
  }

  return { error: null, enviados, fallidos, excluidos };
}
