"use server";

import { requireAdmin } from "@/lib/auth";
import { guardarPreciosRancho } from "@/lib/precios";
import { guardarCodigosRancho, guardarPromocionesRancho } from "@/lib/descuentos";
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

async function ranchoAventureaId() {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return null;

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id")
    .eq("nombre", NOMBRE_RANCHO_AVENTUREA)
    .maybeSingle();
  return rancho?.id ?? null;
}

export async function guardarCodigosAventurea(
  codigos: {
    codigo: string;
    tipo: "porcentaje" | "monto_fijo";
    valor: number;
    activo: boolean;
    usos_maximos: number | null;
    valido_hasta: string | null;
  }[],
) {
  const ranchoId = await ranchoAventureaId();
  if (!ranchoId) return { error: "No se encontró el rancho de Aventurea CR." };
  return guardarCodigosRancho(ranchoId, codigos);
}

export async function guardarPromocionesAventurea(
  promociones: {
    dias_semana: number[];
    porcentaje_descuento: number;
    etiqueta: string;
    activo: boolean;
  }[],
) {
  const ranchoId = await ranchoAventureaId();
  if (!ranchoId) return { error: "No se encontró el rancho de Aventurea CR." };
  return guardarPromocionesRancho(ranchoId, promociones);
}
