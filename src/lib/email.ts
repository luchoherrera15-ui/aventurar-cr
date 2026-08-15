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
  bajaOneClickUrl,
}: {
  to: string;
  subject: string;
  html: string;
  /** Correos de MARKETING: el endpoint one-click del destinatario
   * (enlacesBaja().oneClick, 0082). Va en las cabeceras
   * List-Unsubscribe (RFC 8058) para el botón "Cancelar suscripción"
   * de Gmail/Apple; el link visible del pie lo pinta la plantilla. */
  bajaOneClickUrl?: string;
}) {
  const resend = obtenerCliente();
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY no configurada — no se envió "${subject}" a ${to}.`,
    );
    return { enviado: false };
  }

  try {
    const { error } = await resend.emails.send({
      from: REMITENTE,
      to,
      subject,
      html,
      ...(bajaOneClickUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${bajaOneClickUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });
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
// Se exporta porque los correos que se arman fuera de este archivo
// (los avisos de pedidos, por ejemplo) meten los mismos datos de
// formulario en su HTML y necesitan el mismo cuidado.
export function escaparHtml(texto: string) {
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e2e4ea;">
          <tr>
            <td style="background:#16295e;padding:22px 30px;border-radius:14px 14px 0 0;">
              <div style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:-0.025em;">
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

/**
 * El armazón "bento" nuevo (línea visual de /publicar): tarjeta navy
 * con kicker naranja y título grande, tarjeta naranja con el mensaje
 * clave, tarjeta blanca con los datos en números grandes y CTA en
 * píldora naranja. Tablas + estilos inline, como el layout clásico.
 */
export function layoutBento({
  kicker,
  titulo,
  introHtml,
  naranjaHtml,
  statsHtml,
  cuerpoHtml,
  cta,
  pie,
  bajaUrl,
}: {
  kicker: string;
  titulo: string;
  introHtml?: string;
  /** El mensaje clave que va en la tarjeta naranja. */
  naranjaHtml?: string;
  /** Celdas <td> de statBento con los datos grandes. */
  statsHtml?: string;
  cuerpoHtml?: string;
  cta?: { href: string; label: string };
  pie?: string;
  /** Correos de MARKETING: el link "Darme de baja" del destinatario
   * (urlBaja). Los transaccionales no lo llevan. */
  bajaUrl?: string;
}) {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="background:#16295e;border-radius:18px;padding:34px 32px 30px;">
              <div style="color:#ee7420;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">
                &#10022; ${kicker}
              </div>
              <div style="color:#ffffff;font-size:27px;line-height:1.05;font-weight:800;letter-spacing:-0.025em;margin-top:14px;">
                ${titulo}
              </div>
              ${introHtml ? `<div style="color:#c7d2e6;font-size:14px;line-height:1.65;margin-top:12px;">${introHtml}</div>` : ""}
            </td>
          </tr>
          ${
            naranjaHtml
              ? `<tr>
            <td style="padding-top:12px;">
              <div style="background:#ee7420;border-radius:14px;padding:20px 24px;color:#ffffff;font-size:14.5px;font-weight:700;line-height:1.6;">
                ${naranjaHtml}
              </div>
            </td>
          </tr>`
              : ""
          }
          ${
            statsHtml
              ? `<tr>
            <td style="padding-top:12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e2e2;border-radius:14px;padding:14px 12px;">
                <tr>${statsHtml}</tr>
              </table>
            </td>
          </tr>`
              : ""
          }
          ${
            cuerpoHtml
              ? `<tr>
            <td style="padding-top:12px;">
              <div style="background:#ffffff;border:1px solid #e2e2e2;border-radius:14px;padding:22px 24px;color:#585858;font-size:14px;line-height:1.65;">
                ${cuerpoHtml}
              </div>
            </td>
          </tr>`
              : ""
          }
          ${
            cta
              ? `<tr>
            <td align="center" style="padding-top:18px;">
              <a href="${cta.href}" style="display:inline-block;background:#ee7420;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 28px;border-radius:12px;">
                ${cta.label}
              </a>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td align="center" style="padding:22px 10px 6px;">
              <div style="font-size:12.5px;font-weight:700;color:#101a2c;">Bookea</div>
              <a href="${SITIO_URL}" style="font-size:12px;color:#16295e;text-decoration:none;font-weight:700;">bookea.lat</a>
              <div style="font-size:11px;color:#a3aab5;margin-top:8px;line-height:1.6;">
                Costa Rica · ${pie ?? "Recibiste este correo porque hiciste una reserva en Bookea."}
              </div>
              ${
                bajaUrl
                  ? `<div style="font-size:11px;margin-top:6px;">
                <a href="${bajaUrl}" style="color:#a3aab5;text-decoration:underline;">Darme de baja de estos correos</a>
              </div>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Una celda de dato grande (estilo tarjeta de stats de /publicar). */
function statBento(valor: string, etiqueta: string) {
  return `<td width="50%" style="padding:12px 14px;vertical-align:top;">
    <div style="font-size:20px;font-weight:800;color:#101a2c;letter-spacing:-0.025em;line-height:1.2;">${valor}</div>
    <div style="font-size:11.5px;color:#585858;margin-top:4px;line-height:1.5;">${etiqueta}</div>
  </td>`;
}

/** Una fila "etiqueta / valor" dentro de la tarjeta de datos de la reserva. */
/**
 * Enlaces para guardar la reserva en el calendario del teléfono con
 * un toque: el de Google abre el evento prellenado, y el .ics (que
 * sirve /api/calendario/[id]) lo abre Apple Calendar y Outlook.
 * Costa Rica no tiene horario de verano, así que la conversión a UTC
 * es un +6 fijo.
 */
export function enlacesCalendario({
  reservaId,
  titulo,
  fecha,
  horaInicio,
  duracionMinutos,
  ubicacion,
}: {
  reservaId: string;
  titulo: string;
  /** YYYY-MM-DD. */
  fecha: string;
  /** "HH:MM"; null = evento de día completo (eventos de salón). */
  horaInicio: string | null;
  duracionMinutos: number;
  ubicacion: string | null;
}): { google: string; ics: string } {
  const compactaUtc = (d: Date) =>
    `${d.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  let dates: string;
  if (horaInicio) {
    const inicio = new Date(`${fecha}T${horaInicio}:00-06:00`);
    const fin = new Date(inicio.getTime() + duracionMinutos * 60_000);
    dates = `${compactaUtc(inicio)}/${compactaUtc(fin)}`;
  } else {
    // Día completo: de la fecha al día siguiente, sin horas.
    const siguiente = new Date(`${fecha}T00:00:00Z`);
    siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    dates = `${fecha.replace(/-/g, "")}/${siguiente.toISOString().slice(0, 10).replace(/-/g, "")}`;
  }

  const parametros = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates,
    details: "Reservado en Bookea — el comprobante está en tu correo.",
  });
  if (ubicacion) parametros.set("location", ubicacion);

  return {
    google: `https://calendar.google.com/calendar/render?${parametros.toString()}`,
    ics: `${SITIO_URL}/api/calendario/${reservaId}`,
  };
}

