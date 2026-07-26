import { redirect } from "next/navigation";

/**
 * El calendario de reservas ahora vive en el portal del negocio
 * (`/ranchos-eventos/[id]`), que abre justamente con él. Esta ruta se
 * mantiene para no romper enlaces viejos ya compartidos.
 */
export default async function ReservarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/ranchos-eventos/${id}`);
}
