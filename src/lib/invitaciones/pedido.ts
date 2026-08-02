import type { SupabaseClient } from "@supabase/supabase-js";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { enviarCorreo, escaparHtml, layoutBento } from "@/lib/email";
import { SITIO_URL } from "@/lib/qr";
import {
  albumEnColones,
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
 * nunca el formulario ni el teléfono.
 *
 * Desde la 0087 ese blindaje ya no vive acá: vive en la base. Este
 * módulo llama a `crear_pedido_invitacion` y `registrar_pago_pedido`,
 * que buscan el precio en `paquetes_invitacion` y solo dejan tocar las
 * columnas que corresponden. Tenerlo en TypeScript no alcanzaba: la
 * anon key está en el bundle, así que cualquiera podía hablar con
 * PostgREST directo, saltarse este archivo y —lo más caro— cambiarse
 * el paquete DESPUÉS de haber pagado uno más barato.
 *
 * Lo que sigue viviendo acá: la validación con mensajes en español, el
 * armado de los correos, y un detector de desfase entre el precio del
 * catálogo (src/lib/paquetes-invitaciones.ts, lo que se muestra) y el
 * de la tabla (lo que se cobra).
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
  /** El álbum de 180 fotos como extra. Viaja como sí/no y nada más: el
   *  precio lo pone la base (0091), nunca el formulario. */
  con_album?: unknown;
};

/**
 * El pedido recién guardado, con lo que el aviso interno necesita para
 * que un administrador entienda qué entró sin abrir nada.
 */
export type PedidoNuevo = {
  id: string;
  paquete: string;
  tipo_evento: string;
  nombre_evento: string;
  fecha_evento: string;
  hora: string | null;
  lugar_nombre: string | null;
  cantidad_invitados: number | null;
  contacto_nombre: string;
  contacto_whatsapp: string | null;
  contacto_correo: string;
};

export type ResultadoPedido =
  | { ok: true; pedidoId: string; pedido: PedidoNuevo }
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
  // Un checkbox llega como "on" desde un formulario del navegador y como
  // true desde el app: se aceptan los dos, y todo lo demás es que no.
  const conAlbum =
    datos.con_album === true ||
    datos.con_album === "true" ||
    datos.con_album === "on" ||
    datos.con_album === "1";

  // El pedido lo arma la base (0087). El paquete lo elige el cliente;
  // el precio lo busca `paquetes_invitacion`. Nada de lo que llegue en
  // `datos` sobre plata se manda siquiera — no hay parámetro donde
  // ponerlo.
  const { data, error } = await supabase.rpc("crear_pedido_invitacion", {
    p_paquete: paquete.id,
    p_tipo_evento: tipoEvento,
    p_nombre_evento: nombreEvento,
    p_fecha_evento: fechaEvento,
    p_contacto_nombre: contactoNombre,
    p_contacto_correo: contactoCorreo,
    p_anfitriones: texto(datos, "anfitriones", 200) || null,
    p_hora: texto(datos, "hora", 20) || null,
    p_lugar_nombre: texto(datos, "lugar_nombre", 160) || null,
    p_lugar_direccion: texto(datos, "lugar_direccion", 300) || null,
    p_maps_url: texto(datos, "maps_url", 500) || null,
    p_tematica: texto(datos, "tematica", 200) || null,
    p_colores: texto(datos, "colores", 160) || null,
    p_cantidad_invitados:
      Number.isFinite(invitados) && invitados > 0 ? Math.round(invitados) : null,
    p_fecha_limite_confirmacion: ES_FECHA.test(limite) ? limite : null,
    p_mensaje: texto(datos, "mensaje", 1200) || null,
    p_idioma: texto(datos, "idioma", 20) || "es",
    p_contacto_whatsapp: texto(datos, "contacto_whatsapp", 40) || null,
    p_con_album: conAlbum,
  });

  if (error) {
    // La 0087 puede no haber corrido todavía (se despliega el código
    // antes que la migración, o al revés). Mientras la función no
    // exista se usa el camino viejo: es preferible un pedido con el
    // precio blindado solo por el servidor que un formulario caído.
    if (faltaLa0087(error)) {
      console.warn("[pedido] Falta la migración 0087 — se inserta por el camino viejo.");
      return crearPedidoDirecto({
        supabase,
        clienteId,
        paquete,
        campos: {
          tipoEvento,
          nombreEvento,
          fechaEvento,
          contactoNombre,
          contactoCorreo,
          invitados,
          limite,
          conAlbum,
        },
        datos,
      });
    }
    console.error("[pedido] No se pudo guardar:", error.message);
    return { ok: false, error: mensajeDePostgres(error.message) };
  }

  const pedido = data as unknown as (PedidoNuevo & { monto_crc?: number }) | null;
  if (!pedido?.id) {
    return {
      ok: false,
      error: "No pudimos guardar tu pedido. Si el problema sigue, escribinos por el chat.",
    };
  }

  // Detector de desfase: el catálogo de TypeScript manda en lo que se
  // MUESTRA y la tabla en lo que se COBRA. Si alguien cambia un precio
  // en un solo lado, el cliente ve un número y se le cobra otro — y sin
  // esto nadie se enteraría hasta que reclame.
  const esperado = montoEnColones(paquete) + (conAlbum ? albumEnColones() : 0);
  if (pedido.monto_crc !== undefined && Number(pedido.monto_crc) !== esperado) {
    console.error(
      `[pedido] Precio desfasado en "${paquete.id}": la base cobró ₡${pedido.monto_crc} y el catálogo dice ₡${esperado}. Emparejar la tabla paquetes_invitacion con src/lib/paquetes-invitaciones.ts, y configuracion_plataforma.tipo_cambio_usd con TIPO_CAMBIO_USD — el que manda es el de la base.`,
    );
  }

  return { ok: true, pedidoId: String(pedido.id), pedido };
}

