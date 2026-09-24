import { permanentRedirect } from "next/navigation";

/**
 * /linksy/<lo que sea> — los links viejos de la marca retirada.
 *
 * `/linksy/login` era la puerta de Linksy y hoy es `/solutions/login`.
 * El resto (correos, marcadores, un QR impreso) va a la página de
 * producto. Ninguna dirección vieja termina en un 404: la marca se
 * retiró, los links de la gente no tienen por qué romperse.
 *
 * Esta ruta existe además porque `destinoEnLinksy` deja pasar el
 * prefijo `linksy` hacia bookea.lat tal cual (PREFIJOS_BOOKEA), así
 * que quien escriba `linksy.lat/linksy/login` también cae acá.
 */
export default async function LinksyViejo({
  params,
}: {
  params: Promise<{ resto: string[] }>;
}) {
  const { resto } = await params;
  permanentRedirect(resto[0] === "login" ? "/solutions/login" : "/solutions");
}
