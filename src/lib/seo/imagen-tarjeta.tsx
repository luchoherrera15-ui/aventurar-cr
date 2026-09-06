import { imagenPreviaNegocio } from "./imagen-previa-negocio";
import { fraseDePrevia, previaDeTarjeta } from "@/lib/lealtad/previa-tarjeta";

/**
 * LA IMAGEN DE `/tarjeta/<negocio>` Y `/tarjeta/<negocio>/<llave>` AL
 * COMPARTIR: la tarjeta del negocio con su fondo, su logo, su nombre y
 * la fila de sellos que promete.
 *
 * Vive en la librería y no en `opengraph-image.tsx` porque ese archivo
 * es una convención de Next y solo debe exportar lo que Next espera
 * (`size`, `contentType`, `alt`, el default). Las dos rutas —la del
 * link viejo y la de la llave— llaman a esto con lo suyo.
 */
export async function imagenDeTarjeta(slug: string, llave: string | null) {
  const p = await previaDeTarjeta(slug, llave);
  if (!p) {
    return imagenPreviaNegocio({
      eyebrow: "Tarjeta de lealtad",
      nombre: "Bookea Lealtad",
      frase: "Sellos, puntos y regalías en el teléfono de tus clientes.",
      link: "bookea.lat/lealtad",
      colorFondo: "#062653",
      colorAcento: "#9db4ff",
      logoUrl: null,
    });
  }
  const t = p.tarjeta;
  const nombreTarjeta = t?.nombre ?? "";
  return imagenPreviaNegocio({
    // El nombre de la tarjeta, salvo que sea el genérico del alta.
    eyebrow: nombreTarjeta && nombreTarjeta.toLowerCase() !== "programa de lealtad" ? nombreTarjeta : "Tarjeta de lealtad",
    nombre: p.negocio.nombre,
    frase:
      p.premio && t && (t.tipo === "sellos" || t.tipo === "puntos")
        ? `Juntá ${p.premio.meta} ${t.unidad} y llevate ${p.premio.nombre}`
        : fraseDePrevia(p),
    link: `bookea.lat/tarjeta/${p.negocio.slug}${llave ? `/${llave}` : ""}`,
    colorFondo: t?.colorFondo ?? "#062653",
    colorAcento: t?.colorSello ?? "#9db4ff",
    logoUrl: t?.logoUrl ?? null,
    sellos: p.premio && t?.tipo === "sellos" ? p.premio.meta : 0,
  });
}
