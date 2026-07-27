"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TipoSeccionHome } from "@/app/mi-rancho/types";

export type SeccionFormState = { error?: string } | undefined;

function limpiarOpcional(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function datosDeFormulario(formData: FormData) {
  const tipo = String(formData.get("tipo") || "") as TipoSeccionHome;
  const titulo = String(formData.get("titulo") || "").trim();
  const subtitulo = limpiarOpcional(formData.get("subtitulo"));
  const orden = parseInt(String(formData.get("orden") || "0"), 10) || 0;

  const base = {
    tipo,
    titulo,
    subtitulo,
    orden,
    categoria: null as string | null,
    subcategoria: null as string | null,
    provincia: null as string | null,
    canton: null as string | null,
    rancho_ids: null as string[] | null,
  };

  if (tipo === "categoria") {
    base.categoria = limpiarOpcional(formData.get("categoria"));
    base.subcategoria = limpiarOpcional(formData.get("subcategoria"));
  } else if (tipo === "ubicacion") {
    base.provincia = limpiarOpcional(formData.get("provincia"));
    base.canton = limpiarOpcional(formData.get("canton"));
  } else if (tipo === "manual") {
    base.rancho_ids = formData.getAll("rancho_ids").map(String).filter(Boolean);
  }

  return { titulo, base };
}

export async function crearSeccion(
  _prevState: SeccionFormState,
  formData: FormData,
): Promise<SeccionFormState> {
  const { titulo, base } = datosDeFormulario(formData);
  if (!titulo) return { error: "El título es obligatorio." };
  if (base.tipo === "categoria" && !base.categoria) {
    return { error: "Elegí una categoría." };
  }
  if (base.tipo === "ubicacion" && !base.provincia) {
    return { error: "Elegí una provincia." };
  }
  if (base.tipo === "manual" && (!base.rancho_ids || base.rancho_ids.length === 0)) {
    return { error: "Agregá al menos un proveedor a la lista." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("home_secciones").insert(base);
  if (error) return { error: error.message };

  revalidatePath("/admin/portada");
  revalidatePath("/");
  return undefined;
}

export async function actualizarSeccion(id: string, formData: FormData): Promise<SeccionFormState> {
  const { titulo, base } = datosDeFormulario(formData);
  if (!titulo) return { error: "El título es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase.from("home_secciones").update(base).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/portada");
  revalidatePath("/");
  return undefined;
}

export async function alternarActivo(id: string, activo: boolean) {
  const supabase = await createClient();
  await supabase.from("home_secciones").update({ activo }).eq("id", id);
  revalidatePath("/admin/portada");
  revalidatePath("/");
}

export async function eliminarSeccion(id: string) {
  const supabase = await createClient();
  await supabase.from("home_secciones").delete().eq("id", id);
  revalidatePath("/admin/portada");
  revalidatePath("/");
}
