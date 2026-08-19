"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generarSlugFoodUnico } from "@/lib/food/slug";

export type EstadoNuevoNegocioFood = { error: string | null };

export async function crearNegocioFood(
  _previo: EstadoNuevoNegocioFood,
  formData: FormData,
): Promise<EstadoNuevoNegocioFood> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/food/negocio/login");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const fotoPortadaUrl = String(formData.get("foto_portada_url") ?? "").trim() || null;
  const sedeNombre = String(formData.get("sede_nombre") ?? "").trim() || "Sede principal";
  const sedeDireccion = String(formData.get("sede_direccion") ?? "").trim() || null;

  if (!nombre) return { error: "Ponele un nombre a tu restaurante." };

  const slug = await generarSlugFoodUnico(supabase, nombre);

  const { data: negocio, error: negErr } = await supabase
    .from("food_businesses")
    .insert({
      owner_id: user.id,
      nombre,
      slug,
      descripcion,
      telefono,
      foto_portada_url: fotoPortadaUrl,
    })
    .select("id")
    .single();

  if (negErr) return { error: "No se pudo crear el negocio: " + negErr.message };

  const { error: sedeErr } = await supabase
    .from("food_locations")
    .insert({ business_id: negocio.id, nombre: sedeNombre, direccion: sedeDireccion });

  if (sedeErr) return { error: "El negocio se creó pero falló la sede: " + sedeErr.message };

  redirect("/food/negocio");
}
