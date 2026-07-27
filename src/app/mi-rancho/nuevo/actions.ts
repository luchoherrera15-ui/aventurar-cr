"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generarSlugUnico } from "@/lib/slug";
import { CATEGORIAS, PROVINCIAS, SUBCATEGORIAS } from "../types";

export type NuevoRanchoState = { error?: string } | undefined;

export async function crearRancho(
  _prevState: NuevoRanchoState,
  formData: FormData,
): Promise<NuevoRanchoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const categoria = String(formData.get("categoria") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim();
  const provincia = String(formData.get("provincia") || "");
  const canton = String(formData.get("canton") || "").trim();
  const direccionExacta = String(formData.get("direccion_exacta") || "").trim();
  const capacidadMinRaw = String(formData.get("capacidad_min") || "");
  const capacidadMaxRaw = String(formData.get("capacidad_max") || "");
  const precioDesdeRaw = String(formData.get("precio_desde") || "");
  const contacto = String(formData.get("contacto_whatsapp") || "").trim();
  const subcategoria = String(formData.get("subcategoria") || "");

  if (
    !nombre ||
    !(CATEGORIAS as readonly string[]).includes(categoria) ||
    !(PROVINCIAS as readonly string[]).includes(provincia)
  ) {
    return { error: "Completá al menos el tipo de servicio, el nombre y la provincia." };
  }

  const validas = SUBCATEGORIAS[categoria as keyof typeof SUBCATEGORIAS] ?? [];
  if (!validas.some((s) => s.id === subcategoria)) {
    return { error: "Elegí qué ofrecés exactamente dentro de esa categoría." };
  }

  const slug = await generarSlugUnico(supabase, nombre);

  const { data, error } = await supabase
    .from("ranchos")
    .insert({
      owner_id: user.id,
      categoria,
      subcategoria,
      nombre,
      descripcion: descripcion || null,
      provincia,
      canton: canton || null,
      direccion_exacta: direccionExacta || null,
      capacidad_min: capacidadMinRaw ? parseInt(capacidadMinRaw) : null,
      capacidad_max: capacidadMaxRaw ? parseInt(capacidadMaxRaw) : null,
      precio_desde: precioDesdeRaw ? parseFloat(precioDesdeRaw) : null,
      contacto_whatsapp: contacto || null,
      estado: "pendiente",
      slug,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "No se pudo guardar tu rancho: " + error.message };
  }

  // Quien entró como cliente (registro opcional desde el móvil) y publica
  // su primer negocio pasa a dueño de rancho — nunca al revés, y nunca
  // toca una cuenta que ya sea admin.
  await supabase
    .from("perfiles")
    .update({ rol: "dueno_rancho" })
    .eq("id", user.id)
    .eq("rol", "cliente");

  redirect(`/mi-rancho/${data.id}`);
}
