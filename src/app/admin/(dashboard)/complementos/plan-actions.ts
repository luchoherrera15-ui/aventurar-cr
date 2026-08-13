"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { esPlan } from "@/lib/lealtad/planes";
import { generarSlugUnico } from "@/lib/slug";

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
 * Aprobar un negocio nuevo para el mundo de lealtad (0129): hasta este
 * clic, el negocio está EN HOLD — sin panel y sin poder solicitar plan.
 * Va con la llave de servicio porque el trigger
 * `ranchos_proteger_aprobacion_lealtad` rechaza a cualquier sesión que
 * no sea admin; el `requireAdmin` de acá pone el mensaje decente antes.
 */
export async function aprobarNegocioLealtad({
  ranchoId,
}: {
  ranchoId: string;
}): Promise<{ error?: string }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await admin
    .from("ranchos")
    .update({
      lealtad_aprobado_en: new Date().toISOString(),
      lealtad_aprobado_por: user?.id ?? null,
    })
    .eq("id", ranchoId);

  if (error) {
    if (error.message.includes("lealtad_aprobado")) {
      return { error: "Falta correr la migración 0129 en Supabase." };
    }
    return { error: "No se pudo aprobar: " + error.message };
  }

  revalidatePath("/admin/complementos");
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath("/lealtad/panel");
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
}): Promise<{ error?: string; ranchoId?: string }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data: solicitud } = await admin
    .from("solicitudes_lealtad")
    .select("*")
    .eq("id", solicitudId)
    .maybeSingle();
  if (!solicitud) return { error: "Esa solicitud no existe." };
  if (solicitud.estado !== "pendiente") return { error: "Esa solicitud ya se atendió." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El rancho destino: el existente (upgrade) o, en un ALTA (0130),
  // el que se CREA acá mismo — aceptar ES crear; rechazar no crea nada.
  let ranchoId = solicitud.rancho_id as string | null;

  if (aprobar) {
    if (!ranchoId) {
      const nombre = ((solicitud.negocio_nombre as string | null) ?? "").trim();
      if (!nombre) return { error: "La solicitud de alta no trae nombre de negocio." };

      // 'otro' no es una vertical real: el rancho nace como 'citas'
      // (no se publica en ningún directorio, así que solo es el eje
      // operativo); la respuesta original queda en la solicitud.
      const verticalCruda = (solicitud.negocio_vertical as string | null) ?? "otro";
      const vertical = ["citas", "eventos", "hospedajes", "restaurantes"].includes(verticalCruda)
        ? verticalCruda
        : "citas";

      const slug = await generarSlugUnico(admin, nombre);
      const { data: nuevo, error: eRancho } = await admin
        .from("ranchos")
        .insert({
          owner_id: solicitud.solicitante_id,
          nombre,
          slug,
          vertical,
          categoria: "otros",
          estado: "pendiente",
          // Aprobar el alta ES la aprobación de lealtad (0129): no
          // tendría sentido volver a ponerlo en hold recién nacido.
          lealtad_aprobado_en: new Date().toISOString(),
          lealtad_aprobado_por: user?.id ?? null,
        })
        .select("id")
        .single();
      if (eRancho) return { error: "No se pudo crear el negocio: " + eRancho.message };
      ranchoId = nuevo.id as string;
    }

    const { error: ePlan } = await admin
      .from("ranchos")
      .update({ plan_lealtad: solicitud.plan })
      .eq("id", ranchoId);
    if (ePlan) return { error: "No se pudo asignar el plan: " + ePlan.message };

    const { error: eAddon } = await admin.from("addons_negocio").upsert(
      {
        rancho_id: ranchoId,
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
      // El alta aprobada queda apuntando al rancho que creó: el
      // registro cierra el círculo solicitud → negocio.
      ...(aprobar && !solicitud.rancho_id && ranchoId ? { rancho_id: ranchoId } : {}),
      atendida_por: user?.id ?? null,
      atendida_en: new Date().toISOString(),
    })
    .eq("id", solicitudId);
  if (eSol) return { error: "Quedó activado pero la solicitud no se marcó: " + eSol.message };

  revalidatePath("/admin/complementos");
  if (ranchoId) revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath("/lealtad/panel");
  return { ranchoId: ranchoId ?? undefined };
}
