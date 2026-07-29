"use server";

import { createClient } from "@/lib/supabase/server";

export async function alternarFavorito(ranchoId: string, guardar: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Iniciá sesión para guardar favoritos." };

  const { error } = guardar
    ? await supabase
        .from("favoritos")
        .insert({ cliente_id: user.id, rancho_id: ranchoId })
    : await supabase
        .from("favoritos")
        .delete()
        .eq("cliente_id", user.id)
        .eq("rancho_id", ranchoId);

  if (error) return { error: error.message };
  return { error: null };
}
