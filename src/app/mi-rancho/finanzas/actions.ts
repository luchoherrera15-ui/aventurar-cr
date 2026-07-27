"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS_GASTO, type CategoriaGasto } from "@/lib/finanzas";

/**
 * Todo lo de acá toca plata, así que ninguna acción confía en el id que
 * llega del navegador: primero se resuelve el rancho de la sesión y
 * después se filtra por él. Las políticas de la base lo vuelven a
 * comprobar, pero no queremos depender de una sola barrera.
 */
async function ranchoDeLaSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data } = await supabase
    .from("ranchos")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  return { supabase, ranchoId: (data?.id as string | undefined) ?? null };
}

/** Marca (o desmarca) que el adelanto llegó a la cuenta. */
export async function marcarDepositoRecibido(
  reservaId: string,
  recibido: boolean,
) {
  const { supabase, ranchoId } = await ranchoDeLaSesion();
  if (!ranchoId) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("reservas")
    .update({
      deposito_validado: recibido,
      deposito_pagado_en: recibido ? new Date().toISOString() : null,
    })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-rancho/finanzas");
  revalidatePath("/mi-rancho/reservas");
  return { error: null };
}

/**
 * Cierra el evento: se cobró el saldo.
 *
 * `montoFinal` permite corregir la cotización con lo que de verdad se
 * cobró (llegaron más invitados, se pasaron de hora). Sin ese dato los
 * números del panel se despegan de la caja real.
 */
export async function registrarPagoFinal(
  reservaId: string,
  montoFinal: number | null,
) {
  const { supabase, ranchoId } = await ranchoDeLaSesion();
  if (!ranchoId) return { error: "No encontramos tu publicación." };

  if (montoFinal !== null && (!Number.isFinite(montoFinal) || montoFinal < 0)) {
    return { error: "El monto cobrado no puede ser negativo." };
  }

  const update: Record<string, unknown> = {
    evento_pagado: true,
    saldo_pagado_en: new Date().toISOString(),
  };
  // Solo pisamos la cotización si el dueño escribió un monto distinto.
  if (montoFinal !== null) update.monto_cobrado_final = montoFinal;

  const { error } = await supabase
    .from("reservas")
    .update(update)
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-rancho/finanzas");
  revalidatePath("/mi-rancho/reservas");
  return { error: null };
}

/** Deshace un cobro marcado por error. */
export async function revertirPagoFinal(reservaId: string) {
  const { supabase, ranchoId } = await ranchoDeLaSesion();
  if (!ranchoId) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("reservas")
    .update({ evento_pagado: false, saldo_pagado_en: null })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-rancho/finanzas");
  return { error: null };
}

const CATEGORIAS_VALIDAS = CATEGORIAS_GASTO.map((c) => c.id) as string[];

export async function agregarGasto(entrada: {
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  nota: string | null;
}) {
  const { supabase, ranchoId } = await ranchoDeLaSesion();
  if (!ranchoId) return { error: "No encontramos tu publicación." };

  const concepto = entrada.concepto.trim();
  if (!concepto) return { error: "Escribí en qué gastaste." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.fecha)) {
    return { error: "La fecha del gasto no es válida." };
  }
  if (!Number.isFinite(entrada.monto) || entrada.monto <= 0) {
    return { error: "El monto tiene que ser mayor a cero." };
  }
  const categoria: CategoriaGasto = CATEGORIAS_VALIDAS.includes(entrada.categoria)
    ? (entrada.categoria as CategoriaGasto)
    : "otro";

  const { error } = await supabase.from("gastos_rancho").insert({
    rancho_id: ranchoId,
    fecha: entrada.fecha,
    concepto: concepto.slice(0, 120),
    categoria,
    monto: entrada.monto,
    nota: entrada.nota?.trim() ? entrada.nota.trim().slice(0, 300) : null,
  });

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-rancho/finanzas");
  return { error: null };
}

export async function borrarGasto(gastoId: string) {
  const { supabase, ranchoId } = await ranchoDeLaSesion();
  if (!ranchoId) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("gastos_rancho")
    .delete()
    .eq("id", gastoId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo borrar: " + error.message };

  revalidatePath("/mi-rancho/finanzas");
  return { error: null };
}
