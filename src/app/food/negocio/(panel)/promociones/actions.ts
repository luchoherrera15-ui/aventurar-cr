"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verificarAccesoNegocioFood } from "@/lib/food/auth";

/**
 * Pausar o reactivar una PROMOCIÓN = alternar `activa` en TODAS las
 * franjas del grupo de un solo tiro. Es la misma columna real que ya
 * usa `alternarFranja` (franjas/actions.ts) — acá solo cambia la
 * granularidad: el dueño piensa "pauso la promo de cena", no "apago
 * 48 filas". Una franja apagada deja de aceptar reservas del público
 * al instante; las reservas ya hechas no se tocan.
 */

export type EstadoPromocion = { error: string | null; ok?: boolean };

/** El tope de franjas de un grupo — el doble del que la pantalla lee (200). */
const LIMITE_FRANJAS_GRUPO = 400;

export async function alternarPromocion(
  negocioId: string,
  franjaIds: string[],
  activa: boolean,
): Promise<EstadoPromocion> {
  if (franjaIds.length === 0) return { error: "La promoción no tiene franjas." };
  if (franjaIds.length > LIMITE_FRANJAS_GRUPO) {
    return { error: "La promoción tiene demasiadas franjas — alternalas desde Disponibilidad." };
  }

  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  // El `.eq("business_id")` va ADEMÁS del `.in("id")`: aunque alguien
  // fabrique ids ajenos en el cliente, solo se tocan franjas propias
  // (y RLS es la segunda muralla detrás de esta).
  const { error } = await supabase
    .from("food_franjas")
    .update({ activa, updated_at: new Date().toISOString() })
    .eq("business_id", negocioId)
    .in("id", franjaIds);

  if (error) {
    console.error("[food/promociones] alternar:", error.message);
    return { error: "No se pudo actualizar la promoción. Intentá de nuevo." };
  }

  // Las franjas se ven en dos pantallas: acá agrupadas como promo y en
  // Disponibilidad una por una — se revalidan las dos para que nunca
  // cuenten historias distintas.
  revalidatePath("/food/negocio/promociones");
  revalidatePath("/food/negocio/franjas");
  return { error: null, ok: true };
}
