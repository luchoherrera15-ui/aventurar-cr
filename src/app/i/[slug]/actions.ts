"use server";

import { createClient } from "@/lib/supabase/server";

export type NuevoRsvp = {
  invitacionId: string;
  nombre: string;
  acompanantes: number;
  asistira: boolean;
  mensaje: string | null;
};

/**
 * Guarda la confirmación de un invitado. Corre con la llave anónima:
 * la política de la base solo deja insertar si la invitación está
 * activa, así que no hace falta sesión ni llave de servicio.
 */
export async function confirmarAsistencia(rsvp: NuevoRsvp) {
  const nombre = rsvp.nombre.trim();
  if (!nombre) return { error: "Contanos tu nombre para apuntarte." };
  if (nombre.length > 120) return { error: "Ese nombre es demasiado largo." };

  // Acompañantes entre 0 y 20 — nadie llega con 500 personas extra.
  const acompanantes = Math.min(20, Math.max(0, Math.round(rsvp.acompanantes) || 0));
  const mensaje = rsvp.mensaje?.trim().slice(0, 500) || null;

  const supabase = await createClient();
  const { error } = await supabase.from("invitacion_rsvp").insert({
    invitacion_id: rsvp.invitacionId,
    nombre,
    acompanantes,
    asistira: rsvp.asistira,
    mensaje,
  });

  if (error) {
    return { error: "No se pudo guardar tu confirmación. Probá de nuevo en un momento." };
  }
  return { error: null };
}
