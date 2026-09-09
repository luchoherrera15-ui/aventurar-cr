import { enviarCorreo, escaparHtml } from "@/lib/email";
import { fmtMoneda, type Moneda } from "@/lib/monedas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL COMPROBANTE DE PAGO — lo que le llega al cliente cuando cobra
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (9 sep 2026): «un comprobante que le llegue al correo
 * del cliente cuando paga alguna suscripción, a nivel general de la
 * página; algo genérico, para que quede identificado».
 *
 * ── QUÉ ES ESTO, Y QUÉ NO ES ────────────────────────────────────────
 * Es un COMPROBANTE (recibo): la constancia de que Bookea cobró, qué
 * cobró, cuánto y por qué período. Sirve para el respaldo del cliente y
 * para su contador.
 *
 * NO es una factura electrónica de Hacienda. Ese documento lleva clave
 * numérica, consecutivo autorizado y firma digital, y se emite desde un
 * proveedor autorizado. Por eso este correo NUNCA dice «factura
 * electrónica» ni inventa un consecutivo con pinta de oficial: decir
 * «factura» sin serlo le crea un problema al cliente el día que su
 * contador la pida. El día que se emita la de verdad, este comprobante
 * la acompaña; no la reemplaza.
 *
 * ── POR QUÉ ES UNO SOLO PARA TODO ───────────────────────────────────
 * Bookea cobra cosas distintas —el módulo de Lealtad, Linksy Pro, los
 * add-ons, las invitaciones— y todas terminan en la misma pregunta del
 * cliente: «¿qué me cobraron?». Un comprobante por producto serían
 * cuatro plantillas que se desincronizan; acá el producto es un dato
 * (`producto`) y los renglones son una lista. Enchufar un cobro nuevo es
 * llamar a `enviarComprobanteDePago` con sus renglones.
 *
 * ── LAS REGLAS DE LA CASA ───────────────────────────────────────────
 * Tablas + estilos inline (nada de <style> ni flexbox: Outlook), ancho
 * máximo 560 como el resto de los correos, y TODO texto que escribió una
 * persona pasa por `escaparHtml`. Los montos los formatea
 * `fmtMoneda` con la moneda del cobro (0236): un cliente en Lima no ve
 * colones.
 */

export type RenglonComprobante = {
  /** «Linksy Pro · mensual», «Módulo de Lealtad · plan Crecer». */
  concepto: string;
  /** Una línea chica bajo el concepto. Opcional. */
  detalle?: string;
  /** En la moneda del comprobante. Sin impuestos: ver `impuesto`. */
  monto: number;
};

export type Comprobante = {
  /** El número que identifica el cobro. Ver `numeroDeComprobante`. */
  numero: string;
  /** ISO del momento del cobro. */
  fechaISO: string;
  cliente: { nombre: string; correo: string };
  /** El producto que encabeza el comprobante. */
  producto: string;
  /** «1 de septiembre al 30 de septiembre de 2026». Opcional. */
  periodo?: string;
  /** «Tarjeta terminada en 4242», «SINPE Móvil», «Transferencia». */
  metodoPago: string;
  renglones: RenglonComprobante[];
  /** Impuesto ya calculado, si el cobro lo lleva. 0 = no se muestra. */
  impuesto?: { etiqueta: string; monto: number };
  moneda: Moneda;
  /** ISO del próximo cobro, si la suscripción sigue. */
  proximoCobroISO?: string;
  /** A dónde va el botón: el panel donde ve y maneja su suscripción. */
  urlPanel: string;
};

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";

/**
 * El número del comprobante: `BK-2026-09-1A2B3C`.
 *
 * Legible, ordenable por fecha y derivado del id de la transacción, así
 * que el mismo cobro siempre da el mismo número —reenviar el correo no
 * inventa un comprobante nuevo— y dos cobros nunca chocan. No es un
 * consecutivo fiscal y no pretende serlo.
 */
