import { SLUG_NEGOCIO_INVITACIONES } from "./paquetes-invitaciones";

export type CategoriaChat = "negocio" | "invitaciones" | "salones" | "citas" | "otros";

export const ORDEN_CATEGORIAS_CHAT: CategoriaChat[] = [
  "negocio",
  "invitaciones",
  "salones",
  "citas",
  "otros",
];

export const CATEGORIA_CHAT_LABEL: Record<CategoriaChat, string> = {
  negocio: "Negocio",
  invitaciones: "Invitaciones",
  salones: "Salones de eventos",
  citas: "Citas",
  otros: "Otros",
};

/**
 * A qué pestaña del panel de chat pertenece una conversación, mirada
 * desde el usuario actual. El orden del chequeo importa: el rancho de
 * "bookea-invitaciones" hoy tiene categoria "otros" (no "lugares"), así
 * que cae en "invitaciones" solo porque ese chequeo va ANTES que
 * "salones" — si algún día cambiara su categoria, el orden es lo único
 * que sigue protegiendo la distinción.
 */
export function categorizarConversacion(fila: {
  proveedorId: string;
  miId: string;
  ranchoSlug: string;
  vertical: string;
  categoria: string;
}): CategoriaChat {
  if (fila.proveedorId === fila.miId) return "negocio";
  if (fila.ranchoSlug === SLUG_NEGOCIO_INVITACIONES) return "invitaciones";
  if (fila.vertical === "eventos" && fila.categoria === "lugares") return "salones";
  if (fila.vertical === "citas") return "citas";
  return "otros";
}
