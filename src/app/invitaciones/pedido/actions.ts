"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enviarCorreo, layoutBento } from "@/lib/email";
import {
  montoEnColones,
  resolverPaquete,
  SLUG_NEGOCIO_INVITACIONES,
  TIPOS_EVENTO,
} from "@/lib/paquetes-invitaciones";

/**
 * El pedido de una invitación digital: el cliente elige paquete, llena
 * los datos de su fiesta y elige cómo pagar. Acá viven las dos
 * acciones del flujo — crear el pedido y registrar el pago.
 */

export type EstadoPedido = { error?: string };

function texto(form: FormData, campo: string, max = 400): string {
  return String(form.get(campo) ?? "").trim().slice(0, max);
}

/**
 * Guarda el pedido y manda al cliente a la pantalla de pago.
 * El precio NO viene del formulario: se resuelve en el servidor a
 * partir del paquete, así nadie puede pagar $1 por el Plus.
 */
export async function crearPedido(
  paqueteId: string,
  _estado: EstadoPedido,
  form: FormData,
): Promise<EstadoPedido> {
  const paquete = resolverPaquete(paqueteId);
  if (!paquete) return { error: "Ese paquete no existe" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/cuenta?next=/invitaciones/pedido/${paqueteId}`);
  }

  const tipoEvento = texto(form, "tipo_evento", 60);
  const nombreEvento = texto(form, "nombre_evento", 160);
  const fechaEvento = texto(form, "fecha_evento", 10);
  const contactoNombre = texto(form, "contacto_nombre", 120);
  const contactoCorreo = texto(form, "contacto_correo", 160) || user.email || "";

  if (!tipoEvento || !(TIPOS_EVENTO as readonly string[]).includes(tipoEvento)) {
    return { error: "Elegí el tipo de evento" };
  }
  if (!nombreEvento) return { error: "Contanos cómo se llama tu evento" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEvento)) {
    return { error: "La fecha del evento no es válida" };
  }
  if (!contactoNombre) return { error: "Necesitamos tu nombre para contactarte" };
  if (!contactoCorreo.includes("@")) {
    return { error: "Necesitamos un correo válido" };
  }

  const invitados = Number(form.get("cantidad_invitados"));
  const limite = texto(form, "fecha_limite_confirmacion", 10);

  const { data, error } = await supabase
    .from("pedidos_invitacion")
    .insert({
      cliente_id: user.id,
      paquete: paquete.id,
      precio_usd: paquete.precioUSD,
      precio_crc: paquete.precioCRC,
      // Lo que de verdad se cobra, ya convertido: el reporte de
      // ingresos no debe depender del tipo de cambio de mañana.
      monto_crc: montoEnColones(paquete),
      tipo_evento: tipoEvento,
      nombre_evento: nombreEvento,
      anfitriones: texto(form, "anfitriones", 200) || null,
      fecha_evento: fechaEvento,
      hora: texto(form, "hora", 20) || null,
      lugar_nombre: texto(form, "lugar_nombre", 160) || null,
      lugar_direccion: texto(form, "lugar_direccion", 300) || null,
      maps_url: texto(form, "maps_url", 500) || null,
      tematica: texto(form, "tematica", 200) || null,
      colores: texto(form, "colores", 160) || null,
      cantidad_invitados: Number.isFinite(invitados) && invitados > 0 ? Math.round(invitados) : null,
      fecha_limite_confirmacion: /^\d{4}-\d{2}-\d{2}$/.test(limite) ? limite : null,
      mensaje: texto(form, "mensaje", 1200) || null,
      idioma: texto(form, "idioma", 20) || "es",
      contacto_nombre: contactoNombre,
      contacto_whatsapp: texto(form, "contacto_whatsapp", 40) || null,
      contacto_correo: contactoCorreo,
      estado: "pendiente_pago",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[pedido] No se pudo guardar:", error?.message);
    return {
      error:
        "No pudimos guardar tu pedido. Si el problema sigue, escribinos por el chat.",
    };
  }

  redirect(`/invitaciones/pago/${data.id}`);
}

/**
 * El cliente eligió SINPE o transferencia y adjuntó su comprobante:
 * el pedido pasa a revisión y salen los correos (al cliente y al
 * equipo de Bookea).
 */
export async function registrarPago(
  pedidoId: string,
  _estado: EstadoPedido,
  form: FormData,
): Promise<EstadoPedido> {
  const metodo = texto(form, "metodo_pago", 20);
  if (!["sinpe", "transferencia"].includes(metodo)) {
    return { error: "Elegí cómo pagaste" };
  }
  const comprobanteUrl = texto(form, "comprobante_url", 800);
  if (!comprobanteUrl) {
    return { error: "Adjuntá el comprobante para que podamos verificar el pago" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const { data: pedido, error } = await supabase
    .from("pedidos_invitacion")
    .update({
      metodo_pago: metodo,
      comprobante_url: comprobanteUrl,
      referencia_pago: texto(form, "referencia_pago", 120) || null,
      estado: "en_revision",
      pagado_en: new Date().toISOString(),
    })
    .eq("id", pedidoId)
    .eq("cliente_id", user.id)
    .select("id, paquete, nombre_evento, fecha_evento, contacto_correo, contacto_nombre")
    .single();

  if (error || !pedido) {
    return { error: "No pudimos registrar tu pago. Intentá de nuevo." };
  }

  const paquete = resolverPaquete(pedido.paquete as string);

  // Los correos salen después de responder: que el cliente vea su
  // pantalla de "listo" sin esperar a Resend.
  after(async () => {
    const nombre = String(pedido.contacto_nombre ?? "");
    const evento = String(pedido.nombre_evento ?? "tu evento");
    const conPanel = paquete?.tienePanel ?? false;

    await enviarCorreo({
      to: String(pedido.contacto_correo),
      subject: `Recibimos tu pedido — ${evento}`,
      html: layoutBento({
        kicker: "Invitaciones digitales",
        titulo: "¡Recibimos tu pedido!",
        introHtml: `Hola ${nombre}, ya tenemos los datos de <strong>${evento}</strong> y tu comprobante. Estamos verificando el pago.`,
        naranjaHtml: `Paquete ${paquete?.nombre ?? ""} · Apenas confirmemos el pago, el equipo empieza a diseñar tu invitación.`,
        cuerpoHtml: `<p style="margin:0 0 12px;">Cuando esté lista te llega un correo con el link para compartir con tus invitados.</p>
          <p style="margin:0;">Entrá con la misma cuenta con la que hiciste el pedido para verla${
            conPanel
              ? " y para abrir tu panel de confirmaciones, donde vas a ver en vivo quién asiste y quién no."
              : "."
          }</p>`,
        cta: { href: "https://www.bookea.lat/cuenta", label: "Ver mi cuenta" },
      }),
    }).catch((e) => console.error("[pedido] correo al cliente:", e));

    // Aviso al equipo, al correo del negocio de invitaciones.
    const avisoEquipo = process.env.BOOKEA_CORREO_PEDIDOS;
    if (avisoEquipo) {
      await enviarCorreo({
        to: avisoEquipo,
        subject: `Nuevo pedido de invitación — ${evento}`,
        html: layoutBento({
          kicker: "Pedido nuevo",
          titulo: "Entró un pedido de invitación",
          introHtml: `${nombre} pidió el paquete <strong>${paquete?.nombre ?? pedido.paquete}</strong> para ${evento} (${pedido.fecha_evento}).`,
          cta: {
            href: "https://www.bookea.lat/admin/invitaciones",
            label: "Ver en el panel",
          },
          pie: `Aviso interno de ${SLUG_NEGOCIO_INVITACIONES}.`,
        }),
      }).catch((e) => console.error("[pedido] aviso al equipo:", e));
    }
  });

  redirect(`/invitaciones/pago/${pedidoId}?listo=1`);
}
