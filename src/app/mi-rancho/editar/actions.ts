"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS, PROVINCIAS, TIPOS_LUGAR } from "../types";

export type EditarRanchoState = { error?: string; ok?: boolean } | undefined;

export async function actualizarRancho(
  _prevState: EditarRanchoState,
  formData: FormData,
): Promise<EditarRanchoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const categoria = String(formData.get("categoria") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const provincia = String(formData.get("provincia") || "");

  if (
    !nombre ||
    !(CATEGORIAS as readonly string[]).includes(categoria) ||
    !(PROVINCIAS as readonly string[]).includes(provincia)
  ) {
    return { error: "Completá al menos el tipo de servicio, el nombre y la provincia." };
  }

  const tipoLugarRaw = String(formData.get("tipo_lugar") || "");
  if (categoria === "salon" && !(TIPOS_LUGAR as readonly string[]).includes(tipoLugarRaw)) {
    return { error: "Elegí qué tipo de lugar es tu salón." };
  }

  const num = (campo: string) => {
    const v = String(formData.get(campo) || "");
    return v ? Number(v) : null;
  };
  const texto = (campo: string) => String(formData.get(campo) || "").trim() || null;

  const fotoUrl = String(formData.get("foto_url") || "");

  const update: Record<string, unknown> = {
    categoria,
    tipo_lugar: categoria === "salon" ? tipoLugarRaw : null,
    nombre,
    descripcion: texto("descripcion"),
    provincia,
    canton: texto("canton"),
    direccion_exacta: texto("direccion_exacta"),
    capacidad_min: num("capacidad_min"),
    capacidad_max: num("capacidad_max"),
    precio_desde: num("precio_desde"),
    contacto_whatsapp: texto("contacto_whatsapp"),
  };
  if (fotoUrl) update.foto_url = fotoUrl;

  const { error } = await supabase
    .from("ranchos")
    .update(update)
    .eq("owner_id", user.id);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-rancho");
  revalidatePath("/ranchos-eventos");
  return { ok: true };
}