export function numeroDeComprobante(idTransaccion: string, fechaISO: string): string {
  const limpio = (idTransaccion || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const cola = (limpio.slice(-6) || "000000").padStart(6, "0");
  return `BK-${fechaISO.slice(0, 4)}-${fechaISO.slice(5, 7)}-${cola}`;
}

/** «9 de septiembre de 2026», en hora de Costa Rica. */
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return iso.slice(0, 10);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** La suma de los renglones, antes de impuestos. */
export function subtotalDe(c: Pick<Comprobante, "renglones">): number {
  return Math.round(c.renglones.reduce((t, r) => t + r.monto, 0) * 100) / 100;
}

/** Lo que de verdad se cobró. */
export function totalDe(c: Pick<Comprobante, "renglones" | "impuesto">): number {
  return Math.round((subtotalDe(c) + (c.impuesto?.monto ?? 0)) * 100) / 100;
}

// ── El HTML ─────────────────────────────────────────────────────────

const NAVY = "#16295e";
const NARANJA = "#ee7420";
const TINTA = "#10203a";
const SUAVE = "#63758f";
const LINEA = "#e6ebf3";
const PAPEL = "#ffffff";

/** Una fila de datos del encabezado («Fecha», «Método de pago»). */
function dato(rotulo: string, valor: string): string {
  return `<td style="padding:0 0 10px;vertical-align:top;">
    <div style="color:${SUAVE};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${escaparHtml(rotulo)}</div>
    <div style="color:${TINTA};font-size:14px;font-weight:700;margin-top:3px;">${escaparHtml(valor)}</div>
  </td>`;
}

/**
 * El comprobante, listo para mandar.
 *
 * No usa `layoutBento` a propósito: los bento del resto de los correos
 * son para AVISOS —una idea grande y un botón—, y un comprobante es un
 * documento: una tabla de conceptos que se lee de arriba abajo y que
 * alguien va a imprimir o a reenviarle a su contador. Comparte los
 * colores y el ancho, que es lo que lo hace parte de la familia.
 */
export function htmlComprobante(c: Comprobante): string {
  const $ = (n: number) => fmtMoneda(n, c.moneda);
  const subtotal = subtotalDe(c);
  const total = totalDe(c);

  const renglones = c.renglones
    .map(
      (r) => `<tr>
        <td style="padding:14px 0;border-bottom:1px solid ${LINEA};">
          <div style="color:${TINTA};font-size:14.5px;font-weight:700;">${escaparHtml(r.concepto)}</div>
          ${r.detalle ? `<div style="color:${SUAVE};font-size:12.5px;margin-top:3px;">${escaparHtml(r.detalle)}</div>` : ""}
        </td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid ${LINEA};color:${TINTA};font-size:14.5px;font-weight:700;white-space:nowrap;">
          ${escaparHtml($(r.monto))}
        </td>
      </tr>`,
    )
    .join("");

  const impuesto = c.impuesto
    ? `<tr>
        <td style="padding:8px 0 0;color:${SUAVE};font-size:13.5px;">${escaparHtml(c.impuesto.etiqueta)}</td>
        <td align="right" style="padding:8px 0 0;color:${SUAVE};font-size:13.5px;white-space:nowrap;">${escaparHtml($(c.impuesto.monto))}</td>
      </tr>`
    : "";

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprobante ${escaparHtml(c.numero)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Pagaste ${escaparHtml($(total))} por ${escaparHtml(c.producto)}. Comprobante ${escaparHtml(c.numero)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:32px 14px;">
    <tr>
      <td align="center">
        <!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Encabezado: la marca y de qué documento se trata -->
          <tr>
            <td style="background:${NAVY};border-radius:18px 18px 0 0;padding:28px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:${PAPEL};font-size:20px;font-weight:800;letter-spacing:-0.02em;">Bookea</td>
                  <td align="right" style="color:${NARANJA};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">Comprobante de pago</td>
                </tr>
              </table>
              <div style="color:#c7d2e6;font-size:13px;margin-top:18px;">Pagaste</div>
              <div style="color:${PAPEL};font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-0.03em;margin-top:2px;">${escaparHtml($(total))}</div>
              <div style="color:#c7d2e6;font-size:14px;margin-top:8px;">${escaparHtml(c.producto)}${c.periodo ? ` &middot; ${escaparHtml(c.periodo)}` : ""}</div>
            </td>
          </tr>

          <!-- Los datos del cobro -->
          <tr>
            <td style="background:${PAPEL};padding:24px 30px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>${dato("Comprobante", c.numero)}${dato("Fecha", fechaLarga(c.fechaISO))}</tr>
                <tr>${dato("A nombre de", c.cliente.nombre)}${dato("Método de pago", c.metodoPago)}</tr>
              </table>
            </td>
          </tr>

          <!-- Los conceptos -->
          <tr>
            <td style="background:${PAPEL};padding:12px 30px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td colspan="2" style="border-top:1px solid ${LINEA};padding-top:14px;color:${SUAVE};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Detalle</td>
                </tr>
                ${renglones}
                <tr>
                  <td style="padding:14px 0 0;color:${SUAVE};font-size:13.5px;">Subtotal</td>
                  <td align="right" style="padding:14px 0 0;color:${SUAVE};font-size:13.5px;white-space:nowrap;">${escaparHtml($(subtotal))}</td>
                </tr>
                ${impuesto}
                <tr>
                  <td style="padding:12px 0 0;color:${TINTA};font-size:17px;font-weight:800;">Total pagado</td>
                  <td align="right" style="padding:12px 0 0;color:${TINTA};font-size:17px;font-weight:800;white-space:nowrap;">${escaparHtml($(total))}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            c.proximoCobroISO
              ? `<!-- Cuándo vuelve a cobrarse: la pregunta que sigue -->
          <tr>
            <td style="background:${PAPEL};padding:22px 30px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf3ea;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;color:#8a4a12;font-size:13.5px;line-height:1.5;">
                    Tu suscripción sigue activa. El próximo cobro es el <b>${escaparHtml(fechaLarga(c.proximoCobroISO))}</b>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ""
          }

          <!-- El botón al panel -->
          <tr>
            <td style="background:${PAPEL};padding:22px 30px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="${NAVY}" style="background-color:${NAVY};border-radius:12px;padding:13px 22px;">
                    <a href="${escaparHtml(c.urlPanel)}" style="display:block;color:${PAPEL};font-size:14.5px;font-weight:800;line-height:1.2;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Ver mi suscripción</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- El pie: qué es este papel y a quién escribirle -->
          <tr>
            <td style="background:#eef2f8;border-radius:0 0 18px 18px;padding:20px 30px;">
              <div style="color:${SUAVE};font-size:12px;line-height:1.6;">
                Este es el comprobante del cobro, para tu respaldo. No es una factura electrónica autorizada por Hacienda.
              </div>
              <div style="color:${SUAVE};font-size:12px;line-height:1.6;margin-top:8px;">
                ¿Algo no cuadra? Respondé este correo o escribinos desde
                <a href="${SITIO_URL}/ayuda" style="color:${NAVY};font-weight:700;text-decoration:underline;">${SITIO_URL.replace(/^https?:\/\//, "")}/ayuda</a>.
              </div>
              <div style="color:${SUAVE};font-size:11.5px;margin-top:10px;">Bookea &middot; Costa Rica &middot; ${escaparHtml(c.cliente.correo)}</div>
            </td>
          </tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Manda el comprobante.
 *
 * Falla en silencio como el resto de los correos del sitio: el cobro ya
 * ocurrió y no se deshace porque el correo no salga. Lo que no puede
 * pasar es lo contrario —cobrar y que el cliente no tenga constancia—,
 * así que el fallo se registra con el número del comprobante para poder
 * reenviarlo a mano.
 */
export async function enviarComprobanteDePago(c: Comprobante): Promise<{ enviado: boolean }> {
  try {
    const r = await enviarCorreo({
      to: c.cliente.correo,
      subject: `Comprobante ${c.numero} · ${c.producto}`,
      html: htmlComprobante(c),
    });
    return { enviado: r.enviado !== false };
  } catch (e) {
    console.error(`[comprobante] No salió el comprobante ${c.numero} a ${c.cliente.correo}:`, e);
    return { enviado: false };
  }
}
