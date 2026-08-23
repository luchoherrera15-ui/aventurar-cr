import { supabase } from "./supabase";

/**
 * Las mutaciones de FOOD. Dos caminos distintos, y es a propósito:
 *
 *   · RESERVAR / CANCELAR pasan por el puente HTTP de /web
 *     (src/app/api/food/reservar y /cancelar): la RPC real
 *     (crear_reserva_food, cancelar_reserva_food) está bloqueada para
 *     `authenticated` — solo `service_role` puede llamarla, así el
 *     cupo y el descuento nunca los decide el teléfono. Esta app no
 *     tiene su propio servidor, así que el puente HTTP ES su servidor
 *     de confianza para esto.
 *   · FAVORITOS sí va directo a Supabase: `food_favoritos` (0201) le
 *     da a `authenticated` insert/delete propios via RLS
 *     (customer_id = auth.uid()), sin necesitar ningún intermediario.
 */

const SITE_URL = "https://bookea.lat";

async function tokenDeSesion(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export type EstadoReserva = { ok: true; reservaId: string } | { ok: false; error: string };

export async function reservarFranja(franjaId: string, partySize: number): Promise<EstadoReserva> {
  const token = await tokenDeSesion();
  if (!token) return { ok: false, error: "Iniciá sesión para reservar." };

  try {
    const res = await fetch(`${SITE_URL}/api/food/reservar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ franjaId, partySize }),
    });
    const data = (await res.json()) as { ok: boolean; reservaId?: string; error?: string };
    if (!data.ok) return { ok: false, error: data.error ?? "No se pudo reservar." };
    return { ok: true, reservaId: data.reservaId! };
  } catch {
    return { ok: false, error: "No se pudo conectar. Revisá tu conexión." };
  }
}

export type EstadoCancelacion = { ok: boolean; error: string | null };

export async function cancelarReserva(reservaId: string): Promise<EstadoCancelacion> {
  const token = await tokenDeSesion();
  if (!token) return { ok: false, error: "Iniciá sesión." };

  try {
    const res = await fetch(`${SITE_URL}/api/food/cancelar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reservaId }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) return { ok: false, error: data.error ?? "No se pudo cancelar." };
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "No se pudo conectar. Revisá tu conexión." };
  }
}

export async function alternarFavorito(
  customerId: string,
  businessId: string,
): Promise<{ ok: true; favorito: boolean } | { ok: false; error: string }> {
  const { data: existente, error: errLectura } = await supabase
    .from("food_favoritos")
    .select("id")
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (errLectura) return { ok: false, error: errLectura.message };

  if (existente) {
    const { error } = await supabase.from("food_favoritos").delete().eq("id", existente.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, favorito: false };
  }

  const { error } = await supabase
    .from("food_favoritos")
    .insert({ customer_id: customerId, business_id: businessId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, favorito: true };
}
