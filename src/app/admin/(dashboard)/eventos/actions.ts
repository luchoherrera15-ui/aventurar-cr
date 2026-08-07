"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notificarReservaAprobada } from "@/lib/notificaciones-reserva";
import { esTablaCobrosInexistente } from "@/lib/libro-cobros";

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
  revalidatePath("/mi-negocio", "layout");
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
  revalidatePath("/mi-negocio", "layout");
  return { error: null };
}

/**
 * BORRA una reserva del panel admin — pensado para limpiar datos de
 * prueba, no para cancelar una reserva de verdad (para eso está
 * "Rechazar", que avisa al cliente y libera la fecha sin perder el
 * rastro).
 *
 * Lo que se lleva por delante, y por qué está bien:
 *  - reseñas (0033), la conversación del chat (0034) y las líneas del
 *    pedido del catálogo (0050) van con `on delete cascade`: son hijas
 *    de la reserva y sin ella no significan nada.
 *
 * Lo que NO se lleva por delante, a propósito:
 *  - el LIBRO DE COBROS de la plataforma (`cobros_plataforma`, 0106).
 *    Esa tabla existe justamente para que lo devengado no dependa de
 *    que la reserva siga viva: su FK es `on delete set null` y se copia
 *    el cliente y la fecha del evento para poder leerse sola. Borrar
 *    ahí sería borrar la contabilidad. Entonces:
 *      · si el cobro está PENDIENTE, se ANULA (queda en el histórico
 *        con la nota de por qué) y deja de sumar a la cuenta del
 *        negocio;
 *      · si el cobro ya está PAGADO, la reserva NO se borra. Esa plata
 *        se cobró de verdad; hay que decirlo, no taparlo.
 *
 * Si la 0106 todavía no corrió, no hay libro que cuidar y la reserva se
 * borra igual.
 */
export async function eliminarReserva(id: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };

  const supabase = await createClient();

  const { data: cobros, error: errorCobros } = await supabase
    .from("cobros_plataforma")
    .select("id, estado, monto")
    .eq("reserva_id", id);

  // La tabla puede no existir todavía (0106 sin correr): eso no es
  // razón para no poder borrar una reserva de prueba.
  if (errorCobros && !esTablaCobrosInexistente(errorCobros)) {
    return { error: "No se pudo revisar el libro de cobros: " + errorCobros.message };
  }

  const filas = (cobros ?? []) as { id: string; estado: string; monto: number }[];
  const pagados = filas.filter((c) => c.estado === "pagado");
  if (pagados.length > 0) {
    const total = pagados.reduce((s, c) => s + Number(c.monto || 0), 0);
    return {
      error:
        `Esta reserva ya generó un cobro de plataforma COBRADO (₡${total.toLocaleString("es-CR")}). ` +
        "Borrarla dejaría el libro de cobros mintiendo sobre plata que sí entró. " +
        "Si de verdad hay que sacarla, primero deshacé ese cobro en Finanzas.",
    };
  }

  const pendientes = filas.filter((c) => c.estado === "pendiente").map((c) => c.id);
  if (pendientes.length > 0) {
    const { error: errorAnular } = await supabase
      .from("cobros_plataforma")
      .update({
        estado: "anulado",
        notas: "anulado: la reserva se borró desde el panel admin",
      })
      .in("id", pendientes);
    if (errorAnular) {
      return {
        error:
          "No se pudo anular el cobro de plataforma de esta reserva, así que no se borró nada: " +
          errorAnular.message,
      };
    }
  }

  const { error } = await supabase.from("reservas").delete().eq("id", id);
  if (error) return { error: "No se pudo borrar la reserva: " + error.message };

  revalidatePath("/admin/eventos");
  revalidatePath("/admin/finanzas");
  revalidatePath("/mi-negocio", "layout");
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
