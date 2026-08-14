import type { MetadataRoute } from "next";
import { urlSitio } from "@/lib/sitio";

/**
 * ============================================================
 * QUÉ PUEDE RASTREAR UN BUSCADOR
 * ============================================================
 *
 * Antes de esto no había robots.txt: Vercel devolvía 404 y el robot
 * asumía "todo permitido", incluidas las pantallas privadas. Ninguna
 * de ellas filtra datos —todas están protegidas por sesión y por RLS,
 * y a un anónimo le contestan un login— pero gastarle a Googlebot su
 * presupuesto de rastreo en cien pantallas de panel es tiempo que no
 * le dedica a las fichas de los negocios, que es lo único que sirve
 * que aparezca en una búsqueda.
 *
 * `Disallow` NO ES SEGURIDAD y no se debe usar como tal: es una
 * pedida, y solo la respetan los robots que quieren. Lo que protege
 * estas rutas sigue siendo la sesión y la RLS.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Panel del dueño y de la plataforma: nada acá le sirve a nadie
        // que no tenga la sesión abierta.
        "/admin",
        "/mi-negocio",
        "/mi-rancho",
        "/cuenta",
        "/mensajes",
        "/lealtad/panel",
        // Endpoints y flujos que no son páginas.
        "/api/",
        "/auth",
        "/baja",
        // Maquetas y demos internas: contenido de mentira que no tiene
        // por qué competir con el real en los resultados.
        "/panel-demo",
        "/invitaciones2",
        "/lealtad/demo",
      ],
    },
    sitemap: urlSitio("/sitemap.xml"),
  };
}
