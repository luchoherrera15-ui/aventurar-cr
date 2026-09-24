"use server";

import { revalidatePath } from "next/cache";
import { traducirErrorDeBase } from "@/lib/celebrar/errores-base";
import { PREFIJO_CELEBRAR, RUTA } from "@/lib/celebrar/rutas";
import { validarCelebracion, type Errores } from "@/lib/celebrar/validar-celebracion";
import { createClient } from "@/lib/supabase/server";

export type EstadoEdicion = {
  errores?: Errores;
  mensaje?: string;
  guardado?: boolean;
} | null;

/**
 * Guarda los datos básicos de una celebración. Va con el cliente de la
 * persona: RLS deja pasar solo si es la dueña (`owner_id = auth.uid()`),
 * y el trigger de la base vigila el slug (reservados, históricos).
 * Si RLS no deja pasar, `update` no toca filas y se avisa.
 */
export async function actualizarCelebracion(
  id: string,
  _previo: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const v = validarCelebracion(Object.fromEntries(formData.entries()));
  if (!v.ok) return { errores: v.errores };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_celebraciones")
    .update({
      tipo: v.datos.tipo,
      nombre: v.datos.nombre,
      slug: v.datos.slug,
      fecha: v.datos.fecha || null,
      hora: v.datos.hora || null,
      lugar_nombre: v.datos.lugarNombre || null,
      direccion: v.datos.direccion || null,
      maps_url: v.datos.mapsUrl || null,
    })
    .eq("id", id)
    .select("id");

  if (error) return traducirErrorDeBase(error.message, error.code);
  if (!data || data.length === 0) {
    return { mensaje: "No encontramos esa celebración en tu cuenta." };
  }

  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");
  return { guardado: true };
}

/** Archiva (o vuelve a borrador). Archivar no borra nada: la página deja de estar activa. */
export async function cambiarEstadoCelebracion(id: string, estado: "archivada" | "borrador") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("celebrar_celebraciones")
    .update({ estado })
    .eq("id", id)
    .in("estado", estado === "archivada" ? ["borrador", "publicada", "finalizada", "recuerdos"] : ["archivada"]);
  if (error) throw new Error(error.message);
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");
}
