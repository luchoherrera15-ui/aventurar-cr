import { Resend } from "resend";

/**
 * Envío de correos transaccionales (confirmaciones de reserva, y lo
 * que se sume después) con Resend.
 *
 * Sin `RESEND_API_KEY` configurada, esto no rompe nada: se registra
 * un aviso en el log del servidor y la reserva sigue su curso igual
 * — el correo es un plus, no algo de lo que dependa poder reservar.
 * Así se puede desplegar este código antes de tener la API key real.
 */

let cliente: Resend | null | undefined;

function obtenerCliente() {
  if (cliente !== undefined) return cliente;
  const apiKey = process.env.RESEND_API_KEY;
  cliente = apiKey ? new Resend(apiKey) : null;
  return cliente;
}

// Mientras no haya un dominio propio verificado en Resend, este es el
// remitente de prueba que Resend habilita para cualquier cuenta nueva
// (solo entrega a la casilla dueña de la cuenta). Verificá tu dominio
// en resend.com/domains y poné RESEND_FROM_EMAIL en Vercel para que
// llegue a cualquier cliente, no solo a vos.
const REMITENTE = process.env.RESEND_FROM_EMAIL || "Bookea <onboarding@resend.dev>";
const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";

export async function enviarCorreo({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = obtenerCliente();
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY no configurada — no se envió "${subject}" a ${to}.`,
    );
    return { enviado: false };
  }

  try {
    const { error } = await resend.emails.send({ from: REMITENTE, to, subject, html });
    if (error) {
      console.error("[email] Resend rechazó el envío:", error);
      return { enviado: false };
    }
    return { enviado: true };
  } catch (err) {
    // Un correo que falla no puede tumbar una reserva que ya se guardó.
    console.error("[email] Error inesperado enviando correo:", err);
    return { enviado: false };
  }
}

// Los datos que van adentro (nombre del cliente, del negocio) los
// escribe el propio cliente en el formulario — se escapan antes de
// meterlos en el HTML igual que cualquier otro dato de un formulario.
function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * El armazón común: header con la marca, tarjeta blanca, pie con el
 * dominio. Tablas + estilos inline porque es lo único que Gmail,
 * Outlook y la app de correo del teléfono renderizan todos igual —
 * un <style> en el head se ignora en varios de esos clientes.
 */
function layout({
  kicker,
  cuerpoHtml,
  pie,
}: {
  kicker: string;
  cuerpoHtml: string;
  /** Por qué le llegó este correo a quien lo abre. Por defecto asume
   *  que es el cliente; los correos que van al dueño del negocio
   *  mandan el suyo, porque él no reservó nada. */
  pie?: string;
}) {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e4ea;">
          <tr>
            <td style="background:#16295e;padding:22px 30px;border-radius:16px 16px 0 0;">
              <div style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:-0.01em;">
                BOOKEAR<span style="color:#f6a05e;">CR</span>
              </div>
              <div style="color:#b7c6dc;font-size:11px;letter-spacing:0.06em;margin-top:3px;">
                RESERVAS DE LUGARES Y SERVICIOS PARA EVENTOS
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 30px 8px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#16295e;padding-left:14px;border-left:3px solid #ee7420;line-height:1.4;">
                ${kicker}
              </div>
              ${cuerpoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 30px 28px;text-align:center;">
              <div style="height:1px;background:#e2e4ea;margin:0 0 22px;"></div>
              <div style="font-size:12.5px;font-weight:700;color:#101a2c;">Bookea</div>
              <a href="${SITIO_URL}" style="font-size:12px;color:#16295e;text-decoration:none;font-weight:700;">bookea.lat</a>
              <div style="font-size:11px;color:#a3aab5;margin-top:10px;line-height:1.6;">
                Costa Rica · ${pie ?? "Recibiste este correo porque hiciste una reserva en Bookea."}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Una fila "etiqueta / valor" dentro de la tarjeta de datos de la reserva. */
function filaDato(etiqueta: string, valorHtml: string) {
  return `
    <tr>
      <td style="padding:13px 0;border-bottom:1px solid #e2e4ea;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#8a93a3;">${etiqueta}</td>
            <td style="font-size:15px;font-weight:700;color:#101a2c;text-align:right;">${valorHtml}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/** Al cliente, apenas envía la reserva (queda "en aprobación"). */
export function plantillaConfirmacionReserva({
  nombreCliente,
  nombreRancho,
  fecha,
  invitados,
  montoDeposito,
  montoPendiente,
}: {
  nombreCliente: string;
  nombreRancho: string;
  fecha: string;
  invitados?: number | null;
  montoDeposito: number;
  montoPendiente?: number;
}) {
  const nombre = escaparHtml(nombreCliente);
  const rancho = escaparHtml(nombreRancho);
  const fechaLarga = new Date(fecha + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monto = "₡" + Math.round(montoDeposito).toLocaleString("es-CR");
  const pendiente =
    montoPendiente !== undefined
      ? "₡" + Math.round(montoPendiente).toLocaleString("es-CR")
      : null;

  return layout({
    kicker: "¡Reserva creada!",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.01em;">
        ¡Reserva creada, ${nombre}!
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Gracias por reservar mediante Bookea. Ya recibimos tu solicitud para
        <strong style="color:#101a2c;">${rancho}</strong> junto con el comprobante de tu depósito
        — acá tenés los datos de tu reserva:
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${filaDato("Lugar", rancho)}
        ${filaDato("Fecha", fechaLarga)}
        ${invitados ? filaDato("Cantidad de personas", String(invitados)) : ""}
        ${filaDato("Adelanto pagado", monto)}
        ${pendiente !== null ? filaDato("Pendiente por cancelar", pendiente) : ""}
        ${filaDato(
          "Estado",
          `<span style="display:inline-block;background:#e1f0e6;color:#1f7a4d;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:100px;">En aprobación</span>`,
        )}
      </table>

      ${
        pendiente !== null
          ? `<p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
              El monto pendiente es de <strong style="color:#101a2c;">${pendiente}</strong> y se
              cancela directamente con ${rancho} el mismo día de tu reserva.
            </p>`
          : ""
      }

      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Tu reserva queda <strong style="color:#101a2c;">en aprobación</strong> mientras
        ${rancho} valida el pago. Te avisamos por este mismo correo o por el chat de Bookea en
        cuanto quede confirmada.
      </p>

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/ranchos-eventos" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          Ver más lugares en Bookea
        </a>
      </div>

      <p style="margin:18px 0 4px;color:#5b6472;font-size:13px;line-height:1.6;">
        Si no reconocés esta reserva, podés ignorar este correo.
      </p>
    `,
  });
}

/**
 * Al cliente, cuando el proveedor le aprueba la reserva. Este es el
 * correo que confirma de verdad: el anterior solo decía "la recibimos".
 */
export function plantillaReservaAprobada({
  nombreCliente,
  nombreRancho,
  fecha,
  tipoEvento,
  invitados,
  montoPendiente,
}: {
  nombreCliente: string;
  nombreRancho: string;
  fecha: string;
  tipoEvento: string | null;
  invitados: number | null;
  montoPendiente: number | null;
}) {
  const nombre = escaparHtml(nombreCliente);
  const rancho = escaparHtml(nombreRancho);
  const fechaLarga = new Date(fecha + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const pendiente =
    montoPendiente && montoPendiente > 0
      ? "₡" + Math.round(montoPendiente).toLocaleString("es-CR")
      : null;

  return layout({
    kicker: "Reserva confirmada",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.01em;">
        ¡Listo ${nombre}, tu reserva quedó confirmada!
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        <strong style="color:#101a2c;">${rancho}</strong> revisó tu pago y confirmó tu reserva.
        La fecha ya es tuya — no hay nada más que tengas que hacer para asegurarla.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${filaDato("Lugar", rancho)}
        ${filaDato("Fecha", fechaLarga)}
        ${tipoEvento ? filaDato("Tipo de evento", escaparHtml(tipoEvento)) : ""}
        ${invitados ? filaDato("Cantidad de personas", String(invitados)) : ""}
        ${pendiente !== null ? filaDato("Pendiente por cancelar", pendiente) : ""}
        ${filaDato(
          "Estado",
          `<span style="display:inline-block;background:#e1f0e6;color:#1f7a4d;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:100px;">Confirmada</span>`,
        )}
      </table>

      ${
        pendiente !== null
          ? `<p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
              Te queda un saldo de <strong style="color:#101a2c;">${pendiente}</strong>, que se
              cancela directamente con ${rancho} el mismo día del evento.
            </p>`
          : ""
      }

      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Guardá este correo como comprobante. Un día antes te vamos a escribir para
        recordarte el evento, y si necesitás coordinar algo con ${rancho} podés
        hacerlo por el chat de Bookea.
      </p>

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/mensajes" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          Abrir mis mensajes
        </a>
      </div>
    `,
  });
}

/** Al dueño del lugar, apenas le entra una reserva nueva por aprobar. */
export function plantillaReservaNuevaProveedor({
  nombreProveedor,
  nombreRancho,
  ranchoId,
  nombreCliente,
  fecha,
  tipoEvento,
  invitados,
  montoDeposito,
}: {
  nombreProveedor: string;
  nombreRancho: string;
  ranchoId: string;
  nombreCliente: string;
  fecha: string;
  tipoEvento: string | null;
  invitados: number | null;
  montoDeposito: number | null;
}) {
  const proveedor = escaparHtml(nombreProveedor);
  const rancho = escaparHtml(nombreRancho);
  const cliente = escaparHtml(nombreCliente);
  const fechaLarga = new Date(fecha + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monto =
    montoDeposito && montoDeposito > 0
      ? "₡" + Math.round(montoDeposito).toLocaleString("es-CR")
      : null;

  return layout({
    kicker: "Nueva reserva",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.01em;">
        Hola ${proveedor},
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Entró una reserva nueva para <strong style="color:#101a2c;">${rancho}</strong>.
        Queda en aprobación hasta que revisés el comprobante del depósito.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${filaDato("Cliente", cliente)}
        ${filaDato("Fecha", fechaLarga)}
        ${tipoEvento ? filaDato("Tipo de evento", escaparHtml(tipoEvento)) : ""}
        ${invitados ? filaDato("Invitados", String(invitados)) : ""}
        ${monto ? filaDato("Depósito", monto) : ""}
        ${filaDato(
          "Estado",
          `<span style="display:inline-block;background:#fdeadb;color:#b45309;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:100px;">Por aprobar</span>`,
        )}
      </table>

      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Revisá el comprobante y confirmala desde tu panel — el cliente ya recibió
        su correo avisándole que la reserva quedó en aprobación.
      </p>

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/mi-rancho/${ranchoId}?tab=reservas" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          Revisar la reserva
        </a>
      </div>
    `,
    pie: "Recibís este correo porque administrás un negocio publicado en Bookea.",
  });
}

/**
 * Al cliente, el día después de su evento: ya puede calificar. El cron
 * diario lo dispara una sola vez por reserva (resena_solicitada).
 */
export function plantillaPedirResena({
  nombreCliente,
  nombreRancho,
}: {
  nombreCliente: string;
  nombreRancho: string;
}) {
  const nombre = escaparHtml(nombreCliente);
  const rancho = escaparHtml(nombreRancho);

  return layout({
    kicker: "¿Cómo te fue?",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.01em;">
        Hola ${nombre},
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        ¡Esperamos que tu evento con <strong style="color:#101a2c;">${rancho}</strong>
        haya salido increíble! Tu opinión vale mucho: las reseñas ayudan a otras
        personas a elegir con confianza, y al proveedor a seguir mejorando.
      </p>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Te toma menos de un minuto — estrellas y, si querés, un comentario.
      </p>
      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/cuenta" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          Calificar mi experiencia
        </a>
      </div>
    `,
  });
}

/**
 * Al dueño de un Lugar: un viernes/sábado/domingo cercano sigue libre —
 * un descuento a tiempo puede ganarle esa fecha. Sale una sola vez por
 * (rancho, fecha), registrado en avisos_finde_libre.
 */
export function plantillaFindeLibre({
  nombreProveedor,
  nombreRancho,
  fecha,
}: {
  nombreProveedor: string;
  nombreRancho: string;
  fecha: string;
}) {
  const nombre = escaparHtml(nombreProveedor);
  const rancho = escaparHtml(nombreRancho);
  const fechaLarga = new Date(fecha + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return layout({
    kicker: "Fecha libre este finde",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.01em;">
        Hola ${nombre},
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Este <strong style="color:#101a2c;">${fechaLarga}</strong> todavía no tiene
        ninguna reserva en <strong style="color:#101a2c;">${rancho}</strong> — y los
        fines de semana son los días que más se buscan.
      </p>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Un descuento de último minuto puede ganarte esa fecha: los días con
        promoción se destacan en el calendario con su etiqueta de rebaja, y a
        quien está comparando opciones eso le decide la reserva.
      </p>
      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/mi-rancho" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          Poner un descuento
        </a>
      </div>
      <p style="margin:18px 0 4px;color:#5b6472;font-size:13px;line-height:1.6;">
        Este aviso sale solo cuando un fin de semana cercano está libre — no
        te vamos a escribir por cada fecha.
      </p>
    `,
    pie: "Recibís este correo porque administrás un negocio publicado en Bookea.",
  });
}

/** Recordatorio de evento — sale 1 día antes, al cliente y al proveedor. */
export function plantillaRecordatorioEvento({
  nombreDestinatario,
  nombreRancho,
  fecha,
  esProveedor,
  tipoEvento,
  invitados,
}: {
  nombreDestinatario: string;
  nombreRancho: string;
  fecha: string;
  esProveedor: boolean;
  tipoEvento: string | null;
  invitados: number | null;
}) {
  const nombre = escaparHtml(nombreDestinatario);
  const rancho = escaparHtml(nombreRancho);
  const fechaLarga = new Date(fecha + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return layout({
    kicker: "Tu evento es mañana",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.01em;">
        Hola ${nombre},
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        ${
          esProveedor
            ? `Recordatorio: mañana tenés un evento agendado en <strong style="color:#101a2c;">${rancho}</strong>.`
            : `Recordatorio: mañana es tu evento en <strong style="color:#101a2c;">${rancho}</strong>.`
        }
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${filaDato("Fecha", fechaLarga)}
        ${tipoEvento ? filaDato("Tipo de evento", escaparHtml(tipoEvento)) : ""}
        ${invitados ? filaDato("Invitados", String(invitados)) : ""}
      </table>

      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        ${
          esProveedor
            ? "Revisá tu agenda en el panel para tener todo listo."
            : "Si tenés alguna duda de último minuto, escribile al proveedor por el chat de Bookea."
        }
      </p>

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}${esProveedor ? "/mi-rancho" : "/mensajes"}" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          ${esProveedor ? "Abrir mi panel" : "Abrir mis mensajes"}
        </a>
      </div>
    `,
    pie: esProveedor
      ? "Recibís este correo porque administrás un negocio publicado en Bookea."
      : undefined,
  });
}
