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
const REMITENTE = process.env.RESEND_FROM_EMAIL || "Aventurea CR <onboarding@resend.dev>";

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

function layout(tituloCorto: string, cuerpoHtml: string) {
  return `
  <div style="background:#f6f7f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e4ea;">
      <div style="background:#1e3a5f;padding:20px 28px;">
        <span style="color:#ffffff;font-weight:800;font-size:15px;letter-spacing:-0.02em;">AVENTUREA CR</span>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 6px;color:#f2831c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;">
          ${tituloCorto}
        </p>
        ${cuerpoHtml}
      </div>
    </div>
    <p style="max-width:520px;margin:16px auto 0;text-align:center;color:#9f9fa9;font-size:11.5px;">
      Aventurea CR — Costa Rica
    </p>
  </div>`;
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
  const fechaLarga = new Date(fecha + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monto = "₡" + Math.round(montoDeposito).toLocaleString("es-CR");

  return layout(
    "Reserva recibida",
    `
      <h1 style="margin:0 0 14px;color:#101a2c;font-size:21px;">Hola ${nombreCliente},</h1>
      <p style="margin:0 0 14px;color:#5b6472;font-size:14px;line-height:1.6;">
        Recibimos tu solicitud de reserva para <strong style="color:#101a2c;">${nombreRancho}</strong>
        el <strong style="color:#101a2c;">${fechaLarga}</strong>, junto con el comprobante de tu depósito
        de ${monto}.
      </p>
      <p style="margin:0 0 14px;color:#5b6472;font-size:14px;line-height:1.6;">
        Tu reserva queda <strong style="color:#101a2c;">en aprobación</strong> mientras ${nombreRancho}
        valida el pago. Te avisamos por este mismo correo o por WhatsApp en cuanto quede confirmada.
      </p>
      <p style="margin:0;color:#9f9fa9;font-size:12.5px;line-height:1.6;">
        Si no reconocés esta reserva, podés ignorar este correo.
      </p>
    `,
  );
}
