/**
 * El PNG de un código QR, listo para mostrar o imprimir.
 *
 * Módulo neutral (sin "use client") a propósito: el mismo helper lo
 * necesitan el panel admin en el navegador y la hoja impresa, que se
 * arma en el servidor. Un helper exportado desde un archivo "use client"
 * revienta al llamarlo desde el servidor — ya rompió dos pantallas del
 * admin (ver src/app/admin/(dashboard)/ia/pestanas.ts).
 *
 * Se apoya en el mismo servicio que ya usa el QR del álbum de fotos
 * (src/app/cuenta/evento/[id]): no agrega dependencias y devuelve un
 * PNG que cualquier navegador imprime sin ayuda.
 */
export function urlQr(url: string, lado = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${lado}x${lado}&data=${encodeURIComponent(url)}`;
}

/** La base absoluta para armar links compartibles (QR incluidos). */
export const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";

/** El link público de una invitación: bookea.lat/i/{slug}. */
export function urlInvitacion(slug: string): string {
  return `${SITIO_URL}/i/${slug}`;
}
