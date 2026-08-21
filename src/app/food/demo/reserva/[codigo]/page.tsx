import ConfirmacionDemo from "@/components/food/demo/confirmacion-demo";

/**
 * La pantalla de confirmación de una reserva DEMO. El dato vive en el
 * localStorage del navegador (ver src/lib/food/demo/estado.ts), así
 * que la lectura es del lado del cliente — este server component solo
 * pasa el código de la URL.
 */
export default async function ReservaDemoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  return <ConfirmacionDemo codigo={codigo} />;
}
