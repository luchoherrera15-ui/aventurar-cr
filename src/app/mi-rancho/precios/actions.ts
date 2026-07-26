"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { guardarPreciosRancho } from "@/lib/precios";
import { guardarCodigosRancho, guardarPromocionesRancho } from "@/lib/descuentos";

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
