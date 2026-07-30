/**
 * Preguntas configurables del RSVP de una invitación digital (0068).
 *
 * El equipo define hasta 3 preguntas desde el admin y el invitado las
 * responde al confirmar. Viajan como jsonb en `invitaciones.preguntas`
 * y las respuestas en `invitacion_rsvp.respuestas` ({id → respuesta}),
 * así el anfitrión puede pasarle números exactos al catering
 * ("Vegetarianos: 5") sin perseguir a nadie por WhatsApp.
 */

export type PreguntaInvitacion = {
  /** Identificador estable dentro de la invitación ("p1", "p2", "p3"). */
  id: string;
  etiqueta: string;
  /** "opciones" = select con respuestas cerradas; "texto" = campo libre. */
  tipo: "opciones" | "texto";
  /** Solo para tipo "opciones". */
  opciones?: string[];
};

export const MAX_PREGUNTAS = 3;

/**
 * Valida el jsonb que viene de la base (o del formulario del admin) y
 * lo deja en una lista sana de máximo 3 preguntas. Cualquier cosa rara
 * — columna inexistente (la 0068 sin correr), null, formas viejas —
 * termina en `[]` y la invitación funciona igual que antes.
 */
export function parsearPreguntas(raw: unknown): PreguntaInvitacion[] {
  if (!Array.isArray(raw)) return [];
  const limpias: PreguntaInvitacion[] = [];
  for (const item of raw) {
    if (limpias.length >= MAX_PREGUNTAS) break;
    if (typeof item !== "object" || item === null) continue;
    const p = item as Record<string, unknown>;
    const etiqueta = typeof p.etiqueta === "string" ? p.etiqueta.trim() : "";
    if (!etiqueta) continue;
    const tipo = p.tipo === "opciones" ? "opciones" : "texto";
    const opciones =
      tipo === "opciones" && Array.isArray(p.opciones)
        ? p.opciones
            .filter((o): o is string => typeof o === "string")
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, 12)
        : undefined;
    // Una pregunta de opciones sin opciones no sirve de nada.
    if (tipo === "opciones" && (!opciones || opciones.length === 0)) continue;
    limpias.push({
      id: typeof p.id === "string" && p.id ? p.id : `p${limpias.length + 1}`,
      etiqueta: etiqueta.slice(0, 160),
      tipo,
      ...(opciones ? { opciones } : {}),
    });
  }
  return limpias;
}

/**
 * Deja las respuestas de un invitado listas para guardar: solo pares
 * id → texto no vacío, con largos acotados. Devuelve null si no quedó
 * nada (la columna jsonb queda null, no `{}`).
 */
export function limpiarRespuestas(
  raw: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!raw) return null;
  const limpias: Record<string, string> = {};
  let cuantas = 0;
  for (const [id, valor] of Object.entries(raw)) {
    if (cuantas >= MAX_PREGUNTAS) break;
    if (typeof id !== "string" || id.length > 40) continue;
    const texto = typeof valor === "string" ? valor.trim() : "";
    if (!texto) continue;
    limpias[id] = texto.slice(0, 300);
    cuantas += 1;
  }
  return cuantas > 0 ? limpias : null;
}
