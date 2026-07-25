"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PrecioTier, ServicioAdicional } from "./types";

export async function guardarConfiguracion(
  tiers: Omit<PrecioTier, "id">[],
  servicios: Omit<ServicioAdicional, "id">[],
  tarifaDiciembre: number,
  depositoReserva: number,
) {
  const supabase = await createClient();

  const { error: errorTiers1 } = await supabase
    .from("precio_tiers")
    .delete()
    .not("id", "is", null);
  if (errorTiers1) return { error: errorTiers1.message };

  if (tiers.length > 0) {
    const { error: errorTiers2 } = await supabase
      .from("precio_tiers")
      .insert(tiers);
    if (errorTiers2) return { error: errorTiers2.message };
  }

  const { error: errorSvc1 } = await supabase
    .from("servicios_adicionales")
    .delete()
    .not("id", "is", null);
  if (errorSvc1) return { error: errorSvc1.message };

  if (servicios.length > 0) {
    const { error: errorSvc2 } = await supabase
      .from("servicios_adicionales")
      .insert(servicios);
    if (errorSvc2) return { error: errorSvc2.message };
  }

  const { error: errorConfig } = await supabase
    .from("configuracion_rancho")
    .update({
      tarifa_diciembre_por_persona: tarifaDiciembre,
      deposito_reserva: depositoReserva,
    })
    .eq("id", true);
  if (errorConfig) return { error: errorConfig.message };

  revalidatePath("/admin/eventos/precios");
  revalidatePath("/eventos-salon");
  return { error: null };
}
