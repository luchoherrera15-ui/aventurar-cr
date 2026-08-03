"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";

/**
 * El depósito para citas (0095): cuánto pide el negocio para asegurar
 * la cita. Es OPT-IN (null = sin depósito, el flujo de siempre) y lo
 * relee la base al crear la cita — el navegador del cliente jamás
 * decide el monto (patrón 0087). El pago sigue siendo por SINPE +
 * validación del dueño en Finanzas, como los eventos.
 */
export async function guardarDepositoCitas(
  ranchoId: string,
  deposito: number | null,
): Promise<{ error?: string }> {
  if (
    deposito !== null &&
    (!Number.isFinite(deposito) || deposito < 0 || deposito > 10_000_000)
  ) {
    return { error: "Revisá el monto del depósito." };
  }

  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-rancho/login");
  if (!ok) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("ranchos")
    .update({ deposito_citas: deposito === 0 ? null : deposito })
    .eq("id", ranchoId);

  if (error) {
    if (/deposito_citas|column/.test(error.message)) {
      return {
        error: "Falta correr la migración 0095 en Supabase (supabase/migrations).",
      };
    }
    return { error: "No se pudo guardar: " + error.message };
  }

  revalidatePath(`/mi-rancho/${ranchoId}/citas`);
  revalidatePath("/citas", "layout");
  return {};
}
