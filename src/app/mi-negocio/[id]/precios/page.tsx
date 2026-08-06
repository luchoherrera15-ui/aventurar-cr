import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El contenido vive en la página unificada de arriba (con sidebar) —
// esto solo existe para no romper links guardados a la ruta vieja.
// Antes mandaba siempre a "configuracion" porque ahí `seccion=precios`
// abría el formulario correcto según la vertical (PreciosForm si es
// lugar, DepositoForm si no — mutuamente excluyentes en la misma
// pestaña). Ahora que Precios y Depósito viven en ítems separados del
// sidebar ("precios" y "negocio"), hay que mirar la categoría para
// saber a cuál mandar.
export default async function MiRanchoPreciosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select("categoria, vertical")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  // Para CITAS todo lo de precios (descuentos) vive en Configuración.
  if (data.vertical === "citas") {
    redirect(`/mi-negocio/${id}?tab=config&seccion=descuentos`);
  }

  const esLugar = data.categoria === "lugares";
  redirect(
    esLugar
      ? `/mi-negocio/${id}?tab=precios&seccion=precios`
      : `/mi-negocio/${id}?tab=negocio&seccion=precios`,
  );
}
