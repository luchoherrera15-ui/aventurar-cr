"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { guardarPreciosRancho } from "@/lib/precios";

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
