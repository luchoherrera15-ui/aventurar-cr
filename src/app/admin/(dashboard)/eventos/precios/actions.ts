"use server";

import { requireAdmin } from "@/lib/auth";
import { guardarPreciosRancho } from "@/lib/precios";
import { NOMBRE_RANCHO_AVENTUREA } from "@/app/ranchos-eventos/constants";
import type { PrecioTier, ServicioAdicional } from "./types";

export async function guardarConfiguracion(
  tiers: Omit<PrecioTier, "id">[],
  servicios: Omit<ServicioAdicional, "id">[],
  tarifaDiciembre: number,
  depositoReserva: number,
) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id")
    .eq("nombre", NOMBRE_RANCHO_AVENTUREA)
    .maybeSingle();
  if (!rancho) return { error: "No se encontró el rancho de Aventurea CR." };

  return guardarPreciosRancho(
    rancho.id,
    tiers,
    servicios,
    tarifaDiciembre,
    depositoReserva,
  );
}
