import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import FranjasPanel from "./franjas-panel";

export default async function FranjasFoodPage() {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const supabase = await createClient();
  const [{ data: sedes }, { data: franjas }] = await Promise.all([
    supabase.from("food_locations").select("id, nombre").eq("business_id", negocio.id).order("nombre"),
    supabase
      .from("food_franjas")
      .select("id, location_id, fecha, hora, capacidad, reservado, descuento_porcentaje, activa")
      .eq("business_id", negocio.id)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
      .limit(200),
  ]);

  return (
    <FranjasPanel
      negocioId={negocio.id}
      sedes={sedes ?? []}
      franjas={franjas ?? []}
    />
  );
}
