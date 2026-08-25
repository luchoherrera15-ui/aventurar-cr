/**
 * LOS DATOS DE CONTACTO PÚBLICOS DE BOOKEA — un solo lugar.
 *
 * Hasta ago 2026 el sitio no tenía ningún número de WhatsApp escrito
 * en el código: los textos que lo mencionaban ("escribinos directo por
 * WhatsApp", en `contacto-actions.ts`) mandaban a un canal que no
 * existía en ninguna parte. Este módulo es ese lugar, para que el día
 * que el número cambie se cambie una vez y no en seis pantallas.
 *
 * ── POR QUÉ UN VACÍO ESCONDE EL BOTÓN EN VEZ DE ROMPERLO ───────────
 * Un `wa.me/` sin número abre una página de error de WhatsApp: el
 * visitante hace clic en «Escribinos por WhatsApp», sale del sitio y
 * aterriza en un error. Peor que no ofrecer el canal. Por eso
 * `enlaceWhatsapp()` devuelve `null` mientras la constante esté vacía
 * y quien la usa NO dibuja el botón — el cuadro de ayuda queda con la
 * opción de chat, que sí funciona, y nadie ve una puerta rota.
 */

/**
 * El número con código de país y SIN signos: "50688887777".
 *
 * PENDIENTE (dueño, ago 2026): falta el número real. Apenas se
 * complete acá, el botón de WhatsApp aparece solo en el cuadro de
 * ayuda de /lealtad/crear — no hay que tocar nada más.
 */
export const WHATSAPP_BOOKEA = "";

/**
 * El enlace de WhatsApp con un mensaje ya escrito, o `null` si
 * todavía no hay número cargado.
 *
 * `wa.me` y no `api.whatsapp.com`: es el enlace corto oficial y es el
 * único que abre la app instalada en móvil en vez de forzar el paso
 * por el navegador.
 */
export function enlaceWhatsapp(mensaje?: string): string | null {
  const numero = WHATSAPP_BOOKEA.replace(/\D/g, "");
  if (numero.length < 8) return null;
  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
