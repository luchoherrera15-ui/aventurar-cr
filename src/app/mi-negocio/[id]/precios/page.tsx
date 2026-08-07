import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El contenido vive en la página unificada de arriba (con sidebar) —
// esto solo existe para no romper links guardados a la ruta vieja.
// Desde que "Mi negocio", "Precios" y "Asistente IA" se fusionaron en
// UNA pestaña Configuración, todo esto aterriza en el mismo lugar: lo
// único que cambia es qué sección llega abierta. `seccion=precios` abre
// el formulario que corresponda (PreciosForm si es lugar, DepositoForm
// si no — mutuamente excluyentes), y en Citas lo de precios son los
// descuentos.
export default async function MiRanchoPreciosPage({
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
      ? `/mi-negocio/${id}?tab=config&seccion=descuentos`
      : `/mi-negocio/${id}?tab=config&seccion=precios`,
  );
}
