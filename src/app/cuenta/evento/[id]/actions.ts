"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Borrar una confirmación de la lista del anfitrión.
 *
 * Quién puede: lo decide la política de la base (0088) — el dueño de la
 * invitación o un admin, y solo sobre confirmaciones de SU invitación.
 * Acá no se re-implementa esa regla; se corre con la sesión de quien
 * pide, así que si no es suya el delete no alcanza ninguna fila.
 *
 * Existe porque el link de la invitación es público: la misma persona
 * confirma dos veces desde el teléfono y la compu, y ese conteo es el
 * que el anfitrión le pasa al catering.
 */
export async function borrarConfirmacion(rsvpId: string, invitacionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Iniciá sesión para administrar tu lista." };

  // `select` para distinguir "no era tuya" (0 filas, sin error) de un
  // fallo de verdad: sin esto, un borrado que la política rechaza se
  // vería como éxito y la fila reaparecería al recargar.
  const { data, error } = await supabase
    .from("invitacion_rsvp")
    .delete()
    .eq("id", rsvpId)
    .select("id");

  if (error) {
    // Si la 0088 todavía no corrió no hay política de delete: la
    // operación no falla, simplemente no borra nada. Igual se avisa.
    return { error: "No se pudo borrar la confirmación: " + error.message };
  }
  if (!data || data.length === 0) {
    return {
      error:
        "No se pudo borrar esa confirmación. Si el problema sigue, escribinos por el chat.",
    };
  }

  revalidatePath(`/cuenta/evento/${invitacionId}`);
  return { error: null };
}
