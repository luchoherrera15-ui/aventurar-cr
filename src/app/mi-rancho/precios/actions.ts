"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guardarPreciosRancho } from "@/lib/precios";
import { guardarCodigosRancho, guardarPromocionesRancho } from "@/lib/descuentos";
import { TERMINOS_MAX } from "../types";

export async function guardarPreciosPropio(
  tiers: { min_invitados: number; max_invitados: number; precio: number }[],
  servicios: {
    nombre: string;
    precio: number;
    requisito_max_invitados: number | null;
    activo: boolean;
  }[],
  tarifaDiciembre: number,
  depositoReserva: number,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!rancho) return { error: "No encontramos tu publicación." };

  return guardarPreciosRancho(
    rancho.id,
    tiers,
    servicios,
    tarifaDiciembre,
    depositoReserva,
  );
}

/**
 * Guarda los términos propios del negocio y su monto mínimo.
 *
 * Una lista vacía significa "usar los que trae la plataforma", así que
 * un proveedor que borra todo vuelve a los de Aventurea en vez de
 * quedarse publicado sin condiciones.
 */
export async function guardarTerminosPropio(
  terminos: string[],
  montoMinimo: number | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const limpios = terminos
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, TERMINOS_MAX);

  if (montoMinimo !== null && (!Number.isFinite(montoMinimo) || montoMinimo < 0)) {
    return { error: "El monto mínimo no puede ser negativo." };
  }

  const { error } = await supabase
    .from("ranchos")
    .update({
      terminos: limpios,
      monto_minimo: montoMinimo && montoMinimo > 0 ? montoMinimo : null,
    })
    .eq("owner_id", user.id);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-rancho/precios");
  revalidatePath("/ranchos-eventos");
  return { error: null };
}

async function propioRanchoId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  return rancho?.id ?? null;
}

export async function guardarCodigosPropio(
  codigos: {
    codigo: string;
    tipo: "porcentaje" | "monto_fijo";
    valor: number;
    activo: boolean;
    usos_maximos: number | null;
    valido_hasta: string | null;
  }[],
) {
  const ranchoId = await propioRanchoId();
  if (!ranchoId) return { error: "No encontramos tu publicación." };
  return guardarCodigosRancho(ranchoId, codigos);
}

export async function guardarPromocionesPropio(
  promociones: {
    dias_semana: number[];
    porcentaje_descuento: number;
    etiqueta: string;
    activo: boolean;
  }[],
) {
  const ranchoId = await propioRanchoId();
  if (!ranchoId) return { error: "No encontramos tu publicación." };
  return guardarPromocionesRancho(ranchoId, promociones);
}