/** Los dos botones de "guardar en mi calendario" para los correos. */
export function bloqueCalendario(enlaces: { google: string; ics: string }) {
  return `
      <div style="margin:20px 0 6px;">
        <p style="margin:0 0 8px;color:#5b6472;font-size:12.5px;">
          Guardá la fecha en el calendario de tu teléfono con un toque:
        </p>
        <a href="${enlaces.google}" style="display:inline-block;margin:0 8px 8px 0;border:1.5px solid #16295e;border-radius:10px;color:#16295e;font-size:13px;font-weight:700;padding:10px 16px;text-decoration:none;">
          Google Calendar
        </a>
        <a href="${enlaces.ics}" style="display:inline-block;margin:0 0 8px 0;border:1.5px solid #e2e4ea;border-radius:10px;color:#101a2c;font-size:13px;font-weight:700;padding:10px 16px;text-decoration:none;">
          Apple / Outlook (.ics)
        </a>
      </div>
  `;
}

function filaDato(etiqueta: string, valorHtml: string) {
  return `
    <tr>
      <td style="padding:13px 0;border-bottom:1px solid #e2e4ea;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#8a93a3;">${etiqueta}</td>
            <td style="font-size:15px;font-weight:800;color:#101a2c;text-align:right;">${valorHtml}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * Al cliente, apenas envía la reserva (queda "en aprobación").
 * Sin el nombre del negocio a propósito: el correo habla de "su
 * reserva en Bookea.lat" — fecha, horario y saldo pendiente.
 */
export function plantillaConfirmacionReserva({
  nombreCliente,
  fecha,
  horario,
  invitados,
  montoDeposito,
  montoPendiente,
}: {
  nombreCliente: string;
  fecha: string;
  /** Etiqueta del bloque, ej. "5:00 p. m. – 10:00 p. m." */
  horario?: string | null;
  invitados?: number | null;
  montoDeposito: number;
  montoPendiente?: number;
}) {
  const nombre = escaparHtml(nombreCliente);
  const fechaLarga = new Date(fecha + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monto = "₡" + Math.round(montoDeposito).toLocaleString("es-CR");
  const pendiente =
    montoPendiente !== undefined && montoPendiente > 0
      ? "₡" + Math.round(montoPendiente).toLocaleString("es-CR")
      : null;

  return layoutBento({
    kicker: "Reserva recibida",
    titulo: "Su reserva en Bookea.lat fue exitosa",
    introHtml: `Gracias por reservar, ${nombre}. Recibimos su reserva junto con el
      comprobante del depósito — queda <strong style="color:#ffffff;">en aprobación</strong>
      y le avisamos por este mismo correo en cuanto quede confirmada.`,
    naranjaHtml: pendiente
      ? `Su saldo pendiente de ${pendiente} lo deberá cancelar el día del evento.`
      : `Su saldo pendiente lo deberá cancelar el día del evento.`,
    statsHtml:
      statBento(fechaLarga, "Fecha del evento") +
      statBento(horario ? escaparHtml(horario) : "A coordinar", "Horario"),
    cuerpoHtml: `
      ${invitados ? `<p style="margin:0 0 10px;"><strong style="color:#101a2c;">${invitados}</strong> personas reservadas.</p>` : ""}
      <p style="margin:0 0 10px;">Adelanto pagado: <strong style="color:#101a2c;">${monto}</strong>.</p>
      <p style="margin:0;">Guarde este correo como comprobante. Si no reconoce esta reserva, puede ignorarlo.</p>
    `,
    cta: { href: `${SITIO_URL}/cuenta`, label: "Ver mi reserva" },
  });
}

/**
 * Al cliente, cuando el proveedor le aprueba la reserva. Este es el
 * correo que confirma de verdad: el anterior solo decía "la recibimos".
 */
export function plantillaReservaAprobada({
  nombreCliente,
  fecha,
  horario,
  tipoEvento,
  invitados,
  montoPendiente,
  calendario,
}: {
  nombreCliente: string;
  fecha: string;
  /** Etiqueta del bloque, ej. "5:00 p. m. – 10:00 p. m." */
  horario?: string | null;
  tipoEvento: string | null;
  invitados: number | null;
  montoPendiente: number | null;
  /** Enlaces de "guardar en mi calendario" (enlacesCalendario). */
  calendario?: { google: string; ics: string };
}) {
  const nombre = escaparHtml(nombreCliente);
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

  return layoutBento({
    kicker: "Reserva confirmada",
    titulo: `¡Listo ${nombre}, su reserva quedó confirmada!`,
    introHtml: `El pago fue validado y la fecha ya es suya — no hay nada más que
      tenga que hacer para asegurarla. Guarde este correo como comprobante.`,
    naranjaHtml: pendiente
      ? `Su saldo pendiente de ${pendiente} lo deberá cancelar el día del evento.`
      : `Su saldo pendiente lo deberá cancelar el día del evento.`,
    statsHtml:
      statBento(fechaLarga, "Fecha del evento") +
      statBento(horario ? escaparHtml(horario) : "A coordinar", "Horario"),
    cuerpoHtml: `
      ${tipoEvento ? `<p style="margin:0 0 10px;">Tipo de evento: <strong style="color:#101a2c;">${escaparHtml(tipoEvento)}</strong>.</p>` : ""}
      ${invitados ? `<p style="margin:0 0 10px;"><strong style="color:#101a2c;">${invitados}</strong> personas reservadas.</p>` : ""}
      <p style="margin:0 0 10px;">Un día antes le vamos a escribir para recordarle el evento. Cualquier
      coordinación la puede hacer por el chat de Bookea.</p>
      ${calendario ? bloqueCalendario(calendario) : ""}
    `,
    cta: { href: `${SITIO_URL}/mensajes`, label: "Abrir mis mensajes" },
  });
}

/** Al dueño del lugar, apenas le entra una reserva nueva por aprobar. */
export function plantillaReservaNuevaProveedor({
  nombreProveedor,
  nombreRancho,
  ranchoId,
  nombreCliente,
  fecha,
  horario,
  tipoEvento,
  invitados,
  montoDeposito,
  montoPendiente,
}: {
  nombreProveedor: string;
  nombreRancho: string;
  ranchoId: string;
  nombreCliente: string;
  fecha: string;
  /** El bloque de horario que eligió el cliente, si el negocio maneja. */
  horario?: string | null;
  tipoEvento: string | null;
  invitados: number | null;
  montoDeposito: number | null;
  /** Lo que queda por cobrar el día del evento (total − adelanto). */
  montoPendiente?: number | null;
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
  const colones = (n: number) => "₡" + Math.round(n).toLocaleString("es-CR");
  const monto = montoDeposito && montoDeposito > 0 ? colones(montoDeposito) : null;
  const pendiente =
    montoPendiente !== null && montoPendiente !== undefined && montoPendiente > 0
      ? colones(montoPendiente)
      : null;

  return layout({
    kicker: "Nueva reserva",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.025em;line-height:1.05;">
        Hola ${proveedor},
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Tu agenda de <strong style="color:#101a2c;">${rancho}</strong> quedó tomada
        para el <strong style="color:#101a2c;">${fechaLarga}</strong>. La reserva
        queda en aprobación hasta que revisés el comprobante del depósito.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${filaDato("Cliente", cliente)}
        ${filaDato("Fecha", fechaLarga)}
        ${horario ? filaDato("Horario", escaparHtml(horario)) : ""}
        ${tipoEvento ? filaDato("Tipo de evento", escaparHtml(tipoEvento)) : ""}
        ${invitados ? filaDato("Cantidad de personas", String(invitados)) : ""}
        ${monto ? filaDato("Adelanto", monto) : ""}
        ${pendiente ? filaDato("Pendiente de cobro", pendiente) : ""}
        ${filaDato(
          "Estado",
          `<span style="display:inline-block;background:#fdeadb;color:#b45309;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:8px;">Por aprobar</span>`,
        )}
      </table>

      ${
        pendiente
          ? `<p style="margin:0 0 16px;color:#5b6472;font-size:13.5px;line-height:1.6;">
               El adelanto es lo que el cliente ya transfirió; el
               <strong style="color:#101a2c;">pendiente de cobro</strong> es lo que
               le cobrás el día del evento.
             </p>`
          : ""
      }

      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Revisá el comprobante y confirmala desde tu panel — el cliente ya recibió
        su correo avisándole que la reserva quedó en aprobación.
      </p>

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/mi-negocio/${ranchoId}?tab=agenda" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
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
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.025em;line-height:1.05;">
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
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.025em;line-height:1.05;">
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
        <a href="${SITIO_URL}/mi-negocio" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
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
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.025em;line-height:1.05;">
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
        <a href="${SITIO_URL}${esProveedor ? "/mi-negocio" : "/mensajes"}" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          ${esProveedor ? "Abrir mi panel" : "Abrir mis mensajes"}
        </a>
      </div>
    `,
    pie: esProveedor
      ? "Recibís este correo porque administrás un negocio publicado en Bookea."
      : undefined,
  });
}

