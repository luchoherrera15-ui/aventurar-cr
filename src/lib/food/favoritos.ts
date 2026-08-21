import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Los favoritos reales del directorio de FOOD (0201) — ver la
 * migración para el porqué. Esta lectura es intencionalmente la MISMA
 * para cualquier pantalla que necesite saber "¿cuáles ya marcó esta
 * persona?" (home, descubrir, ficha de restaurante, la propia página
 * de favoritos), para que las cuatro nunca puedan desalinearse.
 */
export async function cargarFavoritosIds(
  supabase: SupabaseClient,
  customerId: string | null,
): Promise<Set<string>> {
  if (!customerId) return new Set();
  const { data, error } = await supabase
    .from("food_favoritos")
    .select("business_id")
    .eq("customer_id", customerId);
  if (error) {
    console.error("[food/favoritos] no se pudo cargar:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((f) => f.business_id as string));
}
