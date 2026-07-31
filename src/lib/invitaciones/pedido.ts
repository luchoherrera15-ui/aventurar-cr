import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarCorreo, layoutBento } from "@/lib/email";
import {
  montoEnColones,
  resolverPaquete,
  SLUG_NEGOCIO_INVITACIONES,
  TIPOS_EVENTO,
  type PaqueteResuelto,
} from "@/lib/paquetes-invitaciones";

/**
 * El pedido de una invitación digital, en un solo lugar: validación,
 * insert y los correos que salen al pagar.
 *
 * Existe porque el pedido entra por DOS puertas — la server action del
 * sitio (src/app/invitaciones/pedido/actions) y el endpoint que usa la
 * app móvil (src/app/api/invitaciones/pedido) — y hay una regla que no
 * puede depender de por dónde entró: **el precio lo pone el servidor**,
 * nunca el formulario ni el teléfono. Con la lógica repartida, tarde o
 * temprano una de las dos puertas se olvida de resolverlo y alguien
 * paga $1 por el paquete Plus.
 *
 * La RLS de pedidos_invitacion (migración 0075) deja al cliente
 * insertar su propio pedido con cualquier monto a propósito — es la
 * política mínima que hace falta. El blindaje del precio vive acá.
 */

/** Lo que el cliente manda; el precio NO está en esta lista. */
export type DatosPedido = {
  tipo_evento?: unknown;
  nombre_evento?: unknown;
  anfitriones?: unknown;
  fecha_evento?: unknown;
  hora?: unknown;
  lugar_nombre?: unknown;
  lugar_direccion?: unknown;
  maps_url?: unknown;
  tematica?: unknown;
  colores?: unknown;
  cantidad_invitados?: unknown;
  fecha_limite_confirmacion?: unknown;
  mensaje?: unknown;
  idioma?: unknown;
  contacto_nombre?: unknown;
  contacto_whatsapp?: unknown;
  contacto_correo?: unknown;
};

export type ResultadoPedido =
  | { ok: true; pedidoId: string }
  | { ok: false; error: string };

function texto(datos: DatosPedido, campo: keyof DatosPedido, max = 400): string {
  return String(datos[campo] ?? "")
    .trim()
    .slice(0, max);
}

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida los datos de la fiesta y guarda el pedido en estado
 * `pendiente_pago`. El precio se resuelve acá a partir del id del
 * paquete: lo que venga en `datos` sobre plata se ignora.
 */
