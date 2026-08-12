"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { esPlan } from "@/lib/lealtad/planes";

/**
 * Asignar el plan de la plataforma de lealtad a un negocio (0124).
 *
 * Va con la llave de servicio y sesión de admin por la misma razón que
 * los complementos: el plan define qué puede hacer el negocio y cuántos
 * miembros le caben. Si el dueño pudiera escribirlo se subiría solo de
 * plan, que es exactamente lo que `addons_negocio` evita desde la 0077.
 *
 * `ranchos` SÍ tiene política de escritura para su dueño —edita su
 * publicación— así que acá no alcanza con la RLS: la puerta la cierra
 * el `requireAdmin` de abajo.
 */
export async function asignarPlanLealtad({
  ranchoId,
  plan,
}: {
  ranchoId: string;
  /** null = quitarle el plan. */
  plan: string | null;
}): Promise<{ error?: string }> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  if (plan !== null && !esPlan(plan)) return { error: "Ese plan no existe." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { error } = await admin
    .from("ranchos")
    .update({ plan_lealtad: plan })
    .eq("id", ranchoId);

  if (error) {
    if (error.message.includes("plan_lealtad")) {
      return { error: "Falta correr la migración 0124 en Supabase." };
    }
    return { error: "No se pudo asignar el plan: " + error.message };
  }

  revalidatePath("/admin/complementos");
  // La pestaña "Pases de lealtad" del negocio cambia con el plan.
  revalidatePath(`/mi-negocio/${ranchoId}`);
  return {};
}
