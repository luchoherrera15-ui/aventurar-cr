"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { esPlan } from "@/lib/lealtad/planes";
import { finDePrueba } from "@/lib/lealtad/prueba";
import { crearNegocioDesdeSolicitud } from "@/lib/lealtad/alta-desde-solicitud";
import { abrirHiloDeAyudaDesdeAlta } from "@/lib/lealtad/ayuda-hilo";

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

  // ACÁ SÍ VA `esPlan` (todos, retirados incluidos) Y NO `esPlanOfrecido`.
  //
  // Las puertas del cliente —/lealtad/nuevo y /lealtad/planes— validan
  // contra los OFRECIDOS: nadie puede ELEGIRSE un paquete retirado y
  // llevarse `SIN_TOPES`. Esta es otra cosa: es la mesa de control de
  // Bookea, detrás de `requireAdmin`, y es el único lugar donde se
  // puede corregir a mano la fila de un negocio que YA tiene «Básico»
  // o «Empresa» — si acá solo entraran los cuatro vigentes, arreglar
  // un dato de esas cuentas obligaría a degradarlas, que es justo lo
  // que la separación ofrecidos/retirados existe para impedir.
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
      // El alta la arma `crearNegocioDesdeSolicitud`, que es la MISMA
      // función que usa el webhook de Stripe cuando el cobro con tarjeta
      // entra sin negocio (src/lib/pagos/puerta-supabase.ts). Dos
      // caminos que crean negocios se desincronizan; uno solo, no.
      const alta = await crearNegocioDesdeSolicitud(admin, solicitud, {
        aprobadoPor: user?.id ?? null,
        // El plan se escribe abajo, junto con el caso del upgrade.
        plan: null,
      });
      if (!alta.ok) return { error: alta.motivo };
      ranchoId = alta.ranchoId;
    }

    const { error: ePlan } = await admin
      .from("ranchos")
      .update({ plan_lealtad: solicitud.plan })
      .eq("id", ranchoId);
    if (ePlan) return { error: "No se pudo asignar el plan: " + ePlan.message };

    // Si el complemento existía VENCIDO, `activo: true` solo no alcanza
    // — `estadoDeAddon` lo seguiría dando por muerto. Aprobar es empezar
    // de nuevo, con fecha fresca.
    //
    // Y el vencimiento sale del PAQUETE, no de un `null` fijo: aprobar
    // una solicitud de «Prueba» a mano le daba 14 días prometidos y cero
    // días de corte, o sea el mismo agujero que tenía el alta automática
    // pero por la puerta del admin. Un paquete de pago sigue dando
    // `null` — no vence por tiempo.
    const corte = finDePrueba(solicitud.plan as string | null);
    const { error: eAddon } = await admin.from("addons_negocio").upsert(
      {
        rancho_id: ranchoId,
        addon: "lealtad",
        activo: true,
        vence_en: corte,
        activado_en: new Date().toISOString(),
        notas: corte
          ? `Solicitud aprobada (plan ${solicitud.plan}) — prueba hasta ${corte.slice(0, 10)}`
          : `Solicitud aprobada (plan ${solicitud.plan})`,
      },
      { onConflict: "rancho_id,addon" },
    );
    if (eAddon) return { error: "El plan quedó, pero el complemento no: " + eAddon.message };

    // ── «CREAR PERSONALIZADO»: QUE LA CONVERSACIÓN SIGA (0149) ──────
    // Hasta acá, aprobar un alta personalizada creaba el negocio y
    // dejaba lo que la persona había escrito enterrado en esta fila,
    // ya marcada como atendida: el equipo no tenía dónde contestarle y
    // ella no tenía dónde leer la respuesta. Ahora ese texto se
    // convierte en el primer mensaje de su hilo de ayuda con el diseño,
    // que es el mismo bloque que ve cualquier otro dueño en el creador.
    //
    // No reemplaza el camino del alta —ese sigue igual— lo continúa.
    if (solicitud.personalizado === true && ranchoId) {
      const nombre =
        ((solicitud.negocio_nombre as string | null) ?? "").trim() ||
        ((await admin.from("ranchos").select("nombre").eq("id", ranchoId).maybeSingle()).data
          ?.nombre as string | null) ||
        "";
      await abrirHiloDeAyudaDesdeAlta(admin, {
        ranchoId,
        solicitanteId: solicitud.solicitante_id as string,
        negocioNombre: nombre,
        pedido: (solicitud.mensaje as string | null) ?? "",
      });
    }
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