/** true si el error huele a "la función de la 0087 todavía no existe". */
function faltaLa0087(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    Boolean(error.message?.includes("does not exist")) ||
    Boolean(error.message?.includes("schema cache"))
  );
}

/**
 * Los `raise exception` de las funciones de la 0087 ya vienen escritos
 * para que los lea un cliente ("Elegí cómo pagaste."). PostgREST los
 * entrega tal cual en `message`, así que se pasan derecho; cualquier
 * otra cosa se cambia por un mensaje genérico para no mostrar tripas.
 */
function mensajeDePostgres(mensaje: string): string {
  const limpio = mensaje.trim();
  const pareceNuestro = limpio.length < 200 && !/[{}]|error:|violates|relation /i.test(limpio);
  return pareceNuestro
    ? limpio
    : "No pudimos guardar tu pedido. Si el problema sigue, escribinos por el chat.";
}

/**
 * El insert de antes de la 0087, tal cual estaba. Solo corre mientras
 * la migración no haya pasado; cuando pase, el grant de INSERT ya no
 * existe y este camino deja de ser alcanzable.
 */
async function crearPedidoDirecto({
  supabase,
  clienteId,
  paquete,
  campos,
  datos,
}: {
  supabase: SupabaseClient;
  clienteId: string;
  paquete: PaqueteResuelto;
  campos: {
    tipoEvento: string;
    nombreEvento: string;
    fechaEvento: string;
    contactoNombre: string;
    contactoCorreo: string;
    conAlbum: boolean;
    invitados: number;
    limite: string;
  };
  datos: DatosPedido;
}): Promise<ResultadoPedido> {
  const { data, error } = await supabase
    .from("pedidos_invitacion")
    .insert({
      cliente_id: clienteId,
      paquete: paquete.id,
      precio_usd: paquete.precioUSD,
      precio_crc: paquete.precioCRC,
      monto_crc:
        montoEnColones(paquete) + (campos.conAlbum ? albumEnColones() : 0),
      con_album: campos.conAlbum,
      tipo_evento: campos.tipoEvento,
      nombre_evento: campos.nombreEvento,
      anfitriones: texto(datos, "anfitriones", 200) || null,
      fecha_evento: campos.fechaEvento,
      hora: texto(datos, "hora", 20) || null,
      lugar_nombre: texto(datos, "lugar_nombre", 160) || null,
      lugar_direccion: texto(datos, "lugar_direccion", 300) || null,
      maps_url: texto(datos, "maps_url", 500) || null,
      tematica: texto(datos, "tematica", 200) || null,
      colores: texto(datos, "colores", 160) || null,
      cantidad_invitados:
        Number.isFinite(campos.invitados) && campos.invitados > 0
          ? Math.round(campos.invitados)
          : null,
      fecha_limite_confirmacion: ES_FECHA.test(campos.limite) ? campos.limite : null,
      mensaje: texto(datos, "mensaje", 1200) || null,
      idioma: texto(datos, "idioma", 20) || "es",
      contacto_nombre: campos.contactoNombre,
      contacto_whatsapp: texto(datos, "contacto_whatsapp", 40) || null,
      contacto_correo: campos.contactoCorreo,
      estado: "pendiente_pago",
    })
    .select(
      "id, paquete, tipo_evento, nombre_evento, fecha_evento, hora, lugar_nombre, " +
        "cantidad_invitados, contacto_nombre, contacto_whatsapp, contacto_correo",
    )
    .single();

  if (error || !data) {
    console.error("[pedido] No se pudo guardar:", error?.message);
    return {
      ok: false,
      error: "No pudimos guardar tu pedido. Si el problema sigue, escribinos por el chat.",
    };
  }

  const pedido = data as unknown as PedidoNuevo;
  return { ok: true, pedidoId: String(pedido.id), pedido };
}

