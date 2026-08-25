"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verificarAccesoNegocioFood } from "@/lib/food/auth";
import type { FoodPedidoEstado } from "@/lib/food/tipos";

export type ResultadoPedido = { ok: true } | { ok: false; error: string };

/** El único paso siguiente válido para cada estado — el panel no deja
 *  saltar pasos ni retroceder. */
const SIGUIENTE: Partial<Record<FoodPedidoEstado, FoodPedidoEstado>> = {
  pendiente: "confirmado",
  confirmado: "listo",
  listo: "entregado",
};

const COLUMNA_FECHA: Partial<Record<FoodPedidoEstado, string>> = {
  confirmado: "confirmado_at",
  listo: "listo_at",
  entregado: "entregado_at",
};

/**
 * AVANZAR UN PEDIDO — pendiente → confirmado → listo → entregado. Sin
 * RPC: la RLS de food_pedidos (0207) ya restringe el update a
 * `gestiona_negocio_food(business_id)`, mismo criterio que el check-in
 * de reservas (marcarCheckIn, panel-actions.ts) — no hay cupo ni
 * dinero que proteger acá, un update directo alcanza.
 */
export async function avanzarPedido(negocioId: string, pedidoId: string): Promise<ResultadoPedido> {
  const { user, ok } = await verificarAccesoNegocioFood(negocioId);
  if (!user) return { ok: false, error: "Iniciá sesión." };
  if (!ok) return { ok: false, error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { data: pedido, error: buscarErr } = await supabase
    .from("food_pedidos")
    .select("id, estado, business_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (buscarErr) return { ok: false, error: "No se pudo buscar el pedido: " + buscarErr.message };
  if (!pedido || pedido.business_id !== negocioId) {
    return { ok: false, error: "Ese pedido no corresponde a tu negocio." };
  }

  const siguiente = SIGUIENTE[pedido.estado as FoodPedidoEstado];
  if (!siguiente) {
    return { ok: false, error: `Ese pedido ya está ${pedido.estado} — no tiene un paso siguiente.` };
  }

  const columnaFecha = COLUMNA_FECHA[siguiente];
  const cambios: Record<string, string> = { estado: siguiente };
  if (columnaFecha) cambios[columnaFecha] = new Date().toISOString();

  const { error: updErr } = await supabase.from("food_pedidos").update(cambios).eq("id", pedido.id);
  if (updErr) return { ok: false, error: "No se pudo guardar: " + updErr.message };

  revalidatePath("/food/negocio/pedidos");
  return { ok: true };
}

/** CANCELAR — el negocio también puede cancelar (ej. si se quedó sin
 *  un ingrediente), no solo el cliente. */
export async function cancelarPedidoNegocio(negocioId: string, pedidoId: string): Promise<ResultadoPedido> {
  const { user, ok } = await verificarAccesoNegocioFood(negocioId);
  if (!user) return { ok: false, error: "Iniciá sesión." };
  if (!ok) return { ok: false, error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { data: pedido, error: buscarErr } = await supabase
    .from("food_pedidos")
    .select("id, estado, business_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (buscarErr) return { ok: false, error: "No se pudo buscar el pedido: " + buscarErr.message };
  if (!pedido || pedido.business_id !== negocioId) {
    return { ok: false, error: "Ese pedido no corresponde a tu negocio." };
  }
  if (pedido.estado === "entregado" || pedido.estado === "cancelado") {
    return { ok: false, error: `Ese pedido ya está ${pedido.estado}.` };
  }

  const { error: updErr } = await supabase
    .from("food_pedidos")
    .update({ estado: "cancelado", cancelado_at: new Date().toISOString() })
    .eq("id", pedido.id);
  if (updErr) return { ok: false, error: "No se pudo cancelar: " + updErr.message };

  revalidatePath("/food/negocio/pedidos");
  return { ok: true };
}
