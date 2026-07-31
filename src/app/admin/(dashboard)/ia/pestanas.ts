/**
 * Los identificadores de las pestañas del panel de IA, en un módulo
 * neutral (sin "use client") para que los pueda usar TANTO el servidor
 * como el navegador.
 *
 * Misma razón que en Finanzas (ver ../finanzas/pestanas.ts): React
 * convierte todo lo que exporta un módulo "use client" en una
 * referencia al cliente, así que llamar `esTabIA(...)` mientras la
 * página renderiza en el servidor reventaba con "Attempted to call
 * esTabIA() from the server" y la pantalla devolvía error 500. Compila
 * y despliega sin quejarse — solo falla al abrirla.
 */
export const TABS_IA = ["gasto", "modelos", "conocimiento"] as const;

export type TabIA = (typeof TABS_IA)[number];

export function esTabIA(valor: string | undefined): valor is TabIA {
  return TABS_IA.some((t) => t === valor);
}
