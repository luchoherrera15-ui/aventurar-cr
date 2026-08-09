"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import {
  MODULOS,
  esTipoNegocio,
  modulosPorDefecto,
  tipoNegocioEfectivo,
  tiposDeVertical,
} from "@/lib/business/modulos";

/**
 * Bookea Business: el tipo de negocio y sus módulos.
 *
 * Las dos acciones comprueban la sesión y la propiedad del negocio con
 * `verificarAccesoRancho` ANTES de escribir, y la vertical y el tipo se
 * releen de la base — nunca se cree lo que mande el navegador. Las
 * políticas de `modulos_negocio` ya atan cada fila a `ranchos.owner_id`,
 * así que esto es la segunda barrera, no la única.
 */

type Resultado = { error?: string; ok?: true };

const FALTA_MIGRACION =
  "Falta correr supabase/migrations/0108_bookea_business_tipo_y_modulos.sql " +
  "en el SQL Editor de Supabase.";

/** ¿El error de la base es "esa tabla/columna todavía no existe"? */
function esEsquemaViejo(mensaje: string): boolean {
  const m = mensaje.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache")
  );
}

export async function guardarTipoNegocio(
  ranchoId: string,
  tipo: string,
): Promise<Resultado> {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  if (!ok) return { error: "No tenés permiso para cambiar este negocio." };

  if (!esTipoNegocio(tipo)) return { error: "Ese tipo de negocio no existe." };

  // La vertical sale de la base, no del formulario: así nadie puede
  // volver "restaurante" a un negocio de citas mandando otro campo.
  const { data: negocio } = await supabase
    .from("ranchos")
    .select("vertical")
    .eq("id", ranchoId)
    .maybeSingle();
  const vertical = (negocio?.vertical as string | null) ?? "eventos";

  if (!tiposDeVertical(vertical).some((t) => t.id === tipo)) {
    return { error: "Ese tipo de negocio no aplica a tu tipo de publicación." };
  }

  const { error } = await supabase
    .from("ranchos")
    .update({ tipo_negocio: tipo })
    .eq("id", ranchoId);

  if (error) {
    return { error: esEsquemaViejo(error.message) ? FALTA_MIGRACION : error.message };
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { ok: true };
}

/**
 * Guarda los módulos encendidos. En la tabla solo quedan LAS
 * DIFERENCIAS contra el default del tipo: lo que coincide con el
 * default se borra en vez de guardarse, para que cambiar un default en
 * el código siga alcanzando a quien no opinó.
 */
export async function guardarModulos(
  ranchoId: string,
  seleccion: Record<string, boolean>,
): Promise<Resultado> {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  if (!ok) return { error: "No tenés permiso para cambiar este negocio." };

  const { data: negocio } = await supabase
    .from("ranchos")
    .select("vertical, categoria, tipo_negocio")
    .eq("id", ranchoId)
    .maybeSingle();

  const tipo = tipoNegocioEfectivo(
    negocio?.vertical as string | null,
    negocio?.categoria as string | null,
    (negocio as { tipo_negocio?: string | null } | null)?.tipo_negocio ?? null,
  );
  const porDefecto = new Set(modulosPorDefecto(tipo));

  const guardar: { rancho_id: string; modulo: string; activo: boolean; updated_at: string }[] = [];
  const borrar: string[] = [];
  const ahora = new Date().toISOString();

  for (const modulo of MODULOS) {
    // Un módulo sin pantalla no se puede encender desde acá: el
    // formulario lo muestra como "próximamente" y el servidor lo
    // vuelve a comprobar.
    if (!modulo.disponible) continue;
    const quiere = seleccion[modulo.id] === true;
    if (quiere === porDefecto.has(modulo.id)) borrar.push(modulo.id);
    else guardar.push({ rancho_id: ranchoId, modulo: modulo.id, activo: quiere, updated_at: ahora });
  }

  if (borrar.length > 0) {
    const { error } = await supabase
      .from("modulos_negocio")
      .delete()
      .eq("rancho_id", ranchoId)
      .in("modulo", borrar);
    if (error) {
      return { error: esEsquemaViejo(error.message) ? FALTA_MIGRACION : error.message };
    }
  }

  if (guardar.length > 0) {
    const { error } = await supabase
      .from("modulos_negocio")
      .upsert(guardar, { onConflict: "rancho_id,modulo" });
    if (error) {
      return { error: esEsquemaViejo(error.message) ? FALTA_MIGRACION : error.message };
    }
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  return { ok: true };
}
