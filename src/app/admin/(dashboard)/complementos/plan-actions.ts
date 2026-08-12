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
  // El panel de lealtad del negocio cambia con el plan.
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return {};
}

/**
 * Atender una solicitud de plan (0126) con UN botón: aprobar asigna el
 * plan pedido, enciende el complemento `lealtad` y marca la solicitud —
 * las tres cosas que antes había que acordarse de hacer por separado.
 * Rechazar solo marca (y el negocio vuelve a poder solicitar).
 *
 * Queda QUIÉN la atendió y cuándo: la misma regla de la auditoría del
 * ledger — un registro sin autor es un rumor.
 */
export async function atenderSolicitudLealtad({
  solicitudId,
  aprobar,
}: {
  solicitudId: string;
  aprobar: boolean;
}): Promise<{ error?: string }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data: solicitud } = await admin
    .from("solicitudes_lealtad")
    .select("id, rancho_id, plan, estado")
    .eq("id", solicitudId)
    .maybeSingle();
  if (!solicitud) return { error: "Esa solicitud no existe." };
  if (solicitud.estado !== "pendiente") return { error: "Esa solicitud ya se atendió." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (aprobar) {
    const { error: ePlan } = await admin
      .from("ranchos")
      .update({ plan_lealtad: solicitud.plan })
      .eq("id", solicitud.rancho_id);
    if (ePlan) return { error: "No se pudo asignar el plan: " + ePlan.message };

    const { error: eAddon } = await admin.from("addons_negocio").upsert(
      {
        rancho_id: solicitud.rancho_id,
        addon: "lealtad",
        activo: true,
        // Si el complemento existía VENCIDO, `activo: true` solo no
        // alcanza — estadoDeAddon lo seguiría dando por muerto. Aprobar
        // es empezar de nuevo: sin vencimiento y con fecha fresca.
        vence_en: null,
        activado_en: new Date().toISOString(),
        notas: `Solicitud aprobada (plan ${solicitud.plan})`,
      },
      { onConflict: "rancho_id,addon" },
    );
    if (eAddon) return { error: "El plan quedó, pero el complemento no: " + eAddon.message };
  }

  const { error: eSol } = await admin
    .from("solicitudes_lealtad")
    .update({
      estado: aprobar ? "atendida" : "rechazada",
      atendida_por: user?.id ?? null,
      atendida_en: new Date().toISOString(),
    })
    .eq("id", solicitudId);
  if (eSol) return { error: "Quedó activado pero la solicitud no se marcó: " + eSol.message };

  revalidatePath("/admin/complementos");
  revalidatePath(`/lealtad/panel/${solicitud.rancho_id}`);
  return {};
}
