"use server";

import { createClient } from "@/lib/supabase/server";
import { limpiarRespuestas } from "@/lib/invitaciones-preguntas";

export type NuevoRsvp = {
  invitacionId: string;
  nombre: string;
  acompanantes: number;
  asistira: boolean;
  mensaje: string | null;
  /** Respuestas a las preguntas configurables ({id → respuesta}). */
  respuestas?: Record<string, string> | null;
  /** Correo de contacto del invitado (opcional). */
  correo?: string | null;
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
  const respuestas = limpiarRespuestas(rsvp.respuestas);

  // El correo es opcional, pero si lo escribieron tiene que verse como
  // correo — un typo acá deja al anfitrión con un contacto inservible.
  const correo = rsvp.correo?.trim().toLowerCase().slice(0, 200) || null;
  if (correo && !/^\S+@\S+\.\S+$/.test(correo)) {
    return { error: "Ese correo no se ve bien — revisalo o dejalo vacío." };
  }

  const fila: {
    invitacion_id: string;
    nombre: string;
    acompanantes: number;
    asistira: boolean;
    mensaje: string | null;
    respuestas?: Record<string, string>;
    correo?: string;
  } = {
    invitacion_id: rsvp.invitacionId,
    nombre,
    acompanantes,
    asistira: rsvp.asistira,
    mensaje,
  };
  if (respuestas) fila.respuestas = respuestas;
  if (correo) fila.correo = correo;

  const supabase = await createClient();
  let { error } = await supabase.from("invitacion_rsvp").insert(fila);

  // Las columnas `respuestas` (0068) y `correo` (0070) son opcionales:
  // si su migración no ha corrido, PostgREST rechaza la columna
  // desconocida (PGRST204) — se reintenta con lo básico para que la
  // confirmación no se pierda.
  if (
    error &&
    (respuestas || correo) &&
    (error.code === "PGRST204" ||
      error.message?.includes("respuestas") ||
      error.message?.includes("correo"))
  ) {
    const { respuestas: _r, correo: _c, ...basica } = fila;
    void _r;
    void _c;
    ({ error } = await supabase.from("invitacion_rsvp").insert(basica));
  }

  if (error) {
    return { error: "No se pudo guardar tu confirmación. Probá de nuevo en un momento." };
  }
  return { error: null };
}
