"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { esAddon } from "@/lib/addons";

/**
 * Encender y apagar los complementos de pago de cada negocio.
 *
 * Todo esto va con la llave de servicio a propósito: `addons_negocio`
 * (0077) NO tiene política de escritura para `authenticated`, así que
 * la RLS niega por defecto y un dueño no puede regalarse un complemento
 * desde el navegador aunque encuentre el endpoint. La única puerta es
 * ésta, y requiere sesión de admin.
 *
 * Mientras no exista la pasarela de pago, este panel ES el cobro: se
 * activa a mano cuando el negocio paga, y la nota guarda por qué.
 */

/** Refresca el panel y las pantallas cuyo contenido depende del gate. */
function refrescar(ranchoId: string) {
  revalidatePath("/admin/complementos");
  // El asistente vive plegado en la página unificada (Configuración),
  // no en la ruta /asistente vieja (hoy solo un redirect stub).
  revalidatePath(`/mi-rancho/${ranchoId}`);
}

export async function activarAddon({
  ranchoId,
  addon,
  meses,
  notas,
}: {
  ranchoId: string;
  addon: string;
  /** Meses de vigencia; null = sin vencimiento. */
  meses: number | null;
  notas: string;
}) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  if (!esAddon(addon)) return { error: "Ese complemento no existe." };
  if (meses !== null && (!Number.isFinite(meses) || meses < 1 || meses > 60)) {
    return { error: "Esa duración no es válida." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  // La fecha se calcula acá y no en la base para que el panel muestre
  // exactamente lo que se guardó, sin depender de la zona del servidor.
  let venceEn: string | null = null;
  if (meses !== null) {
    const fin = new Date();
    fin.setMonth(fin.getMonth() + meses);
    venceEn = fin.toISOString();
  }

  const { error } = await admin.from("addons_negocio").upsert(
    {
      rancho_id: ranchoId,
      addon,
      activo: true,
      vence_en: venceEn,
      notas: notas.trim().slice(0, 300) || null,
      activado_en: new Date().toISOString(),
    },
    // Hay un unique (rancho_id, addon): reactivar pisa la fila anterior
    // en vez de crear una segunda.
    { onConflict: "rancho_id,addon" },
  );

  if (error) {
    if (error.message?.includes("addons_negocio_addon_check")) {
      return {
        error:
          "La base todavía no acepta ese complemento — falta correr la migración que lo agrega.",
      };
    }
    return { error: error.message };
  }

  refrescar(ranchoId);
  return { error: null };
}

export async function desactivarAddon(ranchoId: string, addon: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };
  if (!esAddon(addon)) return { error: "Ese complemento no existe." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  // Se apaga, no se borra: la fila es el historial de que alguna vez lo
  // tuvo, con su nota y su fecha de activación.
  const { error } = await admin
    .from("addons_negocio")
    .update({ activo: false })
    .eq("rancho_id", ranchoId)
    .eq("addon", addon);

  if (error) return { error: error.message };

  refrescar(ranchoId);
  return { error: null };
}