/** Una fila "etiqueta: valor" del resumen del pedido. Vacío = no va. */
function filaResumen(etiqueta: string, valor: string | number | null): string {
  if (valor === null || valor === undefined || String(valor).trim() === "") return "";
  return `<p style="margin:0 0 6px;"><strong style="color:#101a2c;">${etiqueta}:</strong> ${escaparHtml(String(valor))}</p>`;
}

/**
 * El aviso a los administradores apenas ENTRA un pedido, antes de que
 * el cliente pague.
 *
 * Este es el correo que evita que algo se pierda. Hasta ahora el único
 * aviso interno salía al registrar el pago: un cliente que llenaba el
 * formulario y no terminaba de pagar quedaba invisible salvo que
 * alguien abriera la pestaña de Pedidos por su cuenta. Y son
 * justamente esos los que hay que ir a buscar por WhatsApp.
 *
 * Nunca lanza: el pedido ya está guardado y el cliente ya está viendo
 * su pantalla de pago.
 */
export async function notificarPedidoNuevo(pedido: PedidoNuevo): Promise<void> {
  const paquete = resolverPaquete(pedido.paquete);
  const evento = pedido.nombre_evento || "un evento";

  await avisarAAdministradores({
    subject: `Pedido nuevo (sin pagar) — ${evento}`,
    html: layoutBento({
      kicker: "Pedido nuevo",
      titulo: "Entró un pedido de invitación",
      introHtml: `${escaparHtml(pedido.contacto_nombre)} llenó el formulario del paquete <strong>${escaparHtml(
        paquete?.nombre ?? pedido.paquete,
      )}</strong> para <strong>${escaparHtml(evento)}</strong>.`,
      naranjaHtml:
        "Todavía no pagó. Si no aparece el comprobante en un par de días, vale la pena escribirle.",
      cuerpoHtml: `
        ${filaResumen("Tipo de evento", pedido.tipo_evento)}
        ${filaResumen("Fecha del evento", pedido.fecha_evento)}
        ${filaResumen("Hora", pedido.hora)}
        ${filaResumen("Lugar", pedido.lugar_nombre)}
        ${filaResumen("Invitados", pedido.cantidad_invitados)}
        ${filaResumen("Contacto", pedido.contacto_nombre)}
        ${filaResumen("WhatsApp", pedido.contacto_whatsapp)}
        ${filaResumen("Correo", pedido.contacto_correo)}
        <p style="margin:12px 0 0;">En el panel está el brief completo, listo para copiar.</p>
      `,
      cta: {
        href: `${SITIO_URL}/admin/invitaciones?tab=pedidos`,
        label: "Ver el pedido en el panel",
      },
      pie: `Aviso interno de ${SLUG_NEGOCIO_INVITACIONES}. Te llega porque tu cuenta es administradora.`,
    }),
  });
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

  // El pago va por la función de la 0087, que toca CUATRO columnas y la
  // fecha. Antes esto era un update abierto: la política solo miraba de
  // quién era el pedido y en qué estado estaba, así que desde el
  // navegador se podía cambiar también el paquete y los montos —
  // pagar un Básico y aparecer en el panel como Legado.
  const { data, error } = await supabase.rpc("registrar_pago_pedido", {
    p_pedido_id: pedidoId,
    p_metodo: metodo,
    p_comprobante_url: comprobanteUrl,
    p_referencia: referencia?.slice(0, 120) || null,
  });

  if (error) {
    if (faltaLa0087(error)) {
      console.warn("[pedido] Falta la migración 0087 — se paga por el camino viejo.");
      return registrarPagoDirecto({
        supabase,
        pedidoId,
        clienteId,
        metodo,
        comprobanteUrl,
        referencia,
      });
    }
    return { ok: false, error: mensajeDePagoDePostgres(error.message) };
  }

  if (!data) {
    return { ok: false, error: "No pudimos registrar tu pago. Intentá de nuevo." };
  }

  return { ok: true, pedido: data as unknown as PedidoPagado };
}

