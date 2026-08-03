import { redirect } from "next/navigation";

// El contenido vive en la página unificada de arriba (con pestañas) —
// esto solo existe para no romper links guardados a la ruta vieja. La
// tabla de reservas ahora vive plegada dentro de la pestaña Agenda, no
// en su propia pestaña.
export default async function MiRanchoReservasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/mi-negocio/${id}?tab=agenda`);
}
