import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El contenido vive en la página unificada de arriba (con sidebar) —
// esto solo existe para no romper links guardados a la ruta vieja. El
// perfil es una sección plegable de la pestaña Configuración, igual en
// las dos verticales.
export default async function EditarRanchoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("ranchos").select("id").eq("id", id).maybeSingle();
  if (!data) notFound();

  redirect(`/mi-negocio/${id}?tab=config&seccion=perfil`);
}
