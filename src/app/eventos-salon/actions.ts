"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { HorarioBloque } from "./types";

const MINUTOS_HOLD = 10;

export async function crearReservaTemporal(ranchoId: string, fecha: string) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const expiraEn = new Date(Date.now() + MINUTOS_HOLD * 60 * 1000).toISOString();

  // Libera holds vencidos de esta fecha (de este rancho) antes de intentar tomarla.
  await supabase
    .from("reservas")
    .delete()
    .eq("rancho_id", ranchoId)
    .eq("fecha", fecha)
    .eq("estado", "temporal")
    .lt("expira_en", nowIso);

  const { data, error } = await supabase
    .from("reservas")
    .insert({
      fecha,
      estado: "temporal",
      expira_en: expiraEn,
      origen: "web",
      rancho_id: ranchoId,
    })
    .select("id, expira_en")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        id: null,
        expiraEn: null,
        error:
          "Justo ahora otra persona reservó temporalmente esta fecha. Esperá unos minutos o elegí otro día.",
      };
    }
    return { id: null, expiraEn: null, error: error.message };
  }
  return {
    id: data.id as string,
    expiraEn: data.expira_en as string,
    error: null,
  };
}

export async function cancelarReservaTemporal(id: string) {
  const supabase = await createClient();
  // Best-effort: si ya se completó o ya se venció, no pasa nada.
  await supabase.from("reservas").delete().eq("id", id).eq("estado", "temporal");
}

export type CompletarReservaInput = {
  nombre: string;
  contacto: string;
  tipo_evento: string;
  invitados: number;
  horario_bloque: HorarioBloque;
  monto_total: number;
  deposito_monto: number;
  metodo_pago: "sinpe" | "transferencia";
  deposito_comprobante_url: string;
  terminos_aceptados: boolean;
  notas: string | null;
};

export async function completarReservaTemporal(
  id: string,
  input: CompletarReservaInput,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservas")
    .update({ ...input, estado: "pendiente" })
    .eq("id", id)
    .eq("estado", "temporal");

  if (error) return { error: error.message };

  revalidatePath("/admin/eventos");
  revalidatePath("/mi-rancho/reservas");
  return { error: null };
}
