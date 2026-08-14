"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verificarAccesoOperativo } from "@/lib/auth";
import { notificarReservaAprobada } from "@/lib/notificaciones-reserva";
import { resolverHorarioReserva } from "@/lib/agenda/reserva-manual";

async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoOperativo(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  if (!ok) return { supabase, rancho: null };

  // `vertical` va acá porque de ella (más la categoría) sale si este
  // negocio agenda por FRANJAS o por FECHA ENTERA, y eso decide si la
  // reserva manual necesita hora — ver `resolverHorarioReserva`.
  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, vertical, categoria, capacidad_max, eventos_por_dia")
    .eq("id", ranchoId)
    .maybeSingle();

  return { supabase, rancho };
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type ReservaManualInput = {
  fecha: string;
  /**
   * "HH:MM". OBLIGATORIA en todo negocio que agende por franjas (un
   * proveedor de eventos, una cita, una mesa): sin ella la reserva no
   * entra en `disponibilidad_citas` y la agenda pública sigue
   * ofreciendo esa hora. Un lugar de alquiler la manda en null y no se
   * usa para nada — ver `resolverHorarioReserva`.
   */
  horaInicio: string | null;
  /** "HH:MM" de cierre. Opcional: sin ella se asume el bloque por defecto. */
  horaFin: string | null;
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
 *
 * Y la HORA es obligatoria en todo negocio que agende por franjas. Sin
 * `hora_inicio` la fila no existe para `disponibilidad_citas`, así que
 * el DJ apuntaba "sábado, boda de los García", lo veía en su panel, y
 * su agenda pública le seguía ofreciendo ese sábado al siguiente
 * cliente. Quién agenda por franjas y qué se guarda lo decide
 * `resolverHorarioReserva`, compartido con el importador de agenda —
 * las dos puertas a esta tabla no pueden suponer cosas distintas.
 */
export async function crearReservaManual(ranchoId: string, input: ReservaManualInput) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { error: "No encontramos tu publicación." };

  if (!FECHA_REGEX.test(input.fecha)) {
    return { error: "La fecha no es válida." };
  }
  const nombre = input.nombre.trim().slice(0, 120);
  if (!nombre) return { error: "Escribí el nombre de quien reserva." };

  // En el SERVIDOR, no solo en la pantalla: el formulario ya pide la
  // hora a quien la necesita, pero esta acción se puede llamar desde
  // cualquier lado.
  const horario = resolverHorarioReserva(
    { vertical: rancho.vertical as string | null, categoria: rancho.categoria as string | null },
    { horaInicio: input.horaInicio, horaFin: input.horaFin },
  );
  if (horario.error) return { error: horario.error };

  // Los invitados son obligatorios también acá, no solo en el
  // formulario: sin ellos la reserva no cuenta para la ocupación del
  // negocio ni para lo que la plataforma cobra por persona.
  if (
    input.invitados === null ||
    !Number.isFinite(input.invitados) ||
    input.invitados <= 0
  ) {
    return { error: "Indicá para cuántos invitados es la reserva." };
  }

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
      // Vacío para un lugar de alquiler (se alquila la fecha entera):
      // su fila sale idéntica a la de siempre.
      ...horario.campos,
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

  revalidatePath(`/mi-negocio/${ranchoId}`);
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

  revalidatePath(`/mi-negocio/${ranchoId}`);
  revalidatePath("/admin/eventos");
  return { error: null };
}

/**
 * Confirma una reserva que estaba en aprobación.
 *
 * Es el mismo update que hace `crearReservaManual` al final, pero
 * suelto: desde el calendario se aprueba lo que entró por el sitio sin
 * tener que ir a buscarlo a otra pantalla.
 */
export async function confirmarReserva(ranchoId: string, reservaId: string) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { error: "No encontramos tu publicación." };

  // `.eq("rancho_id")` sobre la RLS: el id viene del navegador y no
  // puede servir para tocar la reserva de otro negocio. El filtro por
  // estado evita revivir una reserva ya cancelada de un doble clic.
  const { error } = await supabase
    .from("reservas")
    .update({ estado: "confirmada" })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId)
    .eq("estado", "pendiente");

  if (error) {
    if (error.code === "23505") return { error: error.message };
    return { error: "No se pudo confirmar: " + error.message };
  }

  // El mismo aviso que manda el admin al aprobar (correo + push al
  // cliente). El helper es idempotente (bandera aprobacion_enviada) y
  // nunca lanza — si el update de arriba no tocó ninguna fila (la
  // reserva no estaba pendiente), adentro tampoco pasa nada.
  await notificarReservaAprobada(reservaId);

  revalidatePath(`/mi-negocio/${ranchoId}`);
  revalidatePath("/admin/eventos");
  return { error: null };
}

/**
 * Cancela una reserva y libera el día.
 *
 * Para eventos el estado final sigue siendo 'rechazada' (0001): es el
 * mismo que usa el admin y el que la pantalla del cliente ya trata
 * como final. ('cancelada' existe desde la 0061, pero solo lo escribe
 * la vertical de Citas — cambiarlo acá obligaría a tocar todas las
 * pantallas que filtran por estado, sin ganar nada.)
 *
 * La PLATA no se toca: si el adelanto ya estaba validado, queda
 * retenido (la política de los términos es no devolver) y sigue
 * contando como ingreso en Finanzas — el motor mira los flags de
 * pago, no el estado. Si el negocio lo devuelve, lo marca después en
 * Finanzas → "Adelantos retenidos".
 *
 * Un bloqueo (manual o importado de una agenda externa) también se
 * cancela por acá: es la forma de liberar una fecha que se tapó por
 * error.
 */