export async function crearPedidoInvitacion({
  supabase,
  clienteId,
  correoCuenta,
  paqueteId,
  datos,
}: {
  supabase: SupabaseClient;
  clienteId: string;
  /** El correo de la sesión, como respaldo si no mandan uno. */
  correoCuenta: string | null;
  paqueteId: string;
  datos: DatosPedido;
}): Promise<ResultadoPedido> {
  const paquete = resolverPaquete(paqueteId);
  if (!paquete) return { ok: false, error: "Ese paquete no existe" };

  const tipoEvento = texto(datos, "tipo_evento", 60);
  const nombreEvento = texto(datos, "nombre_evento", 160);
  const fechaEvento = texto(datos, "fecha_evento", 10);
  const contactoNombre = texto(datos, "contacto_nombre", 120);
  const contactoCorreo = texto(datos, "contacto_correo", 160) || correoCuenta || "";

  if (!tipoEvento || !(TIPOS_EVENTO as readonly string[]).includes(tipoEvento)) {
    return { ok: false, error: "Elegí el tipo de evento" };
  }
  if (!nombreEvento) return { ok: false, error: "Contanos cómo se llama tu evento" };
  if (!ES_FECHA.test(fechaEvento)) {
    return { ok: false, error: "La fecha del evento no es válida" };
  }
  if (!contactoNombre) {
    return { ok: false, error: "Necesitamos tu nombre para contactarte" };
  }
  if (!contactoCorreo.includes("@")) {
    return { ok: false, error: "Necesitamos un correo válido" };
  }

  const invitados = Number(datos.cantidad_invitados);
  const limite = texto(datos, "fecha_limite_confirmacion", 10);

  const { data, error } = await supabase
    .from("pedidos_invitacion")
    .insert({
      cliente_id: clienteId,
      paquete: paquete.id,
      // Las tres columnas de plata salen de `paquete`, jamás de `datos`.
      precio_usd: paquete.precioUSD,
      precio_crc: paquete.precioCRC,
      // Lo que de verdad se cobra, ya convertido: el reporte de
      // ingresos no debe depender del tipo de cambio de mañana.
      monto_crc: montoEnColones(paquete),
      tipo_evento: tipoEvento,
      nombre_evento: nombreEvento,
      anfitriones: texto(datos, "anfitriones", 200) || null,
      fecha_evento: fechaEvento,
      hora: texto(datos, "hora", 20) || null,
      lugar_nombre: texto(datos, "lugar_nombre", 160) || null,
      lugar_direccion: texto(datos, "lugar_direccion", 300) || null,
      maps_url: texto(datos, "maps_url", 500) || null,
      tematica: texto(datos, "tematica", 200) || null,
      colores: texto(datos, "colores", 160) || null,
      cantidad_invitados:
        Number.isFinite(invitados) && invitados > 0 ? Math.round(invitados) : null,
      fecha_limite_confirmacion: ES_FECHA.test(limite) ? limite : null,
      mensaje: texto(datos, "mensaje", 1200) || null,
      idioma: texto(datos, "idioma", 20) || "es",
      contacto_nombre: contactoNombre,
      contacto_whatsapp: texto(datos, "contacto_whatsapp", 40) || null,
      contacto_correo: contactoCorreo,
      estado: "pendiente_pago",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[pedido] No se pudo guardar:", error?.message);
    return {
      ok: false,
      error: "No pudimos guardar tu pedido. Si el problema sigue, escribinos por el chat.",
    };
  }

  return { ok: true, pedidoId: String(data.id) };
}

/** Lo que el pedido devuelve al registrar el pago. */
export type PedidoPagado = {
  paquete: string;
  nombre_evento: string | null;
  fecha_evento: string | null;
  contacto_correo: string;
  contacto_nombre: string | null;
};

export type ResultadoPago = { ok: true } | { ok: false; error: string };

/**
 * Marca el pedido como pagado (a revisión) con el comprobante que
 * adjuntó el cliente. Devuelve el pedido para que quien llame decida
 * cuándo mandar los correos — en la web con `after()`, en el endpoint
 * del app después de responder.
 */
export async function registrarPagoPedido({
  supabase,
  pedidoId,
  clienteId,
  metodo,
  comprobanteUrl,
  referencia,
}: {
  supabase: SupabaseClient;
  pedidoId: string;
  clienteId: string;
  metodo: string;
  comprobanteUrl: string;
  referencia: string | null;
}): Promise<ResultadoPago & { pedido?: PedidoPagado }> {
  if (!["sinpe", "transferencia"].includes(metodo)) {
    return { ok: false, error: "Elegí cómo pagaste" };
  }
  if (!comprobanteUrl) {
    return {
      ok: false,
      error: "Adjuntá el comprobante para que podamos verificar el pago",
    };
  }

  const { data, error } = await supabase
    .from("pedidos_invitacion")
    .update({
      metodo_pago: metodo,
      comprobante_url: comprobanteUrl,
      referencia_pago: referencia?.slice(0, 120) || null,
      estado: "en_revision",
      pagado_en: new Date().toISOString(),
    })
    .eq("id", pedidoId)
    .eq("cliente_id", clienteId)
    .select("paquete, nombre_evento, fecha_evento, contacto_correo, contacto_nombre")
    .single();

  if (error || !data) {
    return { ok: false, error: "No pudimos registrar tu pago. Intentá de nuevo." };
  }

  return { ok: true, pedido: data as PedidoPagado };
}

/**
 * Los dos correos del pedido pagado: el "ya lo recibimos" al cliente y
 * el aviso interno al equipo. Nunca lanza — un correo que no sale no
 * puede tumbar un pago que ya quedó registrado.
 */
export async function notificarPedidoPagado(pedido: PedidoPagado): Promise<void> {
  const paquete: PaqueteResuelto | null = resolverPaquete(pedido.paquete);
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

  const avisoEquipo = process.env.BOOKEA_CORREO_PEDIDOS;
  if (!avisoEquipo) return;

  await enviarCorreo({
    to: avisoEquipo,
    subject: `Nuevo pedido de invitación — ${evento}`,
    html: layoutBento({
      kicker: "Pedido nuevo",
      titulo: "Entró un pedido de invitación",
      introHtml: `${nombre} pidió el paquete <strong>${paquete?.nombre ?? pedido.paquete}</strong> para ${evento} (${pedido.fecha_evento}).`,
      cta: {
        // Directo a la pestaña de Pedidos: la de Invitaciones lista las
        // ya creadas y no muestra los pedidos, que era justo lo que
        // hacía parecer que el formulario no llegaba.
        href: "https://www.bookea.lat/admin/invitaciones?tab=pedidos",
        label: "Ver el pedido en el panel",
      },
      pie: `Aviso interno de ${SLUG_NEGOCIO_INVITACIONES}.`,
    }),
  }).catch((e) => console.error("[pedido] aviso al equipo:", e));
}
