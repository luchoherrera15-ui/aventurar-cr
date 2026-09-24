import type { Metadata } from "next";
import LandingPagina from "./landing-pagina";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /solutions — LA PÁGINA DE PRODUCTO DE «TU PÁGINA»
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «eliminá todo lo que tenga que ver
 * con Linksy — nada de Lealtad, nada de Rancho Las Torres, solo
 * Linksy». Con el alcance que eligió: **se va la marca, se queda la
 * funcionalidad**. Es la decisión congelada #2 de `docs/arquitectura.md`,
 * tomada el 22 de septiembre: «Linksy desaparece como producto y como
 * marca; de cara al cliente es *tu página de Bookea*».
 *
 * ── QUÉ PASÓ ACÁ, EN CONCRETO ───────────────────────────────────────
 *
 * Esta ruta era un `permanentRedirect` a `/linksy`, que era un SITIO
 * DE MARCA completo: logo propio, su menú (Productos, Plantillas,
 * Planes de lealtad, Ayuda) y su propio login. Ese sitio dejó de
 * existir. Su contenido —que es bueno y costó armarlo— se mudó acá y
 * ahora es lo que se ve al tocar «Ver más» en la tarjeta «Tu página»
 * del home.
 *
 * Y de paso tapa un hueco que estaba anotado desde ayer: de los cuatro
 * «Ver más» del home, este era uno de los dos que caían en una
 * pantalla que no explicaba nada.
 *
 * ── LO QUE **NO** CAMBIÓ, Y ES DELIBERADO ───────────────────────────
 *
 * El dominio `linksy.lat` sigue sirviendo las páginas públicas y los
 * QR siguen resolviendo donde resolvían. **La Casa de las Tortas es un
 * cliente real** y su página no se toca. Mover el dominio es un paso
 * aparte, con su propio permiso: ver la nota en `dominios.ts`.
 *
 * Los nombres TÉCNICOS con «linksy» adentro (`LINKSY_HOST`,
 * `MarcoLinksy`, la clase CSS `.linksy`) se quedan. La decisión #2 lo
 * dice con todas las letras: el nombre sobrevive como identificador
 * interno donde el repo ya lo usa; lo que desaparece es la
 * comunicación comercial. `LINKSY_HOST` además es una regla de
 * seguridad —impide que un negocio reclame la raíz del producto como
 * dominio propio—, así que tocarla sería peor que inútil.
 */

export const metadata: Metadata = {
  title: "Tu página",
  description:
    "Tu página con tus enlaces, tus redes, tu menú y tus productos. Gratis, con tu propio dominio y un QR para todo. Se arma en cinco minutos.",
  alternates: { canonical: "/solutions" },
};

/**
 * La sesión se lee acá (servidor) y baja al nav: con cuenta abierta la
 * esquina derecha dice el nombre y «Mi panel», no «Ingresar» — el dueño
 * entró logueado y la landing lo trataba como a un desconocido (8 sep
 * 2026).
 *
 * El envoltorio `.linksy` es el ámbito de color de esta página (papel y
 * tinta: hueso, arena, carbón). Va acá y no en `layout.tsx` a propósito:
 * el layout también envuelve al PANEL, que tiene su propia paleta y se
 * repintaría entero.
 */
export default async function PaginaProducto() {
  const sesion = await sesionDelNavLealtad();
  return (
    <div className="linksy">
      <LandingPagina sesion={sesion} />
    </div>
  );
}
