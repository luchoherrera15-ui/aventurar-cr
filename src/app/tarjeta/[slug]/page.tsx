import VistaDeTarjeta from "./vista-tarjeta";

/**
 * EL LINK VIEJO: `/tarjeta/<negocio>`.
 *
 * Es el que está IMPRESO en los pósters que ya están pegados en la
 * pared de los locales, y por eso esta ruta no se puede tocar más allá
 * de lo indispensable. Toda la pantalla vive en `vista-tarjeta.tsx`,
 * compartida con la ruta por tarjeta.
 *
 * `llave={null}` es lo único que dice este archivo, y significa: «la
 * tarjeta ORIGINAL del negocio, la más vieja». No «la que emita», no
 * «la principal». El porqué largo está en `laDelLinkDelNegocio`
 * (`src/lib/wallet/programa-principal.ts`): un QR de papel no se puede
 * volver a desplegar, así que su destino tiene que depender solo de
 * datos que ya no cambian.
 */
export default async function TarjetaPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const busqueda = await searchParams;
  return <VistaDeTarjeta slug={slug} llave={null} busqueda={busqueda} />;
}
