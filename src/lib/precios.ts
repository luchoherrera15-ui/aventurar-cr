import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ModalidadPrecioLugar } from "@/app/mi-negocio/types";

type TierInput = {
  min_invitados: number;
  max_invitados: number;
  precio: number;
  /** 'diciembre' = el rango solo aplica en ese mes (0099). */
  temporada?: "normal" | "diciembre" | null;
};
type ServicioInput = {
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
  activo: boolean;
};

/**
 * Reemplaza los rangos de precio y servicios adicionales de UN rancho
 * (nunca de todos), y guarda su depósito fijo, tarifa de diciembre y
 * modalidad de cobro. Las políticas de seguridad ya impiden tocar el
 * rancho de otra persona; esto solo agrega mensajes de error legibles.
 */
export async function guardarPreciosRancho(
  ranchoId: string,
  tiers: TierInput[],
  servicios: ServicioInput[],
  tarifaDiciembre: number,
  depositoReserva: number,
  modalidadPrecio: ModalidadPrecioLugar,
  precioHora: number | null,
  precioFijo: number | null,
) {
  const supabase = await createClient();

  const { error: errorTiers1 } = await supabase
    .from("precio_tiers")
    .delete()
    .eq("rancho_id", ranchoId);
  if (errorTiers1) return { error: errorTiers1.message };

  if (tiers.length > 0) {
    const { error } = await supabase.from("precio_tiers").insert(
      tiers.map((t) => ({
        min_invitados: t.min_invitados,
        max_invitados: t.max_invitados,
        precio: t.precio,
        // Sin temporada no se manda la columna: el default 'normal' de
        // la base la pone, y en bases sin la 0099 el insert no truena.
        ...(t.temporada ? { temporada: t.temporada } : {}),
        rancho_id: ranchoId,
      })),
    );
    if (error) return { error: error.message };
  }

  const { error: errorSvc1 } = await supabase
    .from("servicios_adicionales")
    .delete()
    .eq("rancho_id", ranchoId);
  if (errorSvc1) return { error: errorSvc1.message };

  if (servicios.length > 0) {
    const { error } = await supabase
      .from("servicios_adicionales")
      .insert(servicios.map((s) => ({ ...s, rancho_id: ranchoId })));
    if (error) return { error: error.message };
  }

  const { error: errorRancho } = await supabase
    .from("ranchos")
    .update({
      tarifa_diciembre_por_persona: tarifaDiciembre,
      deposito_reserva: depositoReserva,
      modalidad_precio_lugar: modalidadPrecio,
      precio_hora_lugar: precioHora,
      precio_fijo_lugar: precioFijo,
    })
    .eq("id", ranchoId);
  if (errorRancho) return { error: errorRancho.message };

  revalidatePath("/admin/eventos/precios");
  revalidatePath("/mi-negocio", "layout");
  revalidatePath("/eventos");
  return { error: null };
}
