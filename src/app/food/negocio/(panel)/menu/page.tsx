import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import MenuPanel from "./menu-panel";

export default async function MenuFoodPage() {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const supabase = await createClient();
  const [{ data: categorias }, { data: items }] = await Promise.all([
    supabase
      .from("food_menu_categories")
      .select("id, nombre, orden")
      .eq("business_id", negocio.id)
      .order("orden"),
    supabase
      .from("food_menu_items")
      .select("id, category_id, nombre, descripcion, precio, foto_url, activo, orden")
      .eq("business_id", negocio.id)
      .order("orden"),
  ]);

  return <MenuPanel negocioId={negocio.id} categorias={categorias ?? []} items={items ?? []} />;
}
