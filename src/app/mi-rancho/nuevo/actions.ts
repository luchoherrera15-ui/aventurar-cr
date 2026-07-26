"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS, PROVINCIAS, TIPOS_LUGAR } from "../types";

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
  const tipoLugarRaw = String(formData.get("tipo_lugar") || "");

  if (
    !nombre ||
    !(CATEGORIAS as readonly string[]).includes(categoria) ||
    !(PROVINCIAS as readonly string[]).includes(provincia)
  ) {
    return { error: "Completá al menos el tipo de servicio, el nombre y la provincia." };
  }

  if (categoria === "salon" && !(TIPOS_LUGAR as readonly string[]).includes(tipoLugarRaw)) {
    return { error: "Elegí qué tipo de lugar es tu salón." };
  }

  const { error } = await supabase.from("ranchos").insert({
    owner_id: user.id,
    categoria,
    tipo_lugar: categoria === "salon" ? tipoLugarRaw : null,
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
  });

  if (error) {
    return { error: "No se pudo guardar tu rancho: " + error.message };
  }

  redirect("/mi-rancho");
}