/**
 * Al proveedor, la mañana del evento: recordale cobrar el saldo antes
 * de que el auto-cobro de la noche (~11pm hora CR) lo dé por cobrado
 * solo. Únicamente al proveedor — el cliente no recibe este aviso, es
 * un recordatorio de cobranza para quien cobra, no un cobro en sí.
 */
export function plantillaRecordatorioCobro({
  nombreProveedor,
  nombreRancho,
  ranchoId,
  nombreEvento,
  saldoPendiente,
}: {
  nombreProveedor: string;
  nombreRancho: string;
  ranchoId: string;
  nombreEvento: string | null;
  saldoPendiente: number;
}) {
  const proveedor = escaparHtml(nombreProveedor);
  const rancho = escaparHtml(nombreRancho);
  const monto = "₡" + Math.round(saldoPendiente).toLocaleString("es-CR");

  return layoutBento({
    kicker: "Hoy cobrás",
    titulo: `Hola ${proveedor}, hoy es el evento en ${rancho}`,
    introHtml: `Antes de que termine el día, Bookea va a marcar el saldo como
      cobrado automáticamente, como red de seguridad — si todavía no lo
      recibiste, cobralo hoy mismo.`,
    naranjaHtml: `Saldo pendiente: ${monto}${nombreEvento ? ` — ${escaparHtml(nombreEvento)}` : ""}.`,
    cuerpoHtml: `
      <p style="margin:0;">Cuando el cliente te pague, marcalo en tu panel para que
      tus finanzas queden al día.</p>
    `,
    cta: {
      href: `${SITIO_URL}/mi-negocio/${ranchoId}?tab=finanzas`,
      label: "Registrar el cobro",
    },
    pie: "Recibís este correo porque administrás un negocio publicado en Bookea.",
  });
}

