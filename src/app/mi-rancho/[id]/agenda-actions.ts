"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verificarAccesoRancho } from "@/lib/auth";

async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-rancho/login");
  if (!ok) return { supabase, rancho: null };

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, categoria, capacidad_max, eventos_por_dia")
    .eq("id", ranchoId)
    .maybeSingle();

  return { supabase, rancho };
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type ReservaManualInput = {
  fecha: string;
  nombre: string;
  tipo_evento: string;
  invitados: number | null;
  notas: string | null;
  /** Lo que vale el evento — sin esto, la reserva no aparece en Finanzas. */
  montoTotal: number;
  /** Adelanto acordado (puede ser 0 si no se pidió). */
  depositoMonto: number;
  /** Si el adelanto ya entró (efectivo, SINPE, lo que sea) al cargar la reserva. */
  depositoRecibido: boolean;
  /** Si ya se cobró el evento completo (poco común al cargarla, pero puede pasar). */
  eventoPagado: boolean;
};

/**
 * Carga una reserva que llegó por teléfono o en persona. La política de
 * inserción solo deja crear en 'pendiente' o 'temporal' (pensada para el
 * flujo público), así que se crea pendiente y se confirma enseguida con
 * un update — eso sí lo permite la política del dueño sobre sus propias
 * reservas.
 *
 * Los montos son obligatorios (salvo el adelanto): sin monto_total la
 * reserva queda invisible para el panel de Finanzas, que es lo que hace
 * el control económico de la plataforma.
 */
export async function crearReservaManual(ranchoId: string, input: ReservaManualInput) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { error: "No encontramos tu publicación." };

  if (!FECHA_REGEX.test(input.fecha)) {
    return { error: "La fecha no es válida." };
  }
  const nombre = input.nombre.trim().slice(0, 120);
  if (!nombre) return { error: "Escribí el nombre de quien reserva." };

  if (!Number.isFinite(input.montoTotal) || input.montoTotal <= 0) {
    return { error: "Ingresá cuánto vale el evento." };
  }
  if (!Number.isFinite(input.depositoMonto) || input.depositoMonto < 0) {
    return { error: "El adelanto no puede ser negativo." };
  }
  if (input.depositoMonto > input.montoTotal) {
    return { error: "El adelanto no puede ser mayor que el total del evento." };
  }

  const capacidadMax = rancho.capacidad_max as number | null;
  if (capacidadMax && input.invitados && input.invitados > capacidadMax) {
    return { error: `Este lugar recibe hasta ${capacidadMax} personas.` };
  }

  // El cupo del día ya no depende de la categoría sino de cuántos
  // eventos dijo atender el negocio (eventos_por_dia, migración 0049).
  // Los lugares quedan en 1; un catering puede tener 2, 3... y null es
  // sin tope. El disparador de la base lo vuelve a comprobar al
  // confirmar — esto es solo para avisar antes, con mejor mensaje.
  const cupo =
    (rancho.eventos_por_dia as number | null) ??
    (rancho.categoria === "lugares" ? 1 : null);
  if (cupo !== null) {
    const { count } = await supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("rancho_id", ranchoId)
      .eq("fecha", input.fecha)
      .in("estado", ["pendiente", "confirmada"]);
    if ((count ?? 0) >= cupo) {
      return {
        error:
          cupo === 1
            ? "Esa fecha ya tiene una reserva pendiente o confirmada."
            : `Esa fecha ya tiene ${cupo} reservas — es tu cupo del día.`,
      };
    }
  }

  const ahoraIso = new Date().toISOString();

  const { data: creada, error: errorInsert } = await supabase
    .from("reservas")
    .insert({
      rancho_id: ranchoId,
      fecha: input.fecha,
      estado: "pendiente",
      origen: "manual",
      nombre,
      tipo_evento: input.tipo_evento.trim().slice(0, 60) || null,
      invitados: input.invitados,
      notas: input.notas?.trim().slice(0, 500) || null,
      monto_total: input.montoTotal,
      deposito_monto: input.depositoMonto,
      deposito_validado: input.depositoRecibido,
      deposito_pagado_en: input.depositoRecibido ? ahoraIso : null,
      evento_pagado: input.eventoPagado,
      saldo_pagado_en: input.eventoPagado ? ahoraIso : null,
    })
    .select("id")
    .single();

  if (errorInsert) {
    if (errorInsert.code === "23505") {
      return { error: "Esa fecha ya está tomada." };
    }
    return { error: "No se pudo crear: " + errorInsert.message };
  }

  const { error: errorUpdate } = await supabase
    .from("reservas")
    .update({ estado: "confirmada" })
    .eq("id", creada.id);

  if (errorUpdate) {
    if (errorUpdate.code === "23505") {
      return { error: "Esa fecha ya quedó confirmada por otra reserva." };
    }
    return { error: "Se creó pero no se pudo confirmar: " + errorUpdate.message };
  }

  revalidatePath(`/mi-rancho/${ranchoId}`);
  revalidatePath("/admin/eventos");
  return { error: null };
}