/** Igual que mensajeDePostgres, con el genérico del pago. */
function mensajeDePagoDePostgres(mensaje: string): string {
  const limpio = mensaje.trim();
  const pareceNuestro = limpio.length < 200 && !/[{}]|error:|violates|relation /i.test(limpio);
  return pareceNuestro ? limpio : "No pudimos registrar tu pago. Intentá de nuevo.";
}

/** El update de antes de la 0087; deja de ser alcanzable al correrla. */
async function registrarPagoDirecto({
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
  const nombre = escaparHtml(String(pedido.contacto_nombre ?? ""));
  const evento = escaparHtml(String(pedido.nombre_evento ?? "tu evento"));
  const conPanel = paquete?.tienePanel ?? false;

  await enviarCorreo({
    to: String(pedido.contacto_correo),
    subject: `Recibimos tu pedido — ${String(pedido.nombre_evento ?? "tu evento")}`,
    html: layoutBento({
      kicker: "Invitaciones digitales",
      titulo: "¡Recibimos tu pedido!",
      introHtml: `Hola ${nombre}, ya tenemos los datos de <strong>${evento}</strong> y tu comprobante. Estamos verificando el pago.`,
      naranjaHtml: `Paquete ${escaparHtml(paquete?.nombre ?? "")} · Apenas confirmemos el pago, el equipo empieza a diseñar tu invitación.`,
      cuerpoHtml: `<p style="margin:0 0 12px;">Cuando esté lista te llega un correo con el link para compartir con tus invitados.</p>
        <p style="margin:0;">Entrá con la misma cuenta con la que hiciste el pedido para verla${
          conPanel
            ? " y para abrir tu panel de confirmaciones, donde vas a ver en vivo quién asiste y quién no."
            : "."
        }</p>`,
      cta: { href: `${SITIO_URL}/cuenta`, label: "Ver mi cuenta" },
    }),
  }).catch((e) => console.error("[pedido] correo al cliente:", e));

  // Antes esto salía solo si BOOKEA_CORREO_PEDIDOS estaba configurada:
  // sin ella el equipo no se enteraba de un pago y no había forma de
  // notarlo. Ahora va a todos los administradores de la plataforma.
  await avisarAAdministradores({
    subject: `Comprobante por revisar — ${String(pedido.nombre_evento ?? "un evento")}`,
    html: layoutBento({
      kicker: "Pago registrado",
      titulo: "Un pedido subió su comprobante",
      introHtml: `${nombre} pagó el paquete <strong>${escaparHtml(
        paquete?.nombre ?? pedido.paquete,
      )}</strong> para ${evento} (${escaparHtml(String(pedido.fecha_evento ?? ""))}).`,
      naranjaHtml: "Falta verificar el comprobante y pasar el pedido a diseño.",
      cta: {
        // Directo a la pestaña de Pedidos: la de Invitaciones lista las
        // ya creadas y no muestra los pedidos, que era justo lo que
        // hacía parecer que el formulario no llegaba.
        href: `${SITIO_URL}/admin/invitaciones?tab=pedidos`,
        label: "Ver el pedido en el panel",
      },
      pie: `Aviso interno de ${SLUG_NEGOCIO_INVITACIONES}. Te llega porque tu cuenta es administradora.`,
    }),
  });
}

/** Lo que necesita el correo de "tu invitación está lista". */
export type PedidoEntregado = {
  nombre_evento: string | null;
  contacto_correo: string;
  contacto_nombre: string | null;
  paquete: string;
  /** El slug de la invitación que se le entregó. */
  slug: string;
};

/**
 * El correo que cierra la orden: al cliente, con el link de su
 * invitación ya publicada. Nunca lanza — la entrega ya quedó guardada.
 */
export async function notificarPedidoEntregado(
  pedido: PedidoEntregado,
): Promise<void> {
  const paquete = resolverPaquete(pedido.paquete);
  const nombre = escaparHtml(String(pedido.contacto_nombre ?? ""));
  const evento = escaparHtml(String(pedido.nombre_evento ?? "tu evento"));
  const link = `${SITIO_URL}/i/${pedido.slug}`;
  const conPanel = paquete?.tienePanel ?? false;

  await enviarCorreo({
    to: String(pedido.contacto_correo),
    subject: `Tu invitación está lista — ${String(pedido.nombre_evento ?? "tu evento")}`,
    html: layoutBento({
      kicker: "Invitaciones digitales",
      titulo: "¡Tu invitación está lista!",
      introHtml: `Hola ${nombre}, terminamos la invitación de <strong>${evento}</strong>. Ya es tuya: está en tu cuenta y el link de abajo es el que compartís con tus invitados.`,
      naranjaHtml: `Tu link para compartir: <a href="${link}" style="color:#ffffff;text-decoration:underline;">${escaparHtml(
        link.replace(/^https?:\/\//, ""),
      )}</a>`,
      cuerpoHtml: `<p style="margin:0 0 12px;">Mandalo por WhatsApp, ponelo en tu estado o compartilo donde quieras — se abre en cualquier teléfono, sin que nadie descargue nada.</p>
        ${
          conPanel
            ? `<p style="margin:0;">En tu cuenta tenés el panel de confirmaciones: quién asiste, quién no y cuántas personas llegan en total, en vivo.</p>`
            : `<p style="margin:0;">Cualquier ajuste que necesités, escribinos por el chat de Bookea.</p>`
        }`,
      cta: { href: `${SITIO_URL}/cuenta/invitaciones`, label: "Ver mi invitación" },
      pie: "Recibiste este correo porque pediste una invitación digital en Bookea.",
    }),
  }).catch((e) => console.error("[pedido] correo de entrega:", e));
}
