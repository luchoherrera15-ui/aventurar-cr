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

/**
 * Marca o desmarca un negocio como destacado de la portada. Al
 * destacar entra de último entre los destacados (después se puede
 * subir con las flechas); al quitar, vuelve al orden normal.
 * Devuelve los cambios para que la tabla actualice sin recargar.
 */
export async function setDestacado(id: string, destacar: boolean) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  let nuevoOrden: number | null = null;
  if (destacar) {
    const { data } = await supabase
      .from("ranchos")
      .select("destacado_orden")
      .not("destacado_orden", "is", null)
      .order("destacado_orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    nuevoOrden = ((data?.destacado_orden as number | null) ?? 0) + 1;
  }

  const { error } = await supabase
    .from("ranchos")
    .update({ destacado_orden: nuevoOrden })
    .eq("id", id);
  if (error) {
    return {
      error: /destacado_orden/.test(error.message)
        ? "Falta correr la migración en Supabase (supabase/aplicar-migraciones-pendientes.sql)."
        : error.message,
    };
  }

  revalidatePath("/admin/ranchos");
  revalidatePath("/ranchos-eventos");
  return { error: null, cambios: [{ id, destacado_orden: nuevoOrden }] };
}

/** Sube o baja un destacado un puesto, intercambiando con su vecino. */
export async function moverDestacado(id: string, direccion: -1 | 1) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { data } = await supabase
    .from("ranchos")
    .select("id, destacado_orden")
    .not("destacado_orden", "is", null)
    .order("destacado_orden", { ascending: true });

  const lista = (data ?? []) as { id: string; destacado_orden: number }[];
  const i = lista.findIndex((r) => r.id === id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= lista.length) return { error: null, cambios: [] };

  const cambios = [
    { id: lista[i].id, destacado_orden: lista[j].destacado_orden },
    { id: lista[j].id, destacado_orden: lista[i].destacado_orden },
  ];
  for (const c of cambios) {
    const { error } = await supabase
      .from("ranchos")
      .update({ destacado_orden: c.destacado_orden })
      .eq("id", c.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/ranchos");
  revalidatePath("/ranchos-eventos");
  return { error: null, cambios };
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
