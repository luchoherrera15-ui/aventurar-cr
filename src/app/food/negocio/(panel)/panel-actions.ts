"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verificarAccesoNegocioFood } from "@/lib/food/auth";

export async function salirDelPanelFood() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/food/negocio/login");
}

export type ResultadoCheckIn = { ok: true; partySize: number } | { ok: false; error: string };

/**
 * CHECK-IN — por código (mostrador) o por id (lista de "Hoy").
 *
 * No es una RPC transaccional como la reserva: acá no se toca cupo ni
 * dinero, solo se cambia el estado de una fila que la RLS ya limita al
 * dueño del negocio (gestiona_negocio_food, 0190). Un update directo
 * alcanza — construir un RPC acá protegería algo que la RLS ya cubre.
 */
async function marcarCheckIn(
  negocioId: string,
  buscar: { por: "codigo"; valor: string } | { por: "id"; valor: string },
): Promise<ResultadoCheckIn> {
  const { user, ok } = await verificarAccesoNegocioFood(negocioId);
  if (!user) return { ok: false, error: "Iniciá sesión." };
  if (!ok) return { ok: false, error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  let query = supabase.from("food_reservations").select("id, estado, party_size, business_id");
  query =
    buscar.por === "codigo"
      ? query.eq("codigo_confirmacion", buscar.valor.trim().toUpperCase())
      : query.eq("id", buscar.valor);

  const { data: reserva, error: buscarErr } = await query.maybeSingle();
  if (buscarErr) return { ok: false, error: "No se pudo buscar la reserva: " + buscarErr.message };
  if (!reserva || reserva.business_id !== negocioId) {
    return { ok: false, error: "Esa reserva no corresponde a tu negocio." };
  }
  if (reserva.estado !== "confirmada") {
    return { ok: false, error: `Esa reserva está ${reserva.estado}${reserva.estado === "check_in" ? " (ya se registró)" : ""}.` };
  }

  const { error: updErr } = await supabase
    .from("food_reservations")
    .update({ estado: "check_in", checked_in_at: new Date().toISOString(), checked_in_by: user.id })
    .eq("id", reserva.id);
  if (updErr) return { ok: false, error: "No se pudo confirmar el check-in: " + updErr.message };

  revalidatePath("/food/negocio");
  revalidatePath("/food/negocio/check-in");

  return { ok: true, partySize: reserva.party_size };
}

export async function hacerCheckInPorCodigo(negocioId: string, codigo: string): Promise<ResultadoCheckIn> {
  if (!codigo.trim()) return { ok: false, error: "Escribí el código de la reserva." };
  return marcarCheckIn(negocioId, { por: "codigo", valor: codigo });
}

export async function hacerCheckInPorId(negocioId: string, reservaId: string): Promise<ResultadoCheckIn> {
  return marcarCheckIn(negocioId, { por: "id", valor: reservaId });
}

export type ResultadoNoShow = { ok: true } | { ok: false; error: string };

/**
 * MARCAR QUE NO SE PRESENTÓ.
 *
 * A propósito NO libera cupo: la mesa estuvo reservada y no
 * disponible para nadie más durante esa franja, se haya presentado o
 * no. Cancelar (que sí libera cupo) es una acción distinta, del
 * cliente, vía cancelar_reserva_food() (0191).
 */
export async function marcarNoShow(negocioId: string, reservaId: string): Promise<ResultadoNoShow> {
  const { user, ok } = await verificarAccesoNegocioFood(negocioId);
  if (!user) return { ok: false, error: "Iniciá sesión." };
  if (!ok) return { ok: false, error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { data: reserva, error: buscarErr } = await supabase
    .from("food_reservations")
    .select("id, estado, business_id")
    .eq("id", reservaId)
    .maybeSingle();
  if (buscarErr) return { ok: false, error: "No se pudo buscar la reserva: " + buscarErr.message };
  if (!reserva || reserva.business_id !== negocioId) {
    return { ok: false, error: "Esa reserva no corresponde a tu negocio." };
  }
  if (reserva.estado !== "confirmada") {
    return { ok: false, error: `Esa reserva está ${reserva.estado}.` };
  }

  const { error: updErr } = await supabase
    .from("food_reservations")
    .update({ estado: "no_show" })
    .eq("id", reserva.id);
  if (updErr) return { ok: false, error: "No se pudo guardar: " + updErr.message };

  revalidatePath("/food/negocio");
  return { ok: true };
}
