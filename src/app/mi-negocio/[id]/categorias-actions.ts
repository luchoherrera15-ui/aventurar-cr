"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Las secciones del catálogo (categorias_negocio, 0119). La tabla
 * guarda SOLO el orden: el ítem sigue apuntando a su sección por
 * nombre en `rancho_items.grupo`. Una sección sin fila acá funciona
 * igual que siempre, solo que sin orden explícito.
 *
 * Las políticas de la base ya limitan todo a quien administra el
 * negocio (`gestiona_rancho()`, 0116) — acá se validan los datos y se
 * refresca la página.
 */

export type CategoriaNegocio = {
  id: string;
  rancho_id: string;
  nombre: string;
  orden: number;
  created_at: string;
};

type Resultado = { error?: string; categoria?: CategoriaNegocio };

/** Mismo límite que rancho_items_grupo_check (0050): si acá cupiera un
 *  nombre que allá no, renombrar dejaría ítems huérfanos. */
function validarNombre(nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) return "Escribí el nombre de la sección.";
  if (limpio.length > 40) return "El nombre es muy largo (máximo 40 caracteres).";
  return null;
}

function esDuplicado(mensaje: string) {
  return mensaje.includes("categorias_negocio_nombre_idx") || mensaje.includes("duplicate");
}

const igualSinMayusculas = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Que el mensaje nombre la tabla no alcanza: una negativa de RLS
 * también la nombra, y decirle al dueño "falta correr la migración"
 * cuando en realidad no tiene permiso lo manda a buscar donde no es.
 * Se pide además la señal de que la tabla no existe.
 */
function faltaLaTabla(mensaje: string) {
  if (!mensaje.includes("categorias_negocio")) return false;
  return (
    mensaje.includes("does not exist") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("Could not find")
  );
}

