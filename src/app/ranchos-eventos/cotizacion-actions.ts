"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DetallePedido, RanchoItem } from "@/app/mi-rancho/types";
import { hoyISOCR } from "@/lib/fechas";

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
    const partes: string[] = [`Solicitud de reserva para el ${fecha}.`];
    if (tipoEvento) partes.push(`Tipo de evento: ${tipoEvento}.`);
    if (invitados && invitados > 0) partes.push(`Invitados: ${invitados}.`);
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
        partes.push(`Total estimado: ${fmtColones(detallePedido.total_estimado)}.`);
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

  redirect(`/mensajes/${reserva.id}`);
}
