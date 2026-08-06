import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El contenido vive en la página unificada de arriba (con sidebar), en
// su propio ítem "Asistente IA" — esto solo existe para no romper
// links guardados a la ruta vieja (incluido el botón "Ir a configurar
// tu asistente" que manda el aviso por correo cuando se activa el
// complemento). Para CITAS el asistente vive dentro de Configuración.
export default async function AsistenteConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("ranchos").select("vertical").eq("id", id).maybeSingle();
  if (!data) notFound();

  redirect(
    data.vertical === "citas"
      ? `/mi-negocio/${id}?tab=config&seccion=asistente`
      : `/mi-negocio/${id}?tab=asistente`,
  );
}
