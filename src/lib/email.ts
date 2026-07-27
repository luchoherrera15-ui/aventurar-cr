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
const REMITENTE = process.env.RESEND_FROM_EMAIL || "Bookear CR <onboarding@resend.dev>";
const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookearcr.com";

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
}: {
  kicker: string;
  cuerpoHtml: string;
}) {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e4ea;">
          <tr>
            <td style="background:#1e3a5f;padding:22px 30px;border-radius:16px 16px 0 0;">
              <div style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:-0.01em;">
                BOOKEAR<span style="color:#8fb2e0;">CR</span>
              </div>
              <div style="color:#b7c6dc;font-size:11px;letter-spacing:0.06em;margin-top:3px;">
                RESERVAS DE LUGARES Y SERVICIOS PARA EVENTOS
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 30px 8px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#1e3a5f;padding-left:14px;border-left:3px solid #1e3a5f;line-height:1.4;">
                ${kicker}
              </div>
              ${cuerpoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 30px 28px;text-align:center;">
              <div style="height:1px;background:#e2e4ea;margin:0 0 22px;"></div>
              <div style="font-size:12.5px;font-weight:700;color:#101a2c;">Bookear CR</div>
              <a href="${SITIO_URL}" style="font-size:12px;color:#1e3a5f;text-decoration:none;font-weight:700;">bookearcr.com</a>
              <div style="font-size:11px;color:#a3aab5;margin-top:10px;line-height:1.6;">
                Costa Rica · Recibiste este correo porque hiciste una reserva en Bookear CR.
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
  montoDeposito,
}: {
  nombreCliente: string;
  nombreRancho: string;
  fecha: string;
  montoDeposito: number;
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

  return layout({
    kicker: "Reserva recibida",
    cuerpoHtml: `
      <div style="font-size:22px;font-weight:800;color:#101a2c;margin:16px 0 14px;letter-spacing:-0.01em;">
        Hola ${nombre},
      </div>
      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Recibimos tu solicitud de reserva para <strong style="color:#101a2c;">${rancho}</strong>,
        junto con el comprobante de tu depósito.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e4ea;border-radius:12px;padding:4px 18px;margin:22px 0;">
        ${filaDato("Lugar", rancho)}
        ${filaDato("Fecha", fechaLarga)}
        ${filaDato("Depósito recibido", monto)}
        ${filaDato(
          "Estado",
          `<span style="display:inline-block;background:#e1f0e6;color:#1f7a4d;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:100px;">En aprobación</span>`,
        )}
      </table>

      <p style="margin:0 0 16px;color:#5b6472;font-size:14.5px;line-height:1.65;">
        Tu reserva queda <strong style="color:#101a2c;">en aprobación</strong> mientras
        ${rancho} valida el pago. Te avisamos por este mismo correo o por WhatsApp en
        cuanto quede confirmada.
      </p>

      <div style="padding:6px 0 4px;">
        <a href="${SITIO_URL}/ranchos-eventos" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:10px;">
          Ver más lugares en Bookear CR
        </a>
      </div>

      <p style="margin:18px 0 4px;color:#5b6472;font-size:13px;line-height:1.6;">
        Si no reconocés esta reserva, podés ignorar este correo.
      </p>
    `,
  });
}
