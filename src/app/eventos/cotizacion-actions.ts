"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DetallePedido } from "@/app/mi-negocio/types";
import { hoyISOCR } from "@/lib/fechas";
import { enviarCorreo, plantillaConfirmacionReserva } from "@/lib/email";
import {
  cotizarServicio,
  duracionServicio,
  leerConfigCobro,
  totalCotizacion,
  type PaqueteBaseElegido,
} from "@/lib/cotizador-servicio";
import { sumarDiasISO } from "@/lib/fechas";

export type CotizacionState = { error?: string } | undefined;

function fmtColones(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

/**
 * Reserva en línea para todo lo que no es Lugares. A diferencia del
 * calendario con exclusividad de los Lugares (que no se toca), acá un
 * mismo día admite varios eventos — la fecha es parte del pedido, no
 * un bloqueo. El flujo:
 *  1) queda guardada como reserva "pendiente" con el pedido armado
 *     (ítems del catálogo + cantidades, snapshot de precios) — el
 *     proveedor la ve en su panel, no se pierde en WhatsApp.
 *  2) abre el chat de esa reserva con un primer mensaje que resume el
 *     pedido, para que la negociación siga ahí mismo.
 *
 * Exige sesión iniciada a propósito: sin cliente_id no hay a quién
 * darle acceso al chat de esa conversación.
 */
export async function solicitarCotizacion(
  ranchoId: string,
  _prevState: CotizacionState,
  formData: FormData,
): Promise<CotizacionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Iniciá sesión para reservar." };

  const fecha = String(formData.get("fecha") || "");
  const tipoEvento = String(formData.get("tipo_evento") || "").trim();
  const invitadosRaw = String(formData.get("invitados") || "").trim();
  const invitados = invitadosRaw ? parseInt(invitadosRaw, 10) : null;
  const notas = String(formData.get("notas") || "").trim();

  if (!fecha) return { error: "Elegí la fecha de tu evento en el calendario." };
  const hoy = hoyISOCR();
  if (fecha < hoy) return { error: "Esa fecha ya pasó — elegí una futura." };

  // Si el proveedor configuró depósito + cuentas de cobro, la reserva
  // exige el comprobante (mismo esquema que los Lugares). La config se
  // relee de la base — nunca del navegador.
  const { data: ranchoData } = await supabase
    .from("ranchos")
    .select("nombre, deposito_reserva, sinpe_numero, cuenta_numero, detalles")
    .eq("id", ranchoId)
    .maybeSingle();
  const rancho = ranchoData as {
    nombre: string;
    deposito_reserva: number | null;
    sinpe_numero: string | null;
    cuenta_numero: string | null;
    detalles: Record<string, unknown> | null;
  } | null;
  if (!rancho) return { error: "Este negocio ya no está disponible." };

  // El pedido llega como { item_id: cantidad }. Se parsea ANTES de
  // cotizar porque un ítem con es_paquete_base sustituye la tarifa.
  const pedidoRaw = String(formData.get("pedido") || "");
  let pedido: { item_id: string; cantidad: number }[] = [];
  if (pedidoRaw) {
    let cantidades: Record<string, number>;
    try {
      cantidades = JSON.parse(pedidoRaw);
    } catch {
      return { error: "El pedido no se pudo leer. Recargá la página." };
    }
    pedido = Object.keys(cantidades)
      .filter(
        (id) =>
          Number.isInteger(cantidades[id]) &&
          cantidades[id] > 0 &&
          cantidades[id] <= 999,
      )
      .map((id) => ({ item_id: id, cantidad: cantidades[id] }));
  }

  // ¿Alguno de los ítems elegidos SUSTITUYE la tarifa base (0067)? Se
  // relee de la base — el navegador no decide qué es paquete base. El
  // select * tolera que la columna es_paquete_base no exista todavía.
  let paqueteBase: PaqueteBaseElegido | null = null;
  if (pedido.length > 0) {
    const { data: itemsPedido } = await supabase
      .from("rancho_items")
      .select("*")
      .eq("rancho_id", ranchoId)
      .in(
        "id",
        pedido.map((p) => p.item_id),
      );
    const base = ((itemsPedido ?? []) as {
      id: string;
      nombre: string;
      precio: number | null;
      duracion_horas: number | null;
      orden: number;
      es_paquete_base?: boolean | null;
    }[])
      .sort((a, b) => a.orden - b.orden)
      .find((i) => i.es_paquete_base === true);
    if (base) {
      paqueteBase = {
        nombre: base.nombre,
        precio: base.precio,
        duracionHoras: base.duracion_horas,
      };
    }
  }

  // La cotización según cómo cobra el proveedor se recalcula acá, con
  // las tarifas de la base — el total del navegador no se usa.
  const numForm = (nombre: string) => {
    const n = parseInt(String(formData.get(nombre) || ""), 10);
    return Number.isFinite(n) && n > 0 && n <= 999 ? n : null;
  };
  const config = leerConfigCobro(rancho.detalles);
  const seleccion = {
    invitados,
    horas: numForm("horas"),
    dias: numForm("dias"),
    horasExtra: numForm("horas_extra"),
    paqueteBase,
  };
  const lineasServicio = cotizarServicio(config, seleccion);
  const totalServicio = totalCotizacion(lineasServicio);

  // Hora del evento (opcional) + horas contratadas: con esto la base
  // puede detectar dos eventos montados en la misma franja.
  const horaRaw = String(formData.get("hora_inicio") || "").trim();
  const horaInicio = /^([01]?\d|2[0-3]):[0-5]\d$/.test(horaRaw) ? horaRaw : null;
  const duracionHoras = duracionServicio(config, seleccion);

  // Alquiler multi-día: los días elegidos definen hasta qué día se
  // aparta el inventario (fecha_fin = fecha + días − 1).
  const diasAlquiler = numForm("dias");
  const fechaFin =
    diasAlquiler && diasAlquiler > 1 && diasAlquiler <= 60
      ? sumarDiasISO(fecha, diasAlquiler - 1)
      : null;

  // Elecciones incluidas en la tarifa ("elegí hasta N"): solo texto
  // para el proveedor — no suman al precio.
  let eleccionesTexto = "";
  const eleccionesRaw = String(formData.get("elecciones") || "");
  if (eleccionesRaw) {
    try {
      const lista = JSON.parse(eleccionesRaw);
      if (Array.isArray(lista)) {
        const nombres = lista
          .filter((v): v is string => typeof v === "string" && !!v.trim())
          .slice(0, 30)
          .map((v) => v.trim().slice(0, 120));
        if (nombres.length > 0) {
          eleccionesTexto = `Elecciones incluidas en la tarifa (sin costo): ${nombres.join(", ")}.`;
        }
      }
    } catch {
      // Elecciones ilegibles no tumban la reserva: siguen en blanco.
    }
  }
  const notasConElecciones = [notas, eleccionesTexto].filter(Boolean).join("\n");

  const deposito = rancho.deposito_reserva ?? 0;
  const pagoRequerido = deposito > 0 && (!!rancho.sinpe_numero || !!rancho.cuenta_numero);

  const metodoPagoRaw = String(formData.get("metodo_pago") || "");
  const metodoPago =
    metodoPagoRaw === "sinpe" || metodoPagoRaw === "transferencia" ? metodoPagoRaw : null;
  const comprobantePath = String(formData.get("comprobante_path") || "").trim();

  if (pagoRequerido && !comprobantePath) {
    return { error: "Subí el comprobante del depósito para agendar tu fecha." };
  }

  // Los nombres y precios del pedido NO se le creen al navegador — la
  // función crear_reserva_servicio los relee de la base, comprueba los
  // mínimos/máximos de cada ítem y el inventario del día/rango, y
  // escribe la reserva con sus líneas en una sola transacción (0051 y
  // 0067).
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();

  const paramsBase = {
    p_rancho_id: ranchoId,
    p_fecha: fecha,
    p_pedido: pedido,
    p_tipo_evento: tipoEvento || null,
    p_invitados: invitados && invitados > 0 ? invitados : null,
    p_notas: notasConElecciones || null,
    p_nombre: perfil?.nombre || user.email,
    p_correo: user.email,
    p_whatsapp: null,
    p_total_servicio: totalServicio,
    p_metodo_pago: pagoRequerido && comprobantePath ? (metodoPago ?? "sinpe") : null,
    p_deposito_comprobante_url:
      pagoRequerido && comprobantePath ? comprobantePath : null,
    p_terminos_aceptados: false,
  };

  // Primero con los parámetros nuevos (hora, duración, rango — 0067);
  // si la base todavía tiene la firma vieja (PGRST202), se reintenta
  // sin ellos: la reserva sale igual, solo sin esos datos guardados.
  let { data: reservaId, error } = await supabase.rpc("crear_reserva_servicio", {
    ...paramsBase,
    p_hora_inicio: horaInicio,
    p_duracion_horas: duracionHoras,
    p_fecha_fin: fechaFin,
  });
  if (error && error.code === "PGRST202") {
    ({ data: reservaId, error } = await supabase.rpc(
      "crear_reserva_servicio",
      paramsBase,
    ));
  }

  if (error || !reservaId) {
    // Los mensajes de la función ya vienen redactados para mostrar
    // ("Ya no queda disponibilidad de …", "Ese día ya no tiene campo…").
    return {
      error: error?.message || "No se pudo enviar la solicitud. Intentá de nuevo.",
    };
  }

  const reserva = { id: reservaId as string };

  // El pedido con precios reales lo armó la función releyendo la base;
  // se lee de vuelta para escribir el resumen del chat con esos datos.
  const { data: reservaCreada } = await supabase
    .from("reservas")
    .select("detalle_pedido")
    .eq("id", reserva.id)
    .maybeSingle();
  const detallePedido = (reservaCreada?.detalle_pedido ?? null) as DetallePedido | null;

  // El resumen del pedido entra como primer mensaje del chat: el
  // proveedor lo ve en su bandeja con badge de "nuevo", y la
  // conversación arranca con todo el contexto a la vista.
  const { data: conversacion } = await supabase
    .from("conversaciones")
    .insert({ reserva_id: reserva.id })
    .select("id")
    .maybeSingle();

  if (conversacion) {
    const partes: string[] = [
      pagoRequerido && comprobantePath
        ? `Reserva agendada para el ${fecha} — depósito de ${fmtColones(deposito)} enviado por ${metodoPago === "transferencia" ? "transferencia" : "SINPE"}, comprobante adjunto en tu panel.`
        : `Solicitud de reserva para el ${fecha}.`,
    ];
    if (horaInicio) partes.push(`Hora del evento: ${horaInicio}.`);
    if (fechaFin) partes.push(`Alquiler del ${fecha} al ${fechaFin}.`);
    if (tipoEvento) partes.push(`Tipo de evento: ${tipoEvento}.`);
    if (invitados && invitados > 0) partes.push(`Invitados: ${invitados}.`);
    if (paqueteBase) {
      partes.push(
        `Paquete elegido: ${paqueteBase.nombre} — sustituye la tarifa base.`,
      );
    }
    if (eleccionesTexto) partes.push(eleccionesTexto);
    if (lineasServicio.length > 0) {
      partes.push(
        "Servicio cotizado:\n" +
          lineasServicio.map((l) => `• ${l.etiqueta}: ${fmtColones(l.monto)}`).join("\n") +
          `\nEstimado del servicio: ${fmtColones(totalServicio)}.`,
      );
    }
    if (detallePedido) {
      partes.push(
        "Pedido:\n" +
          detallePedido.items
            .map(
              (l) =>
                `• ${l.cantidad}× ${l.nombre}` +
                (l.precio !== null ? ` (${fmtColones(l.precio)}${l.unidad ? ` ${l.unidad}` : ""})` : " (a cotizar)"),
            )
            .join("\n"),
      );
      if (detallePedido.total_estimado !== null) {
        partes.push(
          `Total estimado${totalServicio > 0 ? " (servicio + pedido)" : ""}: ${fmtColones(
            totalServicio + detallePedido.total_estimado,
          )}.`,
        );
      }
    }
    if (notas) partes.push(`Notas: ${notas}`);

    // La columna de mensajes admite hasta 2000 caracteres.
    const texto = partes.join("\n").slice(0, 2000);
    await supabase.from("mensajes").insert({
      conversacion_id: conversacion.id,
      autor_id: user.id,
      texto,
    });
  }

  // El mismo correo de "reserva recibida" que mandan los Lugares — un
  // correo que falla no puede tumbar la reserva ya guardada.
  if (pagoRequerido && comprobantePath && user.email) {
    await enviarCorreo({
      to: user.email,
      subject: "Su reserva en Bookea.lat fue exitosa",
      html: plantillaConfirmacionReserva({
        nombreCliente: perfil?.nombre || user.email,
        fecha,
        montoDeposito: deposito,
      }),
    });
  }

  // ?nueva=1: el chat sabe que el cliente viene de reservar y le
  // muestra la oferta de la invitación digital (solo esa vez).
  redirect(`/mensajes/${reserva.id}?nueva=1`);
}
