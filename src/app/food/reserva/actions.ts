"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoCancelacion = { ok: boolean; error: string | null };

/**
 * CANCELAR LA PROPIA RESERVA — el cliente, no el negocio.
 *
 * RLS de food_reservations (0190) NO le da a un cliente ningún UPDATE
 * directo sobre su fila — la única política de update es la del
 * negocio (gestiona_negocio_food). Por eso esto pasa por
 * cancelar_reserva_food() (0191), el mismo mecanismo de candado que
 * crear_reserva_food(), con service_role — igual patrón que
 * reservarFood() en restaurante/[slug]/actions.ts.
 */
export async function cancelarReservaFood(reservaId: string): Promise<EstadoCancelacion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Iniciá sesión." };

  const db = createAdminClient();
  if (!db) return { ok: false, error: "No hay conexión de servicio." };

  const { data, error } = await db.rpc("cancelar_reserva_food", {
    p_reserva_id: reservaId,
    p_customer_id: user.id,
  });

  if (error) return { ok: false, error: "No se pudo cancelar: " + error.message };

  const r = data as { ok: boolean; motivo?: string };
  if (!r.ok) return { ok: false, error: r.motivo ?? "No se pudo cancelar." };

  revalidatePath(`/food/reserva/${reservaId}`);
  revalidatePath("/food/mis-reservas");
  return { ok: true, error: null };
}
