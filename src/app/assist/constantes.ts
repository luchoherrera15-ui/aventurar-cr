/**
 * EL NÚMERO DE WHATSAPP DE BOOKEA ASSIST.
 *
 * Un solo origen para todos los CTA de /assist (el hero y el cierre).
 * Se lee de NEXT_PUBLIC_ASSIST_WHATSAPP si algún día cambia la línea de
 * ventas, con el número real como respaldo — así el botón nunca queda
 * roto aunque falte la variable de entorno.
 */
const NUMERO_WHATSAPP_ASSIST = process.env.NEXT_PUBLIC_ASSIST_WHATSAPP ?? "50664101184";

export const WHATSAPP_ASSIST = `https://wa.me/${NUMERO_WHATSAPP_ASSIST}`;

/** El negocio ficticio que ilustra todos los mockups de la página (el
 *  chat, la agenda, el dashboard). Un solo nombre en toda la landing
 *  para que se lea como una historia y no como capturas sueltas. */
export const NEGOCIO_DEMO = "Salón Aurora";