export async function crearCategoria(
  ranchoId: string,
  nombre: string,
): Promise<Resultado> {
  const invalido = validarNombre(nombre);
  if (invalido) return { error: invalido };

  const supabase = await createClient();

  // La nueva va al final. Se lee el máximo en vez de contar, para que
  // borrar una del medio no genere dos con el mismo `orden`.
  const { data: ultima } = await supabase
    .from("categorias_negocio")
    .select("orden")
    .eq("rancho_id", ranchoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("categorias_negocio")
    .insert({
      rancho_id: ranchoId,
      nombre: nombre.trim(),
      orden: (ultima?.orden ?? 0) + 1,
    })
    .select("*")
    .single();

  if (error) {
    if (esDuplicado(error.message)) return { error: "Ya tenés una sección con ese nombre." };
    if (faltaLaTabla(error.message)) {
      return { error: "Falta correr la migración 0119 en Supabase." };
    }
    return { error: "No se pudo guardar: " + error.message };
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { categoria: data as CategoriaNegocio };
}

/**
 * Renombrar arrastra: los servicios de ESE negocio que estaban en la
 * sección vieja pasan a la nueva.
 *
 * El orden de las dos escrituras no es casual. Primero la categoría:
 * el índice único rechaza un nombre repetido ANTES de tocar un solo
 * servicio, así que un choque de nombres nunca puede terminar
 * fusionando dos secciones. Si después fallara el update de los
 * ítems, lo peor que pasa es que esa sección pierda su orden
 * explícito — nada se borra ni se mezcla.
 *
 * Va en una acción de servidor y no en un trigger a propósito: un
 * trigger que reescribe `rancho_items` desde otra tabla es un efecto
 * invisible que después nadie encuentra.
 */
export async function renombrarCategoria(
  ranchoId: string,
  categoriaId: string,
  nombre: string,
): Promise<Resultado> {
  const invalido = validarNombre(nombre);
  if (invalido) return { error: invalido };

  const nuevo = nombre.trim();
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("categorias_negocio")
    .select("nombre")
    .eq("id", categoriaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  if (!actual) return { error: "Esa sección ya no existe." };
  const viejo = (actual.nombre as string).trim();

  // El choque de nombres se comprueba ANTES de tocar nada. El índice
  // único sigue siendo el respaldo, pero adelantarlo acá permite que
  // los servicios se muevan primero (ver abajo) sin riesgo de terminar
  // fusionando dos secciones.
  //
  // La comparación se hace en JS y no con `ilike` a propósito:
  // PostgREST trata `*`, `%` y `_` como comodines dentro del patrón, así
  // que una sección llamada "50% descuento" habría chocado contra
  // cualquier otra que empiece con "50".
  const { data: hermanas } = await supabase
    .from("categorias_negocio")
    .select("id, nombre")
    .eq("rancho_id", ranchoId)
    .neq("id", categoriaId);

  if ((hermanas ?? []).some((c) => igualSinMayusculas(c.nombre as string, nuevo))) {
    return { error: "Ya tenés una sección con ese nombre." };
  }

  // Los servicios se mueven PRIMERO, y a propósito. Si después fallara
  // el renombrado de la categoría, queda: servicios con el nombre
  // nuevo, categoría con el viejo. Volver a intentar lo mismo arregla
  // solo — el update de ítems no encuentra nada que mover y el de la
  // categoría termina el trabajo.
  //
  // Al revés no se curaba: con la categoría ya renombrada, el reintento
  // veía `viejo === nuevo`, se daba por hecho, y los servicios se
  // quedaban para siempre en la sección anterior.
  //
  // La comparación va sin distinguir mayúsculas, igual que el índice
  // único de la 0119: si no, una sección podía ordenarse bien y aun así
  // no arrastrar sus servicios.
  if (!igualSinMayusculas(viejo, nuevo)) {
    // Se leen los valores reales de `grupo` y se comparan en JS, y
    // después se actualiza con un `in` de coincidencias EXACTAS. Con
    // `ilike` un nombre con `%` o `*` habría arrastrado servicios de
    // otras secciones.
    const { data: filas } = await supabase
      .from("rancho_items")
      .select("grupo")
      .eq("rancho_id", ranchoId);

    const variantes = Array.from(
      new Set(
        (filas ?? [])
          .map((f) => f.grupo as string | null)
          .filter((g): g is string => !!g && igualSinMayusculas(g, viejo)),
      ),
    );

    if (variantes.length > 0) {
      const { error: errorItems } = await supabase
        .from("rancho_items")
        .update({ grupo: nuevo })
        .eq("rancho_id", ranchoId)
        .in("grupo", variantes);

      if (errorItems) {
        return { error: "No se pudieron mover los servicios: " + errorItems.message };
      }
    }
  }

  const { data, error } = await supabase
    .from("categorias_negocio")
    .update({ nombre: nuevo })
    .eq("id", categoriaId)
    .eq("rancho_id", ranchoId)
    .select("*")
    .single();

  if (error) {
    if (esDuplicado(error.message)) return { error: "Ya tenés una sección con ese nombre." };
    return {
      error:
        "Los servicios ya están en la sección nueva, pero el nombre no se " +
        "guardó. Volvé a intentarlo.",
    };
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { categoria: data as CategoriaNegocio };
}

/** Guarda el orden que quedó después de arrastrar. */
export async function reordenarCategorias(
  ranchoId: string,
  idsEnOrden: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient();

  for (const [i, id] of idsEnOrden.entries()) {
    const { error } = await supabase
      .from("categorias_negocio")
      .update({ orden: i + 1 })
      .eq("id", id)
      .eq("rancho_id", ranchoId);
    if (error) return { error: "No se pudo reordenar: " + error.message };
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return {};
}

/**
 * Borrar la sección NO borra servicios: no hay FK, así que los ítems
 * conservan su `grupo` y vuelven al orden implícito (aparecen donde
 * aparece su primer ítem). Es la consecuencia buena de que esta tabla
 * sea solo el orden.
 */
export async function eliminarCategoria(
  ranchoId: string,
  categoriaId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categorias_negocio")
    .delete()
    .eq("id", categoriaId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo eliminar: " + error.message };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return {};
}
