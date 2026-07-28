"use server";

import { createClient } from "@/lib/supabase/server";
import type { Mensaje } from "@/app/mi-rancho/types";

// Devuelve la fila insertada para que el chat la pinte de una, sin
// depender de que Realtime la haga rebotar de vuelta.
export async function enviarMensaje(
  conversacionId: string,
  texto: string,
): Promise<{ error: string } | { error: null; mensaje: Mensaje }> {
  const limpio = texto.trim();
  if (!limpio) return { error: "Escribí algo primero." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const { data, error } = await supabase
    .from("mensajes")
    .insert({
      conversacion_id: conversacionId,
      autor_id: user.id,
      texto: limpio,
    })
    .select("id, conversacion_id, autor_id, texto, created_at")
    .single();

  if (error || !data) {
    return { error: "No se pudo enviar el mensaje. Intentá de nuevo." };
  }
  return { error: null, mensaje: data as Mensaje };
}
