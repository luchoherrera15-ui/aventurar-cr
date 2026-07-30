"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DetallePedido } from "@/app/mi-rancho/types";
import { hoyISOCR } from "@/lib/fechas";
import { enviarCorreo, plantillaConfirmacionReserva } from "@/lib/email";
import {
  cotizarServicio,
  leerConfigCobro,
  totalCotizacion,
} from "@/lib/cotizador-servicio";

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

  // La cotización según cómo cobra el proveedor se recalcula acá, con
  // las tarifas de la base — el total del navegador no se usa.
  const numForm = (nombre: string) => {
    const n = parseInt(String(formData.get(nombre) || ""), 10);
    return Number.isFinite(n) && n > 0 && n <= 999 ? n : null;
  };
  const lineasServicio = cotizarServicio(leerConfigCobro(rancho.detalles), {
    invitados,
    horas: numForm("horas"),
    dias: numForm("dias"),
    horasExtra: numForm("horas_extra"),
  });
  const totalServicio = totalCotizacion(lineasServicio);

  const deposito = rancho.deposito_reserva ?? 0;
  const pagoRequerido = deposito > 0 && (!!rancho.sinpe_numero || !!rancho.cuenta_numero);

  const metodoPagoRaw = String(formData.get("metodo_pago") || "");
  const metodoPago =
    metodoPagoRaw === "sinpe" || metodoPagoRaw === "transferencia" ? metodoPagoRaw : null;
  const comprobantePath = String(formData.get("comprobante_path") || "").trim();

  if (pagoRequerido && !comprobantePath) {
    return { error: "Subí el comprobante del depósito para agendar tu fecha." };
  }

  // El pedido llega como { item_id: cantidad }. Acá solo se le da
  // forma; los nombres y precios NO se le creen al navegador — la
  // función crear_reserva_servicio los relee de la base, comprueba los
  // mínimos/máximos de cada ítem y el inventario del día, y escribe la
  // reserva con sus líneas en una sola transacción (migración 0051).
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

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();

  const { data: reservaId, error } = await supabase.rpc("crear_reserva_servicio", {
    p_rancho_id: ranchoId,
    p_fecha: fecha,
    p_pedido: pedido,
    p_tipo_evento: tipoEvento || null,
    p_invitados: invitados && invitados > 0 ? invitados : null,
    p_notas: notas || null,
    p_nombre: perfil?.nombre || user.email,
    p_correo: user.email,
    p_whatsapp: null,
    p_total_servicio: totalServicio,
    p_metodo_pago: pagoRequerido && comprobantePath ? (metodoPago ?? "sinpe") : null,
    p_deposito_comprobante_url:
      pagoRequerido && comprobantePath ? comprobantePath : null,
    p_terminos_aceptados: false,
  });

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
    if (tipoEvento) partes.push(`Tipo de evento: ${tipoEvento}.`);
    if (invitados && invitados > 0) partes.push(`Invitados: ${invitados}.`);
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

  redirect(`/mensajes/${reserva.id}`);
}
