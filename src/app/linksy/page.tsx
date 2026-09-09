import type { Metadata } from "next";
import LandingLinksy from "./landing-linksy";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";

/**
 * /linksy — la landing del producto.
 *
 * Bajo linksy.lat se llega acá por la RAÍZ: el proxy reescribe `/` a
 * `/linksy` (ver `destinoEnLinksy` en src/lib/solutions/dominios.ts).
 * Bajo bookea.lat la ruta existe tal cual, que es lo que permite
 * probarla antes de que el dominio esté en la calle.
 *
 * El canónico apunta a /linksy y no a linksy.lat a propósito: mientras
 * el dominio no responda, un canónico hacia él le estaría diciendo a
 * Google que la versión buena es una que no existe. Se cambia junto
 * con `NEXT_PUBLIC_LINKSY_URL`, en el mismo paso del estreno.
 */
export const metadata: Metadata = {
  // `absolute`: sin el «| Bookea» de la plantilla del layout raíz. En
  // linksy.lat el producto se presenta solo; Bookea respalda desde el
  // pie y el login, no desde la pestaña.
  title: { absolute: "Linksy · Todo tu negocio en un solo link" },
  description:
    "Tu página con tus enlaces, tus redes, tu menú y tus productos. Gratis, con tu propio dominio y un QR para todo. Se arma en cinco minutos.",
  alternates: { canonical: "/linksy" },
};

/**
 * La sesión se lee acá (servidor) y baja al nav: con cuenta abierta la
 * esquina derecha dice el nombre y «Mi panel», no «Ingresar» — el dueño
 * entró logueado y la landing lo trataba como a un desconocido (8 sep
 * 2026). En linksy.lat la cookie no existe (vive en bookea.lat), así
 * que ahí siempre se ve «Ingresar»: es lo correcto, la puerta está allá.
 */
export default async function LinksyPage() {
  const sesion = await sesionDelNavLealtad();
  return <LandingLinksy sesion={sesion} />;
}
