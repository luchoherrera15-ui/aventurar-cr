import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El contenido vive en la página unificada de arriba (con sidebar), en
// la sección "Asistente IA" de la pestaña Configuración — esto solo
// existe para no romper links guardados a la ruta vieja (incluido el
// botón "Ir a configurar tu asistente" que manda el aviso por correo
// cuando se activa el complemento).
export default async function AsistenteConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("ranchos").select("id").eq("id", id).maybeSingle();
  if (!data) notFound();

  redirect(`/mi-negocio/${id}?tab=config&seccion=asistente`);
}
