import { imagenPreviaNegocio, TAMANO_OG } from "@/lib/seo/imagen-previa-negocio";
import { datosDePaginaPublica } from "./datos";

/**
 * LA IMAGEN DE `/r/<negocio>` AL COMPARTIR: la marca del negocio (los
 * colores y el logo de su tarjeta), su nombre y su bajada, con lo que
 * la página ofrece. Antes salía la imagen genérica del sitio.
 */
export const size = TAMANO_OG;
export const contentType = "image/png";
export const alt = "La página del negocio";

export default async function ImagenPaginaNegocio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const datos = await datosDePaginaPublica(slug);
  if (!datos) {
    return imagenPreviaNegocio({
      eyebrow: "Bookea",
      nombre: "Página no encontrada",
      frase: null,
      link: "bookea.lat",
      colorFondo: "#062653",
      colorAcento: "#9db4ff",
      logoUrl: null,
    });
  }
  const partes = [
    datos.seccionesMenu.length > 0 ? "Menú" : null,
    datos.tarjetaActiva ? "Tarjeta de lealtad" : null,
    "Contacto",
  ].filter(Boolean);
  return imagenPreviaNegocio({
    eyebrow: partes.join(" · "),
    nombre: datos.negocio.nombre,
    frase:
      datos.pagina.bajada ||
      (datos.meta ? `Juntá ${datos.meta.costo} y llevate ${datos.meta.nombre}` : null),
    link: `bookea.lat/r/${datos.negocio.slug}`,
    colorFondo: datos.marca.colorFondo,
    colorAcento: datos.marca.colorSello,
    logoUrl: datos.marca.logoUrl,
    sellos: datos.tarjetaActiva && datos.meta && !datos.pagina.bajada ? datos.meta.costo : 0,
  });
}
