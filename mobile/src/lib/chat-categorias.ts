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
 * A qué categoría pertenece una conversación, mirada desde el usuario
 * actual — mismo criterio que `src/lib/chat-categorias.ts` en la web
 * (el orden del chequeo importa, ver ese archivo).
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
