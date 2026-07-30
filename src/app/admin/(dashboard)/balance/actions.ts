"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export async function guardarComision(comisionPorPersona: number) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase
    .from("configuracion_plataforma")
    .update({ comision_por_persona: comisionPorPersona })
    .eq("id", true);

  if (error) return { error: error.message };

  revalidatePath("/admin/balance");
  return { error: null };
}

export type NuevoGasto = {
  concepto: string;
  categoria: string;
  monto: number;
  recurrencia: string;
  fecha: string;
  notas: string | null;
  /** Sección del gasto; null = general de la plataforma. */
  vertical: string | null;
};

export async function agregarGasto(gasto: NuevoGasto) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", id: null };

  // La columna `vertical` llega con la migración 0065: mandarla solo
  // cuando trae valor deja funcionando los gastos generales aunque la
  // migración todavía no se haya corrido.
  const { vertical, ...resto } = gasto;
  const payload: Record<string, string | number | null> = { ...resto };
  if (vertical) payload.vertical = vertical;
  const { data, error } = await supabase
    .from("gastos")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };

  revalidatePath("/admin/balance");
  return { error: null, id: data.id as string };
}

export async function borrarGasto(id: string) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/balance");
  return { error: null };
}
