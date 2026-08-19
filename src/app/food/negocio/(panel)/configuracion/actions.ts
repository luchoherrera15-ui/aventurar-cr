"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verificarAccesoNegocioFood } from "@/lib/food/auth";

export type EstadoConfig = { error: string | null; ok?: boolean };

export async function guardarNegocio(
  negocioId: string,
  _previo: EstadoConfig,
  formData: FormData,
): Promise<EstadoConfig> {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre no puede quedar vacío." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("food_businesses")
    .update({
      nombre,
      descripcion: String(formData.get("descripcion") ?? "").trim() || null,
      telefono: String(formData.get("telefono") ?? "").trim() || null,
      foto_portada_url: String(formData.get("foto_portada_url") ?? "").trim() || null,
      activo: formData.get("activo") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", negocioId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/food/negocio/configuracion");
  revalidatePath("/food/negocio");
  return { error: null, ok: true };
}

export async function guardarSede(
  negocioId: string,
  sedeId: string,
  _previo: EstadoConfig,
  formData: FormData,
): Promise<EstadoConfig> {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre de la sede no puede quedar vacío." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("food_locations")
    .update({
      nombre,
      direccion: String(formData.get("direccion") ?? "").trim() || null,
      telefono: String(formData.get("telefono") ?? "").trim() || null,
    })
    .eq("id", sedeId)
    .eq("business_id", negocioId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/food/negocio/configuracion");
  return { error: null, ok: true };
}
