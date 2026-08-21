import VistaDeTarjeta from "../vista-tarjeta";

/**
 * EL LINK DE UNA TARJETA EN CONCRETO: `/tarjeta/<negocio>/<llave>`.
 *
 * Pedido del dueño, textual: «¿Podés hacer que cada tarjeta tenga un QR
 * y un link distinto? La idea es poder hacer pósters para cada una
 * independiente y que cada una tenga su función».
 *
 * La llave la resuelve `llave-tarjeta.ts` y acepta tres cosas: el slug
 * guardado (0199), el slug derivado del nombre —el mismo texto, para
 * que un póster impreso antes de la migración siga sirviendo después— y
 * el id del programa como salida de emergencia.
 *
 * La pantalla es LA MISMA que la del link viejo, a propósito: si
 * estuviera escrita dos veces, la del póster impreso sería la que
 * quedaría vieja.
 */
export default async function TarjetaDeUnProgramaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; tarjeta: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, tarjeta } = await params;
  const busqueda = await searchParams;
  return <VistaDeTarjeta slug={slug} llave={tarjeta} busqueda={busqueda} />;
}
