"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verificarAccesoRancho } from "@/lib/auth";

/**
 * LAS PROMOS DE UN NEGOCIO.
 *
 * Lo que el negocio escribe acá sale en la pestaña «Promos» de la app,
 * mezclado con las de todos los demás. Es un ANUNCIO, no un descuento
 * de catálogo: eso último vive en `rancho_items.descuento_*` (0186) y
 * sí cambia el precio que se cobra.
 *
 * ── LO QUE NO SE VALIDA ACÁ, Y POR QUÉ ─────────────────────────────
 * Las reglas duras —tope de 90 %, un solo gancho, «antes» mayor que
 * «ahora», fechas en orden— son CHECK de la tabla (migración 0189). No
 * se repiten en TypeScript: dos copias de la misma regla se
 * desincronizan, y la que manda de verdad es la de la base. Lo que sí
 * hace este archivo es traducir el error de Postgres a algo que una
 * persona pueda leer y corregir.
 *
 * ── CADA ACCIÓN VERIFICA POR SU CUENTA ─────────────────────────────
 * `verificarAccesoRancho` en las cuatro. Una server action se invoca
 * por HTTP con su id: que la página que la muestra ya haya verificado
 * no protege nada.
 */

export type EstadoPromo = { error: string | null; ok?: boolean };

/** Traduce el error de la base a algo accionable. */
function traducir(mensaje: string): string {
  if (mensaje.includes("promociones_descuento_check")) {
    return "El descuento tiene que estar entre 1 % y 90 %. Un 100 % es regalado, no rebajado.";
  }
  if (mensaje.includes("promociones_un_solo_gancho")) {
    return "Poné el porcentaje O los dos precios, no las dos cosas: se contradicen.";
  }
  if (mensaje.includes("promociones_precios_coherentes")) {
    return "El precio de antes tiene que ser MAYOR que el de ahora.";
  }
  if (mensaje.includes("promociones_precios_positivos")) {
    return "Los precios no pueden ser negativos.";
  }
  if (mensaje.includes("promociones_fechas_check")) {
    return "La fecha de fin no puede ser anterior a la de inicio.";
  }
  if (mensaje.includes("promociones_titulo_no_vacio")) {
    return "Ponele un título a la promo.";
  }
  if (/promociones/.test(mensaje) && /does not exist|schema cache/i.test(mensaje)) {
    return "Falta correr la migración 0189 en Supabase.";
  }
  return "No se pudo guardar. Revisá los datos e intentá de nuevo.";
}

function texto(f: FormData, campo: string): string | null {
  const v = String(f.get(campo) ?? "").trim();
  return v === "" ? null : v;
}

function entero(f: FormData, campo: string): number | null {
  const v = texto(f, campo);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Los campos del formulario, ya leídos. */
function leer(f: FormData) {
  return {
    titulo: String(f.get("titulo") ?? "").trim(),
    descripcion: texto(f, "descripcion"),
    foto_url: texto(f, "foto_url"),
    // El gancho: la persona elige uno de los dos en la interfaz, y el
    // que no eligió llega vacío. La base rechaza que vengan los dos.
    descuento_porcentaje: entero(f, "descuento_porcentaje"),
    precio_antes: entero(f, "precio_antes"),
    precio_ahora: entero(f, "precio_ahora"),
    desde: texto(f, "desde"),
    hasta: texto(f, "hasta"),
    activa: f.get("activa") === "on" || f.get("activa") === "true",
  };
}

export async function crearPromo(
  ranchoId: string,
  _previo: EstadoPromo,
  formData: FormData,
): Promise<EstadoPromo> {
  const { ok } = await verificarAccesoRancho(ranchoId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const datos = leer(formData);
  if (datos.titulo === "") return { error: "Ponele un título a la promo." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("promociones")
    // `rancho_id` del parámetro ya verificado, nunca del formulario:
    // si viniera del navegador, alguien podría publicar una promo en
    // el negocio de otro.
    .insert({ ...datos, rancho_id: ranchoId });

  if (error) return { error: traducir(error.message) };

  revalidatePath(`/mi-negocio/${ranchoId}/promos`);
  return { error: null, ok: true };
}

export async function editarPromo(
  ranchoId: string,
  promoId: string,
  _previo: EstadoPromo,
  formData: FormData,
): Promise<EstadoPromo> {
  const { ok } = await verificarAccesoRancho(ranchoId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const datos = leer(formData);
  if (datos.titulo === "") return { error: "Ponele un título a la promo." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("promociones")
    .update({ ...datos, actualizado_en: new Date().toISOString() })
    .eq("id", promoId)
    // Cinturón sobre la RLS: la política ya lo impide, pero dejarlo
    // explícito evita que un cambio futuro en las políticas convierta
    // esto en un update sobre la promo de otro negocio.
    .eq("rancho_id", ranchoId);

  if (error) return { error: traducir(error.message) };

  revalidatePath(`/mi-negocio/${ranchoId}/promos`);
  return { error: null, ok: true };
}

/** Prender o apagar sin perder el texto. */
export async function alternarPromo(
  ranchoId: string,
  promoId: string,
  activa: boolean,
): Promise<EstadoPromo> {
  const { ok } = await verificarAccesoRancho(ranchoId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("promociones")
    .update({ activa, actualizado_en: new Date().toISOString() })
    .eq("id", promoId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: traducir(error.message) };

  revalidatePath(`/mi-negocio/${ranchoId}/promos`);
  return { error: null, ok: true };
}

export async function borrarPromo(
  ranchoId: string,
  promoId: string,
): Promise<EstadoPromo> {
  const { ok } = await verificarAccesoRancho(ranchoId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("promociones")
    .delete()
    .eq("id", promoId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: traducir(error.message) };

  revalidatePath(`/mi-negocio/${ranchoId}/promos`);
  return { error: null, ok: true };
}
