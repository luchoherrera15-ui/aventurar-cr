"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RanchoItem } from "../types";

/**
 * CRUD del catálogo (menú/paquetes/productos) de un negocio. Las
 * políticas de la base ya limitan todo al dueño del rancho; acá se
 * validan los datos y se refresca la página.
 */

type Resultado = { error?: string; item?: RanchoItem };

function validar(nombre: string, precio: number | null) {
  if (!nombre || nombre.length > 120) {
    return "El nombre es obligatorio (máximo 120 caracteres).";
  }
  if (precio !== null && (!Number.isFinite(precio) || precio < 0)) {
    return "El precio no puede ser negativo.";
  }
  return null;
}

export async function crearItemCatalogo(
  ranchoId: string,
  datos: { nombre: string; descripcion: string; precio: number | null; unidad: string },
): Promise<Resultado> {
  const nombre = datos.nombre.trim();
  const invalido = validar(nombre, datos.precio);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rancho_items")
    .insert({
      rancho_id: ranchoId,
      nombre,
      descripcion: datos.descripcion.trim() || null,
      precio: datos.precio,
      unidad: datos.unidad.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    // El caso típico: la migración 0035 todavía no se corrió.
    if (/rancho_items/.test(error.message)) {
      return {
        error:
          "Falta correr la migración en Supabase (supabase/aplicar-migraciones-pendientes.sql).",
      };
    }
    return { error: "No se pudo guardar: " + error.message };
  }

  revalidatePath(`/mi-rancho/${ranchoId}`);
  return { item: data as RanchoItem };
}

export async function actualizarItemCatalogo(
  ranchoId: string,
  itemId: string,
  datos: { nombre: string; descripcion: string; precio: number | null; unidad: string; activo: boolean },
): Promise<Resultado> {
  const nombre = datos.nombre.trim();
  const invalido = validar(nombre, datos.precio);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rancho_items")
    .update({
      nombre,
      descripcion: datos.descripcion.trim() || null,
      precio: datos.precio,
      unidad: datos.unidad.trim() || null,
      activo: datos.activo,
    })
    .eq("id", itemId)
    .eq("rancho_id", ranchoId)
    .select("*")
    .single();

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath(`/mi-rancho/${ranchoId}`);
  return { item: data as RanchoItem };
}

export async function eliminarItemCatalogo(
  ranchoId: string,
  itemId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rancho_items")
    .delete()
    .eq("id", itemId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo borrar: " + error.message };

  revalidatePath(`/mi-rancho/${ranchoId}`);
  return {};
}
