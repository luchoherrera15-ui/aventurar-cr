"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verificarAccesoNegocioFood } from "@/lib/food/auth";

export type EstadoMenu = { error: string | null; ok?: boolean };

export async function crearCategoria(
  negocioId: string,
  _previo: EstadoMenu,
  formData: FormData,
): Promise<EstadoMenu> {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "Ponele un nombre a la categoría." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("food_menu_categories")
    .select("id", { count: "exact", head: true })
    .eq("business_id", negocioId);

  const { error } = await supabase
    .from("food_menu_categories")
    .insert({ business_id: negocioId, nombre, orden: count ?? 0 });

  if (error) return { error: "No se pudo crear: " + error.message };

  revalidatePath("/food/negocio/menu");
  return { error: null, ok: true };
}

export async function borrarCategoria(negocioId: string, categoriaId: string) {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("food_menu_categories")
    .delete()
    .eq("id", categoriaId)
    .eq("business_id", negocioId);

  if (error) return { error: "No se pudo borrar: " + error.message };

  revalidatePath("/food/negocio/menu");
  return { error: null, ok: true };
}

export async function crearItem(
  negocioId: string,
  _previo: EstadoMenu,
  formData: FormData,
): Promise<EstadoMenu> {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const categoryId = String(formData.get("category_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const precio = Number(formData.get("precio") ?? 0);
  const fotoUrl = String(formData.get("foto_url") ?? "").trim() || null;

  if (!categoryId) return { error: "Elegí una categoría." };
  if (!nombre) return { error: "Ponele un nombre al plato." };
  if (!Number.isFinite(precio) || precio < 0) return { error: "El precio no es válido." };

  const supabase = await createClient();
  const { error } = await supabase.from("food_menu_items").insert({
    business_id: negocioId,
    category_id: categoryId,
    nombre,
    descripcion,
    precio: Math.round(precio),
    foto_url: fotoUrl,
  });

  if (error) return { error: "No se pudo crear: " + error.message };

  revalidatePath("/food/negocio/menu");
  return { error: null, ok: true };
}

export async function alternarItem(negocioId: string, itemId: string, activo: boolean) {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("food_menu_items")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("business_id", negocioId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/food/negocio/menu");
  return { error: null, ok: true };
}

export async function borrarItem(negocioId: string, itemId: string) {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("food_menu_items")
    .delete()
    .eq("id", itemId)
    .eq("business_id", negocioId);

  if (error) return { error: "No se pudo borrar: " + error.message };

  revalidatePath("/food/negocio/menu");
  return { error: null, ok: true };
}