/** Recordatorio de cita — sale 1 día antes, al cliente y al negocio. */
export function plantillaRecordatorioCita({
  nombreDestinatario,
  nombreNegocio,
  fecha,
  hora,
  servicio,
  esProveedor,
}: {
  nombreDestinatario: string;
  nombreNegocio: string;
  fecha: string;
  /** Ya formateada para leer, ej. "2:30 p. m.". */
  hora: string;
  servicio: string | null;
  esProveedor: boolean;
}) {
  const nombre = escaparHtml(nombreDestinatario);
  const negocio = escaparHtml(nombreNegocio);
  const fechaLarga = new Date(fecha + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return layout({
    kicker: "Tu cita es mañana",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.025em;line-height:1.05;">
        Hola ${nombre},
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        ${
          esProveedor
            ? `Recordatorio: mañana tenés una cita agendada en <strong style="color:#101a2c;">${negocio}</strong>.`
            : `Recordatorio: mañana es tu cita en <strong style="color:#101a2c;">${negocio}</strong>.`
        }
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${servicio ? filaDato("Servicio", escaparHtml(servicio)) : ""}
        ${filaDato("Fecha", fechaLarga)}
        ${filaDato("Hora", escaparHtml(hora))}
      </table>

      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        ${
          esProveedor
            ? "Revisá tu agenda en el panel para tener todo listo."
            : "Si no vas a poder llegar, avisale al negocio por el chat de Bookea con tiempo."
        }
      </p>

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}${esProveedor ? "/mi-negocio" : "/mensajes"}" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          ${esProveedor ? "Abrir mi panel" : "Abrir mis mensajes"}
        </a>
      </div>
    `,
    pie: esProveedor
      ? "Recibís este correo porque administrás un negocio publicado en Bookea."
      : undefined,
  });
}

/** Cita confirmada al instante (vertical de Citas) — para el cliente. */
export function plantillaCitaConfirmada({
  nombreCliente,
  nombreNegocio,
  servicio,
  fechaLarga,
  hora,
  duracionMinutos,
  monto,
  nombreMiembro,
  reservaId,
  calendario,
  deposito,
  sinpe,
}: {
  nombreCliente: string;
  nombreNegocio: string;
  servicio: string;
  fechaLarga: string;
  hora: string;
  duracionMinutos: number;
  monto: number | null;
  nombreMiembro: string | null;
  reservaId: string;
  /** Enlaces de "guardar en mi calendario" (enlacesCalendario). */
  calendario?: { google: string; ics: string };
  /** Depósito para asegurar la cita (0095); ausente/0 = sin depósito. */
  deposito?: number | null;
  /** Cuenta SINPE del negocio para las instrucciones del depósito. */
  sinpe?: { numero: string | null; titular: string | null } | null;
}) {
  return layout({
    kicker: "Cita confirmada",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.025em;line-height:1.05;">
        ¡Tu cita quedó confirmada!
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Hola ${escaparHtml(nombreCliente)} — tu cita en
        <strong style="color:#101a2c;">${escaparHtml(nombreNegocio)}</strong>
        quedó confirmada. No tenés que hacer nada más: llegá a tu hora.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${filaDato("Servicio", escaparHtml(servicio))}
        ${filaDato("Fecha", escaparHtml(fechaLarga))}
        ${filaDato("Hora", escaparHtml(hora) + " · " + duracionMinutos + " min")}
        ${nombreMiembro ? filaDato("Te atiende", escaparHtml(nombreMiembro)) : ""}
        ${monto !== null ? filaDato("Precio", "₡" + Number(monto).toLocaleString("es-CR") + (deposito && deposito > 0 ? "" : " — se paga en el local")) : ""}
      </table>

      ${
        deposito && deposito > 0
          ? `<div style="background:#fdeee1;border:1px solid #f3c9a4;border-radius:12px;padding:16px 18px;margin:0 0 18px;">
        <div style="font-size:14px;font-weight:800;color:#101a2c;">
          Asegurá tu cita con el depósito de ₡${Number(deposito).toLocaleString("es-CR")}
        </div>
        <p style="margin:6px 0 0;color:#5b6472;font-size:13.5px;line-height:1.6;">
          ${
            sinpe?.numero
              ? `Por SINPE Móvil al <strong style="color:#101a2c;">${escaparHtml(sinpe.numero)}</strong>${sinpe.titular ? ` (a nombre de ${escaparHtml(sinpe.titular)})` : ""}.`
              : "El negocio te pasa los datos de SINPE por el chat."
          }
          Cuando lo hagás, mandá el comprobante por el chat de tu cita.
        </p>
      </div>`
          : ""
      }

      ${calendario ? bloqueCalendario(calendario) : ""}

      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Si necesitás cambiar o cancelar, escribile al negocio por el chat
        de Bookea con tiempo.
      </p>

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/mensajes/${reservaId}" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          Abrir el chat del negocio
        </a>
      </div>
    `,
  });
}

