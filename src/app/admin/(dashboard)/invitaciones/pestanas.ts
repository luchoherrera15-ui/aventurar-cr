/**
 * Los identificadores de las pestañas del panel de invitaciones, en un
 * módulo neutral (sin "use client") para que los pueda usar TANTO el
 * servidor como el navegador.
 *
 * Misma razón que en Finanzas y en IA (ver ../ia/pestanas.ts): React
 * convierte todo lo que exporta un módulo "use client" en una
 * referencia al cliente, así que llamar `esTabInvitaciones(...)`
 * mientras la página renderiza en el servidor revienta con "Attempted
 * to call ... from the server" y la pantalla devuelve 500. Compila y
 * despliega sin quejarse — solo falla al abrirla.
 */
export const TABS_INVITACIONES = ["invitaciones", "pedidos"] as const;

export type TabInvitaciones = (typeof TABS_INVITACIONES)[number];

export function esTabInvitaciones(
  valor: string | undefined,
): valor is TabInvitaciones {
  return TABS_INVITACIONES.some((t) => t === valor);
}

/**
 * Los estados de `pedidos_invitacion` (0075) que todavía esperan algo
 * del equipo: el comprobante por revisar, el pago ya verificado y el
 * diseño en curso. Fuera quedan el que aún no paga, el entregado y el
 * cancelado.
 *
 * Vive acá y no en pedidos-panel.tsx por la misma razón que las
 * pestañas: la página lo necesita en el SERVIDOR para contar el globito
 * de la pestaña, y el panel en el navegador para filtrar.
 */
export const ESTADOS_PEDIDO_ABIERTOS = ["en_revision", "pagado", "en_diseno"];
