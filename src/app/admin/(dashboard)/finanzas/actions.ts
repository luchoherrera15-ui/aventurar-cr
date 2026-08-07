"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { esTablaCobrosInexistente, MIGRACION_LIBRO } from "@/lib/libro-cobros";

/**
 * Cobrar la semana: marcar pagados los cobros de un grupo
 * (semana × negocio) del libro de la plataforma.
 *
 * Se reciben ids y no "semana + negocio" a propósito: el admin cobra
 * lo que está viendo en pantalla. Si entre que cargó la pantalla y
 * apretó el botón entró una reserva nueva de esa misma semana, esa no
 * se marca pagada — no se le puede cobrar al negocio algo que no
 * estaba en la cuenta que se le pasó.
 *
 * El filtro `estado = 'pendiente'` es la otra mitad de la garantía:
 * nunca se toca un anulado ni se re-pisa la fecha de un cobro que ya
 * se había marcado.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sanea la lista que llegó del navegador: uuids únicos, tope sensato. */
function idsValidos(ids: string[]): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const limpios = [...new Set(ids.filter((id) => typeof id === "string" && UUID.test(id)))];
  if (limpios.length === 0 || limpios.length > 500) return null;
  return limpios;
}

const FALTA_MIGRACION = `Todavía no existe la tabla de cobros: pegá ${MIGRACION_LIBRO} en el SQL Editor de Supabase.`;

export async function marcarCobrosPagados(ids: string[]) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", marcados: 0 };

  const limpios = idsValidos(ids);
  if (!limpios) return { error: "No hay nada que marcar.", marcados: 0 };

  const { data, error } = await supabase
    .from("cobros_plataforma")
    .update({ estado: "pagado", pagado_en: new Date().toISOString() })
    .in("id", limpios)
    .eq("estado", "pendiente")
    .select("id");

  if (error) {
    if (esTablaCobrosInexistente(error)) {
      return { error: FALTA_MIGRACION, marcados: 0 };
    }
    return { error: error.message, marcados: 0 };
  }

  revalidatePath("/admin/finanzas");
  return { error: null, marcados: (data ?? []).length };
}

/**
 * Deshacer un cobro marcado por error: vuelve a pendiente y borra la
 * fecha de pago. Solo toca los que están en 'pagado' — un anulado no
 * "vuelve" a deberse.
 */
export async function volverCobrosAPendiente(ids: string[]) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", revertidos: 0 };

  const limpios = idsValidos(ids);
  if (!limpios) return { error: "No hay nada que deshacer.", revertidos: 0 };

  const { data, error } = await supabase
    .from("cobros_plataforma")
    .update({ estado: "pendiente", pagado_en: null })
    .in("id", limpios)
    .eq("estado", "pagado")
    .select("id");

  if (error) {
    if (esTablaCobrosInexistente(error)) {
      return { error: FALTA_MIGRACION, revertidos: 0 };
    }
    return { error: error.message, revertidos: 0 };
  }

  revalidatePath("/admin/finanzas");
  return { error: null, revertidos: (data ?? []).length };
}
