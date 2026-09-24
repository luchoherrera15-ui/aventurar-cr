"use server";

import { createAnonClient } from "@/lib/supabase/server";

/**
 * La confirmación que manda un invitado desde la invitación pública.
 * Anónima a propósito (los invitados no tienen cuenta): va a la RPC
 * `celebrar_confirmar` (0245), que solo acepta celebraciones publicadas,
 * recorta todo y tiene tope por celebración. Las respuestas a las
 * preguntas configuradas viajan como {id: valor}.
 */
export type DatosConfirmacion = {
  nombre: string;
  asiste: boolean;
  personas: number;
  respuestas: Record<string, string>;
  mensaje: string;
  contacto: string;
};

export type ResultadoConfirmacion = { ok: true } | { ok: false; mensaje: string };

export async function confirmarAsistencia(slug: string, datos: DatosConfirmacion): Promise<ResultadoConfirmacion> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { ok: false, mensaje: "Esta invitación no está recibiendo confirmaciones." };
  const nombre = (datos.nombre ?? "").trim().slice(0, 120);
  if (!nombre) return { ok: false, mensaje: "Contanos tu nombre para anotarte." };

  // Solo strings cortos, máximo 12 respuestas: lo demás se descarta.
  const respuestas: Record<string, string> = {};
  for (const [k, v] of Object.entries(datos.respuestas ?? {}).slice(0, 12)) {
    if (/^[a-z0-9_-]{1,40}$/i.test(k) && typeof v === "string" && v.trim()) respuestas[k] = v.trim().slice(0, 300);
  }

  const supabase = createAnonClient();
  const { error } = await supabase.rpc("celebrar_confirmar", {
    p_slug: slug,
    p_nombre: nombre,
    p_asiste: !!datos.asiste,
    p_personas: Math.max(0, Math.min(20, Math.round(Number(datos.personas) || 1))),
    p_respuestas: respuestas,
    p_mensaje: (datos.mensaje ?? "").trim().slice(0, 600) || null,
    p_contacto: (datos.contacto ?? "").trim().slice(0, 120) || null,
  });
  if (error) {
    const m = /no está recibiendo|ya no recibe|nombre/i.test(error.message) ? error.message : "No pudimos guardar tu confirmación. Probá de nuevo en un momento.";
    return { ok: false, mensaje: m };
  }
  return { ok: true };
}
