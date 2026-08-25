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
 * El número con código de país y SIN signos ni espacios: el `506` de
 * Costa Rica va pegado adelante porque `wa.me` no acepta un número
 * local — sin el código de país el enlace abre un chat con nadie.
 *
 * TEMPORAL (dueño, 25 ago 2026): +506 8710 3739 es un número de paso
 * mientras se define el definitivo de atención. Cambiarlo ACÁ lo
 * cambia en todas las pantallas que ofrezcan el canal — hoy solo el
 * cuadro de ayuda de /lealtad/crear, y ese es justo el punto de que
 * viva en un archivo y no escrito a mano en cada botón.
 */
export const WHATSAPP_BOOKEA = "50687103739";

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