export async function cancelarReserva(ranchoId: string, reservaId: string) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("reservas")
    .update({ estado: "rechazada", cancelada_en: new Date().toISOString() })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId)
    // Solo lo que todavía ocupa el día. Sin esto, un doble clic sobre
    // una reserva ya cancelada devolvería "listo" sin haber hecho nada.
    .in("estado", ["pendiente", "confirmada", "bloqueada"]);

  if (error) return { error: "No se pudo cancelar: " + error.message };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  revalidatePath("/admin/eventos");
  return { error: null };
}

/**
 * Mueve una reserva (o un bloqueo) a otra fecha — lo que antes el
 * comentario de `actualizarReservaManual` dejaba pendiente a propósito:
 * "es otra operación, no un campo más de este formulario".
 *
 * El cupo del día se revisa acá igual que en `crearReservaManual`
 * (mismo cálculo, misma fuente: `eventos_por_dia` del negocio). El
 * disparador `reservas_respeta_cupo_dia` de la base (migración 0049,
 * `before update of ... fecha ...`) lo vuelve a comprobar por su cuenta
 * cuando la reserva ya está confirmada — este chequeo de acá es la
 * versión con mensaje amable, igual que en el resto del archivo; el
 * de la base es la red de seguridad contra dos movimientos a la vez.
 */
export async function moverReservaFecha(
  ranchoId: string,
  reservaId: string,
  nuevaFecha: string,
) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { error: "No encontramos tu publicación." };

  if (!FECHA_REGEX.test(nuevaFecha)) {
    return { error: "La fecha nueva no es válida." };
  }

  const { data: actual } = await supabase
    .from("reservas")
    .select("id, estado, fecha")
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!actual) return { error: "No encontramos esa reserva." };
  if (actual.fecha === nuevaFecha) return { error: null };

  if (actual.estado === "pendiente" || actual.estado === "confirmada") {
    const cupo =
      (rancho.eventos_por_dia as number | null) ??
      (rancho.categoria === "lugares" ? 1 : null);
    if (cupo !== null) {
      const { count } = await supabase
        .from("reservas")
        .select("id", { count: "exact", head: true })
        .eq("rancho_id", ranchoId)
        .eq("fecha", nuevaFecha)
        .in("estado", ["pendiente", "confirmada"])
        .neq("id", reservaId);
      if ((count ?? 0) >= cupo) {
        return {
          error:
            cupo === 1
              ? "La fecha nueva ya tiene una reserva pendiente o confirmada."
              : `La fecha nueva ya tiene ${cupo} reservas — es tu cupo del día.`,
        };
      }
    }
  }

  const { error } = await supabase
    .from("reservas")
    .update({ fecha: nuevaFecha })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId);

  if (error) {
    if (error.code === "23505") {
      return { error: "La fecha nueva ya está tomada." };
    }
    return { error: "No se pudo mover: " + error.message };
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  revalidatePath("/admin/eventos");
  return { error: null };
}

/**
 * Aprueba o rechaza — el contrato que espera ReservasTable. Espejo de
 * `setEstadoReserva` del admin, pero gateado por dueño: las versiones
 * de `admin/eventos/actions.ts` exigen rol admin y a un dueño normal
 * le devolvían "No tenés permiso" desde su propio panel.
 */
export async function setEstadoReservaRancho(
  ranchoId: string,
  reservaId: string,
  estado: string,
) {
  if (estado === "confirmada") return confirmarReserva(ranchoId, reservaId);
  if (estado === "rechazada") return cancelarReserva(ranchoId, reservaId);
  return { error: "Estado no permitido." };
}

/**
 * URL firmada del comprobante de depósito, con la sesión del dueño.
 * La política del bucket `comprobantes` (puede_ver_comprobante, 0011)
 * ya permite al dueño del negocio de esa reserva — el mismo camino que
 * usa la app móvil en producción. 60 segundos, igual que el admin: se
 * pide al abrir el modal, no se precarga.
 */
export async function obtenerUrlComprobanteRancho(ranchoId: string, path: string) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { url: null, error: "No encontramos tu publicación." };

  const { data, error } = await supabase.storage
    .from("comprobantes")
    .createSignedUrl(path, 60);

  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}

/** Marca el depósito como recibido/no recibido — espejo de
 *  `marcarDepositoValidado` del admin, gateado por dueño. */
export async function marcarDepositoValidadoRancho(
  ranchoId: string,
  reservaId: string,
  validado: boolean,
) {
  const { supabase, rancho } = await verificarDueno(ranchoId);
  if (!rancho) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("reservas")
    .update({ deposito_validado: validado })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: error.message };
  revalidatePath(`/mi-negocio/${ranchoId}`);
  revalidatePath("/admin/eventos");
  return { error: null };
}
