"use server";

import { createClient } from "@/lib/supabase/server";
import { notificarCitaConfirmada } from "@/lib/notificaciones-cita";

export type CrearCitaInput = {
  ranchoId: string;
  itemId: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  miembroId: string | null;
  nombre: string;
  telefono: string;
  notas: string;
};

/**
 * Crea la cita llamando al RPC (que valida horario, resuelve el
 * profesional y confirma al instante) y dispara los avisos. La cita
 * nace confirmada — decisión de producto: sin aprobación manual.
 *
 * Los avisos (correo + push) viven en src/lib/notificaciones-cita.ts,
 * compartidos con /api/citas/[id]/confirmacion — el camino de la app
 * móvil, que llama al RPC directo porque no tiene servidor propio.
 */
export async function crearCita(
  input: CrearCitaInput,
): Promise<{ error: string } | { error: null; reservaId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Iniciá sesión para reservar tu cita." };

  const { data, error } = await supabase.rpc("crear_cita", {
    p_rancho_id: input.ranchoId,
    p_item_id: input.itemId,
    p_fecha: input.fecha,
    p_hora: input.hora,
    p_miembro_id: input.miembroId,
    p_nombre: input.nombre,
    p_telefono: input.telefono,
    p_notas: input.notas,
  });

  if (error || !data) {
    // Los mensajes del RPC ya vienen en español y listos para mostrar.
    return { error: error?.message || "No se pudo crear la cita. Intentá de nuevo." };
  }

  const reservaId = data as string;
  // Los avisos nunca tumban una cita ya creada.
  try {
    await notificarCitaConfirmada(reservaId);
  } catch {
    // El aviso queda pendiente; la cita existe igual.
  }
  return { error: null, reservaId };
}
