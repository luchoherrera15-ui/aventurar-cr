/**
 * Los identificadores de las pestañas de Finanzas, en un módulo neutral
 * (sin "use client") para que los pueda usar TANTO el servidor como el
 * navegador.
 *
 * Vivían dentro de `finanzas-tabs.tsx`, que es un componente cliente, y
 * la página los llamaba mientras renderizaba en el servidor: React
 * convierte todo lo que exporta un módulo "use client" en una
 * referencia al cliente, así que `esTabFinanzas(...)` reventaba con
 * "Attempted to call esTabFinanzas() from the server" y la pantalla
 * devolvía error 500. Desde un módulo neutral no hay frontera que
 * cruzar.
 */
export const TABS_FINANZAS = ["alquileres", "promocion", "invitaciones"] as const;

export type TabFinanzas = (typeof TABS_FINANZAS)[number];

export function esTabFinanzas(valor: string | undefined): valor is TabFinanzas {
  return TABS_FINANZAS.some((t) => t === valor);
}
