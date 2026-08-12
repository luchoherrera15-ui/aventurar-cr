/**
 * Los complementos de pago que un negocio puede tener encendidos.
 *
 * Bookea no vende planes cerrados: vende complementos por NEGOCIO. La
 * regla de producto que los guía es que si algo se puede hacer a mano,
 * la versión a mano es gratis para siempre — lo que se cobra es que la
 * IA lo haga por vos.
 *
 * Esta lista tiene que coincidir con el `check` de `addons_negocio.addon`
 * (migraciones 0077 y 0090). Agregar uno nuevo son dos pasos: la
 * migración que lo suma al check, y una fila acá.
 *
 * Módulo neutral (sin "use client") porque lo necesitan la página del
 * panel en el servidor y su tabla en el navegador.
 */

export const ADDONS = [
  {
    id: "asistente_ia",
    nombre: "Asistente IA",
    /** Qué deja de funcionar si se apaga, en palabras del dueño. */
    resumen: "Contesta el chat solo, con los datos del negocio.",
  },
  {
    id: "agenda_ia",
    nombre: "Agenda con IA",
    resumen: "Lee las fotos de la agenda de papel y las pasa a reservas.",
  },
  {
    id: "lealtad",
    nombre: "Lealtad",
    resumen: "Sellos y puntos digitales con tarjeta en el Wallet.",
  },
  {
    id: "pases",
    nombre: "Pases de lealtad",
    resumen: "Tarjeta del negocio en Apple Wallet, con su logo y sus colores.",
  },
  {
    id: "pases_cercania",
    nombre: "Aviso por cercanía",
    resumen:
      "La tarjeta aparece sola en la pantalla bloqueada cuando el cliente pasa cerca del local.",
  },
] as const;

export type AddonId = (typeof ADDONS)[number]["id"];

export const IDS_ADDON = ADDONS.map((a) => a.id) as readonly string[];

export function esAddon(valor: string): valor is AddonId {
  return IDS_ADDON.includes(valor);
}

export function nombreAddon(id: string): string {
  return ADDONS.find((a) => a.id === id)?.nombre ?? id;
}

/** Las duraciones que se ofrecen al activar. null = sin vencimiento. */
export const DURACIONES: { id: string; label: string; meses: number | null }[] = [
  { id: "1", label: "1 mes (cortesía)", meses: 1 },
  { id: "3", label: "3 meses", meses: 3 },
  { id: "6", label: "6 meses", meses: 6 },
  { id: "12", label: "1 año", meses: 12 },
  { id: "0", label: "Sin vencimiento", meses: null },
];

/** El estado en que está un complemento para un negocio. */
export type EstadoAddon = "activo" | "vencido" | "apagado";

export function estadoDeAddon(fila: {
  activo: boolean;
  vence_en: string | null;
} | null): EstadoAddon {
  if (!fila || !fila.activo) return "apagado";
  if (fila.vence_en && new Date(fila.vence_en).getTime() <= Date.now()) {
    return "vencido";
  }
  return "activo";
}
