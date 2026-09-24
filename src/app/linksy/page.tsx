import { permanentRedirect } from "next/navigation";

/**
 * /linksy — LA MARCA QUE SE RETIRÓ.
 *
 * Acá vivía el sitio de Linksy: su logo, su menú y su propio login.
 * Por decisión del dueño (24 sep 2026, ejecutando la #2 de
 * `docs/arquitectura.md`) la marca desapareció y su contenido se mudó
 * a `/solutions`, que es la página de producto de «Tu página».
 *
 * La ruta NO se borra: bajo `linksy.lat` el proxy reescribe la raíz a
 * `/linksy` (ver `destinoEnLinksy` en `lib/solutions/dominios.ts`), y
 * además quedan links viejos en correos, QR y marcadores. Los tres
 * tienen que seguir llegando a algún lado.
 */
export default function LinksyPage() {
  permanentRedirect("/solutions");
}
