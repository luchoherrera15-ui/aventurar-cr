import { escaparHtml } from "@/lib/email";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PASE DE LEALTAD, DIBUJADO DENTRO DE UN CORREO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): mandar campañas con «un MOCKUP DE LOS
 * PASES DIGITALES», algo profesional que enganche. Este módulo dibuja
 * ese pase.
 *
 * ── POR QUÉ TABLAS Y NO UNA IMAGEN ──────────────────────────────────
 *
 * La tentación era generar un PNG con `ImageResponse` (el repo ya lo usa
 * en `api/pases-google/logo`) y meterlo con un `<img>`: fidelidad total,
 * cero trabajo de maquetación.
 *
 * No se hizo, y el motivo es concreto: **Outlook y Gmail bloquean las
 * imágenes remotas por defecto.** El pase es EL argumento de venta de
 * este correo — si se bloquea, quien lo abre ve un recuadro vacío con
 * una crucecita justo donde estaba lo único que teníamos para
 * convencerlo. Un mockup en tablas se ve SIEMPRE, sin pedir permiso.
 *
 * ── LOS SELLOS SON CARACTERES, NO DIVS REDONDEADOS ──────────────────
 *
 * ⚠️ La forma «obvia» —`<td>` con `border-radius:50%`— se ve redonda en
 * Gmail y CUADRADA en Outlook, que ignora `border-radius`. Una fila de
 * cuadraditos no se lee como sellos.
 *
 * Por eso cada sello es el carácter `●` (U+25CF) coloreado con
 * `font-size`: es un GLIFO, no CSS, así que sale igual en todos los
 * clientes. Se pierde un poco de control fino del tamaño y se gana que
 * el dibujo exista en el 100 % de los buzones.
 *
 * ── LOS COLORES VAN LITERALES ───────────────────────────────────────
 *
 * Nada de `var(--…)`: ningún cliente de correo soporta variables CSS.
 * Es la misma regla que ya está escrita en `sello-acreditado.ts`.
 *
 * ── LO QUE MUESTRA ES UN EJEMPLO, Y SE DICE ─────────────────────────
 *
 * «Café Aurora», los 6 de 8 sellos y el premio son de muestra — el
 * mismo negocio de ejemplo que usa toda la landing de Lealtad. El pie
 * del mockup lo aclara: este repo tiene una regla dura contra mostrar
 * cifras inventadas como si fueran reales.
 */

export type DatosMockupPase = {
  /** El nombre del negocio de ejemplo. */
  negocio: string;
  /** El color de marca del pase (hex de 6 dígitos con #). */
  color: string;
  /** Cuántos sellos lleva el cliente de ejemplo. */
  saldo: number;
  /** Cuántos hacen falta para el premio. */
  meta: number;
  /** Qué se gana al completar. */
  premio: string;
};

export const PASE_DE_MUESTRA: DatosMockupPase = {
  negocio: "Café Aurora",
  color: "#16295e",
  saldo: 6,
  meta: 8,
  premio: "Un café gratis",
};

/** El naranja de la marca, para los sellos ya ganados. */
const ACENTO = "#f39200";

/**
 * Un hex de 6 dígitos, o el navy de la marca.
 *
 * No es paranoia: este color puede venir de un negocio real (la tarjeta
 * que el dueño configuró), y va DIRECTO a un atributo `style` del HTML
 * del correo. Un valor con comillas o un `;` se sale del atributo y
 * puede reescribir el resto del estilo — o peor, cerrar la etiqueta.
 */
function colorSeguro(valor: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : "#16295e";
}

/**
 * La fila de sellos.
 *
 * Se corta en 12 aunque la meta sea mayor: más que eso no entra en el
 * ancho de un correo sin partirse en dos renglones, y una tarjeta de
 * 30 sellos en miniatura no comunica nada. Cuando se corta, se dice
 * con un «+N» en vez de mentir sobre el total.
 */
