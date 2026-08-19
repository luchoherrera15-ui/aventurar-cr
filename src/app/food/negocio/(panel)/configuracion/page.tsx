import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import ConfiguracionPanel from "./configuracion-panel";

export default async function ConfiguracionFoodPage() {
  const negocioBase = await miNegocioFood();
  if (!negocioBase) redirect("/food/negocio/nuevo");

  const supabase = await createClient();
  const [{ data: negocio }, { data: sedes }] = await Promise.all([
    supabase
      .from("food_businesses")
      .select("id, nombre, descripcion, telefono, foto_portada_url, activo, slug")
      .eq("id", negocioBase.id)
      .single(),
    supabase.from("food_locations").select("id, nombre, direccion, telefono").eq("business_id", negocioBase.id).order("nombre"),
  ]);

  if (!negocio) redirect("/food/negocio/nuevo");

  return <ConfiguracionPanel negocio={negocio} sedes={sedes ?? []} />;
}
