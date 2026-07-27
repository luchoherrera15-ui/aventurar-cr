"use server";

import { createClient } from "@/lib/supabase/server";

export async function enviarMensaje(conversacionId: string, texto: string) {
  const limpio = texto.trim();
  if (!limpio) return { error: "Escribí algo primero." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const { error } = await supabase.from("mensajes").insert({
    conversacion_id: conversacionId,
    autor_id: user.id,
    texto: limpio,
  });

  if (error) return { error: error.message };
  return { error: null };
}
