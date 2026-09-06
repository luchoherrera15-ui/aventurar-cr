import { TAMANO_OG } from "@/lib/seo/imagen-previa-negocio";
import { imagenDeTarjeta } from "@/lib/seo/imagen-tarjeta";

/**
 * LA IMAGEN DE `/tarjeta/<negocio>/<llave>`: la misma que la del link
 * viejo, con la tarjeta que pide la llave.
 */
export const size = TAMANO_OG;
export const contentType = "image/png";
export const alt = "Tarjeta de lealtad";

export default async function ImagenTarjetaConLlave({
  params,
}: {
  params: Promise<{ slug: string; tarjeta: string }>;
}) {
  const { slug, tarjeta } = await params;
  return imagenDeTarjeta(slug, tarjeta);
}
