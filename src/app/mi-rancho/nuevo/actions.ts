"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROVINCIAS } from "../types";

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

  const nombre = String(formData.get("nombre") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim();
  const provincia = String(formData.get("provincia") || "");
  const canton = String(formData.get("canton") || "").trim();
  const capacidadMinRaw = String(formData.get("capacidad_min") || "");
  const capacidadMaxRaw = String(formData.get("capacidad_max") || "");
  const precioDesdeRaw = String(formData.get("precio_desde") || "");
  const contacto = String(formData.get("contacto_whatsapp") || "").trim();

  if (!nombre || !(PROVINCIAS as readonly string[]).includes(provincia)) {
    return { error: "Completá al menos el nombre y la provincia." };
  }

  const { error } = await supabase.from("ranchos").insert({
    owner_id: user.id,
    nombre,
    descripcion: descripcion || null,
    provincia,
    canton: canton || null,
    capacidad_min: capacidadMinRaw ? parseInt(capacidadMinRaw) : null,
    capacidad_max: capacidadMaxRaw ? parseInt(capacidadMaxRaw) : null,
    precio_desde: precioDesdeRaw ? parseFloat(precioDesdeRaw) : null,
    contacto_whatsapp: contacto || null,
    estado: "pendiente",
  });

  if (error) {
    return { error: "No se pudo guardar tu rancho: " + error.message };
  }

  redirect("/mi-rancho");
}