/** Cita nueva (vertical de Citas) — para el dueño del negocio. */
export function plantillaCitaNuevaProveedor({
  nombreProveedor,
  nombreNegocio,
  nombreCliente,
  servicio,
  fechaLarga,
  hora,
  nombreMiembro,
  calendario,
}: {
  nombreProveedor: string;
  nombreNegocio: string;
  nombreCliente: string;
  servicio: string;
  fechaLarga: string;
  hora: string;
  nombreMiembro: string | null;
  /** Enlaces de "guardar en mi calendario" (enlacesCalendario). */
  calendario?: { google: string; ics: string };
}) {
  return layout({
    kicker: "Cita nueva",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.025em;line-height:1.05;">
        Tenés una cita nueva
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Hola ${escaparHtml(nombreProveedor)} —
        <strong style="color:#101a2c;">${escaparHtml(nombreCliente)}</strong>
        reservó una cita en
        <strong style="color:#101a2c;">${escaparHtml(nombreNegocio)}</strong>.
        Quedó confirmada al instante; ya aparece en tu agenda.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${filaDato("Servicio", escaparHtml(servicio))}
        ${filaDato("Fecha", escaparHtml(fechaLarga))}
        ${filaDato("Hora", escaparHtml(hora))}
        ${nombreMiembro ? filaDato("Atiende", escaparHtml(nombreMiembro)) : ""}
      </table>

      ${calendario ? bloqueCalendario(calendario) : ""}

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/mi-negocio" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          Ver mi agenda
        </a>
      </div>
    `,
    pie: "Recibís este correo porque administrás un negocio publicado en Bookea.",
  });
}

/** Tope del mensaje que se copia adentro del correo (la columna admite
 *  2000, pero un correo con la novela entera no lo lee nadie). */
const LARGO_MENSAJE_EN_CORREO = 1500;

/**
 * Mensaje nuevo del chat — el aviso que reemplaza al correo de "reserva
 * nueva" para los proveedores de servicios de eventos, que desde el
 * cambio a agenda por consulta ya no reciben reservas sino hilos de
 * chat.
 *
 * Sale UNA vez por conversación abierta (o después de mucho silencio):
 * el criterio vive en src/lib/correo/aviso-mensaje.ts. Es
 * transaccional — el trabajo entrando al negocio —, así que no lleva
 * link de baja, igual que el aviso de reserva nueva.
 */
export function plantillaMensajeNuevo({
  nombreDestinatario,
  nombreNegocio,
  nombreQuienEscribe,
  textoMensaje,
  urlHilo,
  paraProveedor,
  esPrimerMensaje,
}: {
  nombreDestinatario: string;
  nombreNegocio: string;
  /** Quién escribió — "Un cliente" cuando la consulta es anónima. */
  nombreQuienEscribe: string;
  textoMensaje: string;
  /** El link directo AL HILO, no a la bandeja. */
  urlHilo: string;
  /** true = le llega al dueño del negocio; false = al cliente. */
  paraProveedor: boolean;
  esPrimerMensaje: boolean;
}) {
  const destinatario = escaparHtml(nombreDestinatario);
  const negocio = escaparHtml(nombreNegocio);
  const quien = escaparHtml(nombreQuienEscribe);
  const recortado =
    textoMensaje.length > LARGO_MENSAJE_EN_CORREO
      ? `${textoMensaje.slice(0, LARGO_MENSAJE_EN_CORREO).trimEnd()}…`
      : textoMensaje;
  // Escapar PRIMERO y recién después los saltos de línea: al revés, los
  // <br> que se acaban de poner se escaparían a sí mismos. El resumen
  // que arma la agenda viene en varias líneas y se lee así.
  const cuerpoMensaje = escaparHtml(recortado).replace(/\n/g, "<br />");

  const intro = paraProveedor
    ? `<strong style="color:#101a2c;">${quien}</strong> ${
        esPrimerMensaje ? "te escribió una consulta" : "te escribió"
      } por el chat de <strong style="color:#101a2c;">${negocio}</strong>.
       Contestale desde acá — en este tipo de servicio, el que responde primero
       se queda con el cliente.`
    : `<strong style="color:#101a2c;">${negocio}</strong> te escribió por el chat
       de Bookea. Podés seguir la conversación desde el mismo hilo.`;

  return layout({
    kicker: paraProveedor
      ? esPrimerMensaje
        ? "Consulta nueva"
        : "Mensaje nuevo"
      : "Te escribieron",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.025em;line-height:1.05;">
        Hola ${destinatario},
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        ${intro}
      </p>

      <div style="background:#f6f7f9;border:1px solid #e2e4ea;border-left:3px solid #ee7420;border-radius:12px;padding:16px 18px;margin:22px 0;color:#101a2c;font-size:14px;line-height:1.65;">
        ${cuerpoMensaje}
      </div>

      <div style="padding:6px 0 4px;">
        <a href="${urlHilo}" style="display:inline-block;background:#16295e;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          ${paraProveedor ? "Responder la consulta" : "Abrir el chat"}
        </a>
      </div>

      <p style="margin:18px 0 4px;color:#5b6472;font-size:13px;line-height:1.6;">
        Este aviso sale cuando se abre una conversación —o cuando vuelve a
        moverse después de un buen rato—, no por cada mensaje.
      </p>
    `,
    pie: paraProveedor
      ? "Recibís este correo porque administrás un negocio publicado en Bookea."
      : "Recibiste este correo porque tenés una conversación abierta en Bookea.",
  });
}

