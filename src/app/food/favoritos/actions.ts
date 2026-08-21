"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoFavoritoFood = { ok: true; favorito: boolean } | { ok: false; error: string };

/**
 * ALTERNAR UN FAVORITO DE FOOD (0201).
 *
 * Sin service_role ni RPC: a diferencia de reservar (donde el cupo y
 * el descuento no se le pueden confiar al navegador), acá el único
 * dato en juego es "¿esta persona marcó este negocio?" — la RLS de
 * food_favoritos (customer_id = auth.uid()) ya es la única regla que
 * hace falta, así que el cliente autenticado escribe directo.
 *
 * `revalidatePath` en vez de solo devolver el nuevo estado: el corazón
 * en la card usa el valor optimista de inmediato, pero /food/favoritos
 * (la lista completa) necesita refrescarse si alguien saca un favorito
 * estando parado ahí.
 */
export async function alternarFavoritoFood(businessId: string): Promise<EstadoFavoritoFood> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Iniciá sesión para guardar favoritos." };

  const { data: existente, error: errLectura } = await supabase
    .from("food_favoritos")
    .select("id")
    .eq("customer_id", user.id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (errLectura) return { ok: false, error: "No se pudo leer tus favoritos: " + errLectura.message };

  if (existente) {
    const { error } = await supabase.from("food_favoritos").delete().eq("id", existente.id);
    if (error) return { ok: false, error: "No se pudo quitar: " + error.message };
    revalidatePath("/food/favoritos");
    return { ok: true, favorito: false };
  }

  const { error } = await supabase
    .from("food_favoritos")
    .insert({ customer_id: user.id, business_id: businessId });
  if (error) return { ok: false, error: "No se pudo guardar: " + error.message };
  revalidatePath("/food/favoritos");
  return { ok: true, favorito: true };
}