function filaDeSellos(saldo: number, meta: number): string {
  const TOPE = 12;
  const dibujados = Math.min(meta, TOPE);
  const puntos: string[] = [];

  for (let i = 0; i < dibujados; i += 1) {
    const ganado = i < saldo;
    puntos.push(
      `<span style="color:${ganado ? ACENTO : "#ffffff"};opacity:${ganado ? "1" : "0.28"};font-size:19px;line-height:19px;">&#9679;</span>`,
    );
  }

  const resto = meta - dibujados;
  const masN =
    resto > 0
      ? `<span style="color:#ffffff;opacity:0.55;font-size:12px;font-weight:700;">&nbsp;+${resto}</span>`
      : "";

  // El espacio entre sellos es un `&nbsp;` y no `letter-spacing` ni
  // `gap`: Outlook no aplica ninguno de los dos a spans en línea.
  return puntos.join("&nbsp;") + masN;
}

/**
 * El pase completo, listo para meter en el cuerpo de un correo.
 *
 * Devuelve una `<table>` centrada de 300px — el mismo ancho que la
 * vista real del pase (`vista-pase.tsx`) — que cabe sin recortarse en
 * los 560px que da `layoutBento`.
 */
export function mockupPaseHtml(datos: DatosMockupPase = PASE_DE_MUESTRA): string {
  const color = colorSeguro(datos.color);
  const negocio = escaparHtml(datos.negocio);
  const premio = escaparHtml(datos.premio);
  const saldo = Math.max(0, Math.min(datos.saldo, datos.meta));

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:4px 0;">
      <table role="presentation" width="300" cellpadding="0" cellspacing="0" border="0" style="width:300px;background:${color};border-radius:20px;overflow:hidden;">

        <!-- Cabecera: el negocio a la izquierda, el progreso a la derecha -->
        <tr>
          <td style="padding:18px 18px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color:#ffffff;font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
                  ${negocio}
                </td>
                <td align="right" style="font-family:Arial,Helvetica,sans-serif;">
                  <div style="color:#ffffff;opacity:0.55;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                    Sellos
                  </div>
                  <div style="color:#ffffff;font-size:15px;font-weight:800;">
                    ${saldo} / ${datos.meta}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- La tira: los sellos. Es la parte que se mira primero. -->
        <tr>
          <td align="center" style="padding:6px 16px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.10);border-radius:12px;">
              <tr>
                <td align="center" style="padding:14px 10px;">
                  ${filaDeSellos(saldo, datos.meta)}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Qué se gana -->
        <tr>
          <td style="padding:0 18px 16px;font-family:Arial,Helvetica,sans-serif;">
            <div style="color:#ffffff;opacity:0.55;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
              Al completar
            </div>
            <div style="color:#ffffff;font-size:13.5px;font-weight:700;margin-top:2px;">
              ${premio}
            </div>
          </td>
        </tr>

        <!-- El pie blanco. En el pase real acá va el QR; en un correo un
             QR de mentira sería un cuadrito ilegible, así que se dice
             en palabras qué hace esa zona. -->
        <tr>
          <td align="center" style="background:#ffffff;padding:12px 18px 13px;font-family:Arial,Helvetica,sans-serif;">
            <div style="color:#0a1226;font-size:10.5px;font-weight:700;">
              El cliente muestra su código y vos lo escaneás
            </div>
            <div style="color:#8a91a4;font-size:9px;margin-top:3px;">
              Vive en Apple Wallet y Google Wallet &middot; Powered by Bookea.lat
            </div>
          </td>
        </tr>

      </table>

      <div style="color:#a3aab5;font-size:10.5px;font-family:Arial,Helvetica,sans-serif;margin-top:9px;">
        Ejemplo ilustrativo &mdash; tu tarjeta lleva tu logo, tus colores y tu premio.
      </div>
    </td>
  </tr>
</table>`.trim();
}
