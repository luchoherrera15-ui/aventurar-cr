import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Disponibilidad de un proveedor de servicios para un rango de fechas:
 * cuántos eventos ya tiene tomados cada día y cuántas unidades de cada
 * ítem del catálogo están reservadas. Se lee de dos vistas públicas sin
 * datos personales (disponibilidad_rancho y disponibilidad_items), el
 * mismo patrón que ya usa el calendario de Lugares.
 */

export type CupoDia = {
  /** Reservas activas del día (pendientes + confirmadas + holds vivos). */
  eventos: number;
  /** item_id → unidades ya reservadas ese día. */
  porItem: Record<string, number>;
};

export async function disponibilidadServicio(
  supabase: SupabaseClient,
  ranchoId: string,
  desde: string,
  hasta: string,
): Promise<Record<string, CupoDia>> {
  const [eventosRes, itemsRes] = await Promise.all([
    supabase
      .from("disponibilidad_rancho")
      .select("fecha, estado")
      .eq("rancho_id", ranchoId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("disponibilidad_items")
      .select("item_id, fecha, reservadas")
      .eq("rancho_id", ranchoId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);

  const resultado: Record<string, CupoDia> = {};
  const dia = (fecha: string) =>
    (resultado[fecha] ??= { eventos: 0, porItem: {} });

  for (const fila of eventosRes.data ?? []) {
    dia(fila.fecha as string).eventos += 1;
  }
  for (const fila of itemsRes.data ?? []) {
    dia(fila.fecha as string).porItem[fila.item_id as string] =
      fila.reservadas as number;
  }

  return resultado;
}
