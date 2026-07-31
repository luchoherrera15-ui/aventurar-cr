"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notificarMensajeNuevo } from "@/lib/notificaciones-mensaje";
import { responderConAsistente } from "@/lib/asistente-ia";
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

  // El push al otro participante sale después de responder — after()
  // corre cuando la respuesta ya se mandó, así el chat no espera. El
  // asistente de IA (piloto, apagado sin llave) contesta por la misma
  // vía: el cliente ve la respuesta llegar por Realtime.
  after(async () => {
    // Independientes a propósito: si el aviso por correo falla, la
    // respuesta del asistente sale igual (y al revés).
    await notificarMensajeNuevo(data.id).catch((e) => {
      console.error("[mensajes] Falló el aviso del mensaje:", e);
    });
    await responderConAsistente(data.id);
  });

  return { error: null, mensaje: data as Mensaje };
}

// Estado compartido: si cualquiera de los dos la marca, se archiva
// para ambos (un mensaje nuevo la reabre solo — ver migración 0054).
export async function alternarResuelto(
  conversacionId: string,
  resuelta: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversaciones")
    .update({ resuelta })
    .eq("id", conversacionId);

  if (error) {
    return { error: "No se pudo actualizar. Intentá de nuevo." };
  }

  // Dar por resuelto es también decir "ya lo vi": si el hilo tenía
  // mensajes sin leer y se archiva sin marcarlos, esos pendientes se
  // siguen contando en la burbuja de chat aunque el hilo ya no salga
  // en la bandeja de activas — un contador que no baja nunca.
  if (resuelta) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("conversacion_lecturas").upsert(
        {
          conversacion_id: conversacionId,
          usuario_id: user.id,
          leido_hasta: new Date().toISOString(),
        },
        { onConflict: "conversacion_id,usuario_id" },
      );
    }
  }
  return { error: null };
}
