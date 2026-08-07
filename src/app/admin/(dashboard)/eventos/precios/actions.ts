"use server";

import { requireAdmin } from "@/lib/auth";
import { guardarPreciosRancho } from "@/lib/precios";
import {
  guardarCodigosRancho,
  guardarPromocionesRancho,
  type PromocionInput,
} from "@/lib/descuentos";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/eventos/constants";
import type { GuardarPreciosInput } from "@/app/mi-negocio/types";

/**
 * El rancho que el admin está editando: el elegido en el selector de
 * la página, o el de la casa si no eligió ninguno. La política de la
 * base ya deja al admin escribir cualquier rancho (is_admin() en la
 * policy de update, 0008); acá solo se resuelve CUÁL.
 */
async function ranchoAEditar(ranchoId: string | null) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return null;

  if (ranchoId) {
    const { data } = await supabase
      .from("ranchos")
      .select("id")
      .eq("id", ranchoId)
      .maybeSingle();
    return data?.id ?? null;
  }
  const { data } = await supabase
    .from("ranchos")
    .select("id")
    .eq("nombre", NOMBRE_RANCHO_BOOKEAR)
    .maybeSingle();
  return data?.id ?? null;
}

export async function guardarConfiguracion(
  ranchoId: string | null,
  precios: GuardarPreciosInput,
) {
  const id = await ranchoAEditar(ranchoId);
  if (!id) return { error: "No se encontró ese negocio (o no tenés permiso)." };
  return guardarPreciosRancho(id, precios);
}

export async function guardarCodigosBookear(
  ranchoId: string | null,
  codigos: {
    codigo: string;
    tipo: "porcentaje" | "monto_fijo";
    valor: number;
    activo: boolean;
    usos_maximos: number | null;
    valido_hasta: string | null;
  }[],
) {
  const id = await ranchoAEditar(ranchoId);
  if (!id) return { error: "No se encontró ese negocio (o no tenés permiso)." };
  return guardarCodigosRancho(id, codigos);
}

export async function guardarPromocionesBookear(
  ranchoId: string | null,
  promociones: PromocionInput[],
) {
  const id = await ranchoAEditar(ranchoId);
  if (!id) return { error: "No se encontró ese negocio (o no tenés permiso)." };
  return guardarPromocionesRancho(id, promociones);
}
