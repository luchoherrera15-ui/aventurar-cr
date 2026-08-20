"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoReservaFood =
  | { ok: true; reservaId: string }
  | { ok: false; error: string };

/**
 * RESERVAR UNA FRANJA DE FOOD.
 *
 * El navegador manda `franjaId` + `partySize` — nunca un descuento ni
 * un cupo. Todo lo que decide si la reserva entra (cupo disponible,
 * franja activa/vigente, el % de descuento) lo resuelve
 * `crear_reserva_food()` bajo candado transaccional (migración 0190).
 * Este archivo solo confirma quién está pidiendo la reserva y traduce
 * el resultado — igual que sumarSelloEscaneado con acreditar_lealtad.
 */
export async function reservarFood(
  franjaId: string,
  partySize: number,
): Promise<EstadoReservaFood> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Iniciá sesión para reservar." };

  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 30) {
    return { ok: false, error: "La cantidad de personas no es válida." };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, error: "No hay conexión de servicio." };

  // Los negocios demo (es_demo=true, 0193) son puramente visuales — el
  // dueño pidió explícitamente que ninguna reserva real cayera sobre
  // ellos. crear_reserva_food() no distingue es_demo (a propósito: no
  // se tocó el core), así que la barrera va ACÁ, antes de invocarla.
  const { data: franja, error: errFranja } = await db
    .from("food_franjas")
    .select("food_businesses(es_demo)")
    .eq("id", franjaId)
    .maybeSingle();
  if (errFranja) return { ok: false, error: "No se pudo validar la franja: " + errFranja.message };
  const negocioFranja = Array.isArray(franja?.food_businesses)
    ? franja.food_businesses[0]
    : franja?.food_businesses;
  if (negocioFranja?.es_demo) {
    return {
      ok: false,
      error: "Esto es una demo: los restaurantes de /food/demo son de ejemplo y no aceptan reservas reales.",
    };
  }

  const { data, error } = await db.rpc("crear_reserva_food", {
    p_franja_id: franjaId,
    p_customer_id: user.id,
    p_party_size: partySize,
  });

  if (error) return { ok: false, error: "No se pudo reservar: " + error.message };

  const r = data as { ok: boolean; reserva_id?: string; motivo?: string };
  if (!r.ok) return { ok: false, error: r.motivo ?? "No se pudo reservar." };

  return { ok: true, reservaId: r.reserva_id! };
}
