import { redirect } from "next/navigation";

// El contenido vive en la página unificada de arriba (con pestañas) —
// esto solo existe para no romper links guardados a la ruta vieja.
export default async function EditarRanchoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/mi-rancho/${id}?tab=editar`);
}
