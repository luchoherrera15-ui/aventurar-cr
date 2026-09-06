import { TAMANO_OG } from "@/lib/seo/imagen-previa-negocio";
import { imagenDeTarjeta } from "@/lib/seo/imagen-tarjeta";

/**
 * LA IMAGEN DE `/tarjeta/<negocio>` AL COMPARTIR (dueño, 6 sep 2026):
 * la tarjeta del negocio, no la genérica de Bookea. Next la enchufa por
 * convención de nombre; el dibujo vive en `src/lib/seo/imagen-tarjeta.tsx`
 * y el texto en `metadata-tarjeta.ts`.
 */
export const size = TAMANO_OG;
export const contentType = "image/png";
export const alt = "Tarjeta de lealtad";

export default async function ImagenTarjeta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return imagenDeTarjeta(slug, null);
}
