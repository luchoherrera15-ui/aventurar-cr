"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setEstadoReserva(id: string, estado: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservas")
    .update({ estado })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }
  revalidatePath("/admin/eventos");
  return { error: null };
}

export async function marcarDepositoValidado(id: string, validado: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservas")
    .update({ deposito_validado: validado })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/eventos");
  return { error: null };
}

export async function obtenerUrlComprobante(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("comprobantes")
    .createSignedUrl(path, 60);

  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}
