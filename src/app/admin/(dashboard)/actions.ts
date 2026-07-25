"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function setEstadoReserva(id: string, estado: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservas")
    .update({ estado })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }
  revalidatePath("/admin");
  return { error: null };
}
