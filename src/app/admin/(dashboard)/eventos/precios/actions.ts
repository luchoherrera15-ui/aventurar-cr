"use server";

import { requireAdmin } from "@/lib/auth";
import { guardarPreciosRancho } from "@/lib/precios";
import {
  guardarCodigosRancho,
  guardarPromocionesRancho,
  type PromocionInput,
} from "@/lib/descuentos";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/eventos/constants";
import type { PrecioTier, ServicioAdicional } from "./types";
import type { ModalidadPrecioLugar } from "@/app/mi-negocio/types";

export async function guardarConfiguracion(
  tiers: Omit<PrecioTier, "id">[],
  servicios: Omit<ServicioAdicional, "id">[],
  tarifaDiciembre: number,
  depositoReserva: number,
  modalidadPrecio: ModalidadPrecioLugar,
  precioHora: number | null,
  precioFijo: number | null,
) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id")
    .eq("nombre", NOMBRE_RANCHO_BOOKEAR)
    .maybeSingle();
  if (!rancho) return { error: "No se encontró el rancho de Bookea." };

  return guardarPreciosRancho(
    rancho.id,
    tiers,
    servicios,
    tarifaDiciembre,
    depositoReserva,
    modalidadPrecio,
    precioHora,
    precioFijo,
  );
}

async function ranchoBookearId() {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return null;

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id")
    .eq("nombre", NOMBRE_RANCHO_BOOKEAR)
    .maybeSingle();
  return rancho?.id ?? null;
}

export async function guardarCodigosBookear(
  codigos: {
    codigo: string;
    tipo: "porcentaje" | "monto_fijo";
    valor: number;
    activo: boolean;
    usos_maximos: number | null;
    valido_hasta: string | null;
  }[],
) {
  const ranchoId = await ranchoBookearId();
  if (!ranchoId) return { error: "No se encontró el rancho de Bookea." };
  return guardarCodigosRancho(ranchoId, codigos);
}

export async function guardarPromocionesBookear(
  promociones: PromocionInput[],
) {
  const ranchoId = await ranchoBookearId();
  if (!ranchoId) return { error: "No se encontró el rancho de Bookea." };
  return guardarPromocionesRancho(ranchoId, promociones);
}