/**
 * Campaña de correo del admin (novedades, anuncios): título grande en
 * la tarjeta navy, el mensaje en la tarjeta blanca y CTA opcional.
 * El que llama es responsable de escapar el texto libre (titulo y
 * mensajeHtml llegan ya listos para meter en el HTML).
 */
/**
 * El aviso diario de la agenda de un negocio de citas (cron): citas de
 * ayer que quedaron sin marcar (¿vino o no vino?) y clientes que ya
 * fallaron dos veces seguidas — con el CTA al panel para resolverlo.
 * Es transaccional (estado de SU agenda), no lleva link de baja.
 */
export function plantillaAvisoAgenda({
  nombreProveedor,
  nombreNegocio,
  ranchoId,
  sinMarcar,
  reincidentes,
}: {
  nombreProveedor: string;
  nombreNegocio: string;
  ranchoId: string;
  sinMarcar: { hora: string; nombre: string | null; servicio: string | null }[];
  reincidentes: { nombre: string | null; fallosSeguidos: number }[];
}) {
  const filasSinMarcar = sinMarcar
    .slice(0, 8)
    .map(
      (c) =>
        `<div style="padding:6px 0;border-bottom:1px solid #efefef;">
          <strong style="color:#101a2c;">${escaparHtml(c.hora)}</strong>
          · ${escaparHtml(c.nombre ?? "Cliente")}
          ${c.servicio ? `· ${escaparHtml(c.servicio)}` : ""}
        </div>`,
    )
    .join("");
  const masSinMarcar =
    sinMarcar.length > 8
      ? `<div style="padding:6px 0;color:#585858;">y ${sinMarcar.length - 8} más…</div>`
      : "";

  const bloqueReincidentes =
    reincidentes.length > 0
      ? `<div style="margin-top:14px;">
          <strong style="color:#101a2c;">Clientes que te están fallando:</strong>
          ${reincidentes
            .slice(0, 5)
            .map(
              (r) =>
                `<div style="padding:6px 0;border-bottom:1px solid #efefef;">
                  ${escaparHtml(r.nombre ?? "Un cliente")} — faltó a sus últimas
                  ${r.fallosSeguidos} citas seguidas.
                </div>`,
            )
            .join("")}
          <div style="margin-top:8px;color:#585858;">
            Desde la sección <strong>Clientes</strong> de tu panel podés
            mandarles una promoción para recuperarlos.
          </div>
        </div>`
      : "";

  return layoutBento({
    kicker: escaparHtml(nombreNegocio),
    titulo:
      sinMarcar.length > 0
        ? `Tenés ${sinMarcar.length} cita${sinMarcar.length === 1 ? "" : "s"} de ayer sin marcar`
        : "Tenés clientes por recuperar",
    introHtml: `Hola ${escaparHtml(nombreProveedor)}. ${
      sinMarcar.length > 0
        ? "Marcá si el cliente vino o no: así tus números de asistencia (y los puntos de lealtad) quedan al día."
        : "El sistema detectó clientes que dejaron de venir."
    }`,
    cuerpoHtml: `${filasSinMarcar}${masSinMarcar}${bloqueReincidentes}` || undefined,
    cta: {
      href: `${SITIO_URL}/mi-negocio/${ranchoId}/citas`,
      label: "Abrir mi agenda",
    },
    pie: "Recibiste este correo porque tenés un negocio publicado en Bookea.",
  });
}

export function plantillaCampana({
  titulo,
  mensajeHtml,
  cta,
  bajaUrl,
  kicker,
  pie,
}: {
  titulo: string;
  mensajeHtml: string;
  cta?: { href: string; label: string };
  /** El link de baja del DESTINATARIO (urlBaja) — obligatorio para
   * campañas reales; el HTML varía por persona a propósito. */
  bajaUrl?: string;
  /** Campañas POR NEGOCIO: el nombre del negocio como kicker y un pie
   * que explica que escribe el negocio a través de Bookea. Sin estos,
   * es la campaña de plataforma de siempre. */
  kicker?: string;
  pie?: string;
}) {
  return layoutBento({
    kicker: kicker ?? "Novedades",
    titulo,
    cuerpoHtml: mensajeHtml,
    cta,
    pie: pie ?? "Recibiste este correo porque tenés una cuenta en Bookea.",
    bajaUrl,
  });
}
