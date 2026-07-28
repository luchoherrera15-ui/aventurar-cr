"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DetallePedido, RanchoItem } from "@/app/mi-rancho/types";
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

  // El pedido llega como { item_id: cantidad }. Los nombres y precios
  // NO se le creen al navegador: se releen de la base acá, para que
  // nadie mande un pedido con precios inventados.
  let detallePedido: DetallePedido | null = null;
  const pedidoRaw = String(formData.get("pedido") || "");
  if (pedidoRaw) {
    let cantidades: Record<string, number>;
    try {
      cantidades = JSON.parse(pedidoRaw);
    } catch {
      return { error: "El pedido no se pudo leer. Recargá la página." };
    }
    const ids = Object.keys(cantidades).filter(
      (id) => Number.isInteger(cantidades[id]) && cantidades[id] > 0 && cantidades[id] <= 999,
    );
    if (ids.length > 0) {
      const { data: itemsData } = await supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", ranchoId)
        .eq("activo", true)
        .in("id", ids);
      const items = (itemsData ?? []) as RanchoItem[];
      if (items.length > 0) {
        const lineas = items.map((i) => ({
          item_id: i.id,
          nombre: i.nombre,
          precio: i.precio,
          unidad: i.unidad,
          cantidad: cantidades[i.id],
        }));
        const conPrecio = lineas.filter((l) => l.precio !== null);
        detallePedido = {
          items: lineas,
          total_estimado:
            conPrecio.length > 0
              ? conPrecio.reduce((s, l) => s + l.precio! * l.cantidad, 0)
              : null,
        };
      }
    }
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();

  const { data: reserva, error } = await supabase
    .from("reservas")
    .insert({
      rancho_id: ranchoId,
      cliente_id: user.id,
      fecha,
      tipo_evento: tipoEvento || null,
      invitados: invitados && invitados > 0 ? invitados : null,
      nombre: perfil?.nombre || user.email,
      correo: user.email,
      notas: notas || null,
      estado: "pendiente",
      origen: "web",
      ...(detallePedido ? { detalle_pedido: detallePedido } : {}),
      // El monto junta el servicio cotizado (por hora/persona/día...)
      // con el pedido del catálogo, si alguno de los dos existe.
      ...(totalServicio > 0 || detallePedido?.total_estimado != null
        ? { monto_total: totalServicio + (detallePedido?.total_estimado ?? 0) }
        : {}),
      ...(pagoRequerido && comprobantePath
        ? {
            metodo_pago: metodoPago ?? "sinpe",
            deposito_comprobante_url: comprobantePath,
          }
        : {}),
    })
    .select("id")
    .single();

  if (error || !reserva) {
    return { error: "No se pudo enviar la solicitud. Intentá de nuevo." };
  }

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
      subject: `Recibimos tu reserva en ${rancho.nombre}`,
      html: plantillaConfirmacionReserva({
        nombreCliente: perfil?.nombre || user.email,
        nombreRancho: rancho.nombre,
        fecha,
        montoDeposito: deposito,
      }),
    });
  }

  redirect(`/mensajes/${reserva.id}`);
}