export type ReservaEditable = {
  nombre: string;
  tipo_evento: string | null;
  invitados: number | null;
  notas: string | null;
  montoTotal: number | null;
  depositoMonto: number | null;
  /** Texto libre del bloque horario — solo eventos/hospedajes. */
  horarioBloque: string | null;
};

/**
 * Corrige una reserva que ya existe.
 *
 * Hasta ahora el panel solo dejaba tocar los PAGOS de una reserva
 * (marcar el adelanto, cerrar el cobro). Los datos del evento —
 * nombre, personas, monto, horario — solo se podían fijar al crearla,
 * así que una reserva cargada con un dato a medias quedaba así para
 * siempre. Con el importador eso deja de ser aceptable: media agenda
 * de papel entra incompleta a propósito, para completarse después.
 *
 * No se toca la FECHA acá. Mover una reserva de día es otra operación
 * (dispara el cupo del día, puede chocar con otra confirmada y afecta
 * al cliente); se resuelve aparte, no colada en un formulario de
 * corrección de datos.
 */
export async function actualizarReservaManual(
  ranchoId: string,
  reservaId: string,
  input: ReservaEditable,
) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { error: "No encontramos tu publicación." };

  const nombre = input.nombre.trim().slice(0, 120);
  if (!nombre) return { error: "Escribí el nombre de quien reserva." };

  if (input.montoTotal != null) {
    if (!Number.isFinite(input.montoTotal) || input.montoTotal < 0) {
      return { error: "El monto no puede ser negativo." };
    }
  }
  if (input.depositoMonto != null) {
    if (!Number.isFinite(input.depositoMonto) || input.depositoMonto < 0) {
      return { error: "El adelanto no puede ser negativo." };
    }
    if (input.montoTotal != null && input.depositoMonto > input.montoTotal) {
      return { error: "El adelanto no puede ser mayor que el total del evento." };
    }
  }

  const capacidadMax = rancho.capacidad_max as number | null;
  if (capacidadMax && input.invitados && input.invitados > capacidadMax) {
    return { error: `Este lugar recibe hasta ${capacidadMax} personas.` };
  }

  // `.eq("rancho_id")` además de la RLS: el id de la reserva viene del
  // navegador y no puede servir para editar la de otro negocio.
  const { error } = await supabase
    .from("reservas")
    .update({
      nombre,
      tipo_evento: input.tipo_evento?.trim().slice(0, 60) || null,
      invitados: input.invitados,
      notas: input.notas?.trim().slice(0, 500) || null,
      monto_total: input.montoTotal,
      deposito_monto: input.depositoMonto,
      horario_bloque: input.horarioBloque?.trim().slice(0, 120) || null,
    })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath(`/mi-rancho/${ranchoId}`);
  revalidatePath("/admin/eventos");
  return { error: null };
}
