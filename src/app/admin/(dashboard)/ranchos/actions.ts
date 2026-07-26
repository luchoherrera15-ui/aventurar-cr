"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { EstadoRancho } from "@/app/mi-rancho/types";

export async function setEstadoRancho(id: string, estado: EstadoRancho) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase
    .from("ranchos")
    .update({ estado })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/ranchos");
  revalidatePath("/ranchos-eventos");
  return { error: null };
}

export async function borrarRancho(id: string) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase.from("ranchos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/ranchos");
  revalidatePath("/ranchos-eventos");
  return { error: null };
}
