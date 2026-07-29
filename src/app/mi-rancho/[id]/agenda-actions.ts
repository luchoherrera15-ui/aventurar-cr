"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verificarAccesoRancho } from "@/lib/auth";

async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-rancho/login");
  if (!ok) return { supabase, rancho: null };

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, categoria, capacidad_max")
    .eq("id", ranchoId)
    .maybeSingle();

  return { supabase, rancho };
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type ReservaManualInput = {
  fecha: string;
  nombre: string;
  tipo_evento: string;
  invitados: number | null;
  notas: string | null;
};

/**
 * Carga una reserva que llegó por teléfono o en persona. La política de
 * inserción solo deja crear en 'pendiente' o 'temporal' (pensada para el
 * flujo público), así que se crea pendiente y se confirma enseguida con
 * un update — eso sí lo permite la política del dueño sobre sus propias
 * reservas.
 */
export async function crearReservaManual(ranchoId: string, input: ReservaManualInput) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { error: "No encontramos tu publicación." };

  if (!FECHA_REGEX.test(input.fecha)) {
    return { error: "La fecha no es válida." };
  }
  const nombre = input.nombre.trim().slice(0, 120);
  if (!nombre) return { error: "Escribí el nombre de quien reserva." };

  const capacidadMax = rancho.capacidad_max as number | null;
  if (capacidadMax && input.invitados && input.invitados > capacidadMax) {
    return { error: `Este lugar recibe hasta ${capacidadMax} personas.` };
  }

  // Solo los lugares tienen un evento por día — un servicio (catering,
  // DJ, etc.) puede tomar varias reservas para la misma fecha.
  const esLugar = rancho.categoria === "lugares";
  if (esLugar) {
    const { data: ocupado } = await supabase
      .from("reservas")
      .select("id")
      .eq("rancho_id", ranchoId)
      .eq("fecha", input.fecha)
      .in("estado", ["pendiente", "confirmada"])
      .maybeSingle();
    if (ocupado) {
      return { error: "Esa fecha ya tiene una reserva pendiente o confirmada." };
    }
  }

  const { data: creada, error: errorInsert } = await supabase
    .from("reservas")
    .insert({
      rancho_id: ranchoId,
      fecha: input.fecha,
      estado: "pendiente",
      origen: "manual",
      nombre,
      tipo_evento: input.tipo_evento.trim().slice(0, 60) || null,
      invitados: input.invitados,
      notas: input.notas?.trim().slice(0, 500) || null,
    })
    .select("id")
    .single();

  if (errorInsert) {
    if (errorInsert.code === "23505") {
      return { error: "Esa fecha ya está tomada." };
    }
    return { error: "No se pudo crear: " + errorInsert.message };
  }

  const { error: errorUpdate } = await supabase
    .from("reservas")
    .update({ estado: "confirmada" })
    .eq("id", creada.id);

  if (errorUpdate) {
    if (errorUpdate.code === "23505") {
      return { error: "Esa fecha ya quedó confirmada por otra reserva." };
    }
    return { error: "Se creó pero no se pudo confirmar: " + errorUpdate.message };
  }

  revalidatePath(`/mi-rancho/${ranchoId}`);
  revalidatePath("/admin/eventos");
  return { error: null };
}
