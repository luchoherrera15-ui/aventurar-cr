import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El contenido vive en la página unificada de arriba (con sidebar) —
// esto solo existe para no romper links guardados a la ruta vieja.
// Para CITAS el perfil vive dentro de la pestaña Configuración.
export default async function EditarRanchoPage({
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
      ? `/mi-negocio/${id}?tab=config&seccion=perfil`
      : `/mi-negocio/${id}?tab=negocio&seccion=perfil`,
  );
}
