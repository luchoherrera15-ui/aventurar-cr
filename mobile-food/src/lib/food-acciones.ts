import { supabase } from "./supabase";

/**
 * Las mutaciones de FOOD. Dos caminos distintos, y es a propósito:
 *
 *   · RESERVAR, CANCELAR RESERVA y CREAR PEDIDO ("To Go", 0207) pasan
 *     por un puente HTTP de /web (src/app/api/food/reservar, /cancelar
 *     y /pedidos/crear): las RPC reales (crear_reserva_food,
 *     cancelar_reserva_food, crear_pedido_food) están bloqueadas para
 *     `authenticated` — solo `service_role` puede llamarlas, así el
 *     cupo, el descuento y el precio nunca los decide el teléfono.
 *     Esta app no tiene su propio servidor, así que el puente HTTP ES
 *     su servidor de confianza para esto.
 *   · FAVORITOS y CANCELAR PEDIDO sí van directo a Supabase: la RLS ya
 *     alcanza (food_favoritos, 0201: insert/delete propios; food_pedidos,
 *     0207: el cliente solo puede pasar su propio pedido de pendiente a
 *     cancelado, sin cupo ni dinero que proteger), sin necesitar ningún
 *     intermediario.
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

export type ItemCarrito = { menuItemId: string; cantidad: number };

export type EstadoPedido =
  | { ok: true; pedidoId: string; codigo: string; total: number }
  | { ok: false; error: string };

/**
 * CREAR PEDIDO "To Go" (0207) — mismo puente HTTP que reservar: el
 * precio y el total los calcula el servidor desde food_menu_items,
 * nunca el teléfono.
 */
export async function crearPedido(
  businessId: string,
  items: ItemCarrito[],
  horaRetiro: string | null,
  notas: string | null,
): Promise<EstadoPedido> {
  const token = await tokenDeSesion();
  if (!token) return { ok: false, error: "Iniciá sesión para pedir." };

  try {
    const res = await fetch(`${SITE_URL}/api/food/pedidos/crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessId, items, horaRetiro, notas }),
    });
    const data = (await res.json()) as { ok: boolean; pedidoId?: string; codigo?: string; total?: number; error?: string };
    if (!data.ok) return { ok: false, error: data.error ?? "No se pudo crear el pedido." };
    return { ok: true, pedidoId: data.pedidoId!, codigo: data.codigo!, total: data.total! };
  } catch {
    return { ok: false, error: "No se pudo conectar. Revisá tu conexión." };
  }
}

/**
 * CANCELAR PEDIDO — a diferencia de la reserva, acá no hay cupo que
 * liberar: un update directo alcanza, la RLS (0207) solo deja pasar la
 * transición pendiente → cancelado del propio cliente.
 */
export async function cancelarPedido(pedidoId: string): Promise<EstadoCancelacion> {
  const { error } = await supabase
    .from("food_pedidos")
    .update({ estado: "cancelado", cancelado_at: new Date().toISOString() })
    .eq("id", pedidoId);
  if (error) return { ok: false, error: "No se pudo cancelar: " + error.message };
  return { ok: true, error: null };
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
