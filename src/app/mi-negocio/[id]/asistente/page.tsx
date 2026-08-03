import { redirect } from "next/navigation";

// El contenido vive en la página unificada de arriba (con pestañas),
// plegado dentro de Configuración — esto solo existe para no romper
// links guardados a la ruta vieja (incluido el botón "Ir a configurar
// tu asistente" que manda el aviso por correo cuando se activa el
// complemento).
export default async function AsistenteConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/mi-negocio/${id}?tab=configuracion&seccion=asistente`);
}
