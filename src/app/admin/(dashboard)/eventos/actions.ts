"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notificarReservaAprobada } from "@/lib/notificaciones-reserva";

/**
 * Estas tres acciones NO las cubre el middleware de /admin.
 *
 * Una server action se invoca por su id, y ese id sirve desde CUALQUIER
 * ruta: quien lo saque del bundle puede mandarla por POST a "/" y
 * proxy.ts ni se entera, porque esa ruta no empieza con /admin. Por eso
 * cada una pregunta por su cuenta.
 *
 * Hasta ahora lo único que las frenaba era RLS (la política de reservas
 * desde la 0011 exige admin o dueño, y puede_ver_comprobante hace lo
 * mismo). Eso funcionaba, pero dejaba al panel colgando de una sola
 * capa: si mañana alguien afloja una política, la puerta queda abierta
 * sin que nada más avise.
 */
const SIN_PERMISO = "No tenés permiso para esto.";

export async function setEstadoReserva(id: string, estado: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservas")
    .update({ estado })
    .eq("id", id);

  if (error) {
    // El 23505 lo levanta el disparador del cupo por día (0049) con un
    // mensaje ya redactado para mostrar ("Esa fecha ya tiene una
    // reserva confirmada." / "Ya tenés N…"). Cualquier otro error
    // (RLS, red) se distingue para no culpar a la fecha por todo.
    if (error.code === "23505") {
      return { error: error.message };
    }
    return { error: "No se pudo cambiar el estado: " + error.message };
  }

  // Aprobar es lo que el cliente está esperando, así que se le avisa.
  // El helper solo manda el correo una vez por reserva y nunca lanza:
  // la reserva ya quedó aprobada aunque el correo falle.
  if (estado === "confirmada") {
    await notificarReservaAprobada(id);
  }

  revalidatePath("/admin/eventos");
  revalidatePath("/mi-rancho", "layout");
  return { error: null };
}

export async function marcarDepositoValidado(id: string, validado: boolean) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservas")
    .update({ deposito_validado: validado })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/eventos");
  revalidatePath("/mi-rancho", "layout");
  return { error: null };
}

export async function obtenerUrlComprobante(path: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { url: null, error: SIN_PERMISO };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("comprobantes")
    .createSignedUrl(path, 60);

  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}
