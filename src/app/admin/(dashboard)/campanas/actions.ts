"use server";

import { requireAdmin } from "@/lib/auth";
import { enviarCorreo, plantillaCampana } from "@/lib/email";

/**
 * Envío de campañas de correo desde el panel admin. El texto lo escribe
 * el admin en un textarea: se escapa igual que cualquier dato de un
 * formulario antes de meterlo en el HTML del correo.
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

  // El mensaje es texto plano del textarea: se escapa y los saltos de
  // línea se vuelven <br> para que el correo respete los párrafos.
  const html = plantillaCampana({
    titulo: escaparHtml(titulo.trim()),
    mensajeHtml: escaparHtml(mensaje.trim()).replace(/\r?\n/g, "<br>"),
    cta: ctaLimpio
      ? { href: escaparHtml(ctaLimpio.href), label: escaparHtml(ctaLimpio.label) }
      : undefined,
  });

  // Lotes secuenciales con una pausa corta entre uno y otro para no
  // saturar Resend; dentro de cada lote los envíos van en paralelo.
  let enviados = 0;
  let fallidos = 0;
  for (let i = 0; i < correos.length; i += TAMANO_LOTE) {
    const lote = correos.slice(i, i + TAMANO_LOTE);
    const resultados = await Promise.all(
      lote.map((to) => enviarCorreo({ to, subject: asunto.trim(), html })),
    );
    for (const r of resultados) {
      if (r.enviado) enviados += 1;
      else fallidos += 1;
    }
    if (i + TAMANO_LOTE < correos.length) {
      await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_LOTES_MS));
    }
  }

  return { error: null, enviados, fallidos };
}
