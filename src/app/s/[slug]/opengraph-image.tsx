import { imagenPreviaNegocio, TAMANO_OG } from "@/lib/seo/imagen-previa-negocio";
import { paginaPublica } from "@/lib/solutions/datos";
import { conVariante } from "@/lib/solutions/fotos";
import { vocabDe } from "@/lib/solutions/rubros";
import { urlDelNegocio } from "@/lib/solutions/tipos";

/**
 * LA IMAGEN DE `/s/<negocio>` AL COMPARTIR: la portada del negocio con
 * un velo, o los colores de su tema si no subió foto; su logo, su
 * nombre y su bajada. Es la misma paleta que pinta la página
 * (`paletaDelTema`), así que la previa y la página se ven de la misma
 * familia.
 */
export const size = TAMANO_OG;
export const contentType = "image/png";
export const alt = "La página del negocio";

export default async function ImagenSolutions({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const datos = await paginaPublica(slug);
  if (!datos) {
    return imagenPreviaNegocio({
      eyebrow: "Bookea Solutions",
      nombre: "Página no encontrada",
      frase: null,
      link: "bookea.lat/solutions",
      colorFondo: "#0a1226",
      colorAcento: "#9db4ff",
      logoUrl: null,
    });
  }
  const { negocio, paleta, addons, menu } = datos;
  const v = vocabDe(negocio.rubro);
  const partes = [addons.menu && menu.length > 0 ? v.catalogo : null, "Enlaces", negocio.whatsapp ? "WhatsApp" : null].filter(Boolean);
  // `paleta.fondo` puede ser rgba en algún tema: el dibujo cae al navy si no es hex.
  return imagenPreviaNegocio({
    eyebrow: partes.join(" · "),
    nombre: negocio.nombre,
    frase: negocio.bajada || null,
    link: urlDelNegocio(negocio).replace(/^https?:\/\/(www\.)?/, ""),
    colorFondo: paleta.fondo,
    colorAcento: paleta.acento,
    logoUrl: conVariante(negocio.logo_url, "thumb") ?? negocio.logo_url,
    fotoUrl: conVariante(negocio.foto_portada_url, "hero") ?? negocio.foto_portada_url,
  });
}
