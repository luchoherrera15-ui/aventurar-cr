import type { Metadata } from "next";
import { createAnonClient, createClient } from "@/lib/supabase/server";
import { cargarTarjetasFood } from "@/lib/food/tarjetas";
import { cargarFavoritosIds } from "@/lib/food/favoritos";
import FoodHeader from "@/components/food/food-header";
import FoodFooter from "@/components/food/food-footer";
import BottomNavFood from "@/components/food/bottom-nav-food";
import DescubrirFood from "@/components/food/descubrir-food";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Descubrir restaurantes · FOOD.BOOKEA",
  description: "Buscá, filtrá y encontrá tu próxima mesa con descuento por horario en Costa Rica.",
};

/**
 * DESCUBRIR — la pantalla de exploración dedicada (bottom nav, 2ª
 * pestaña). /food (Home) sigue siendo la vitrina con hero y rieles
 * curados; esta es la pantalla para cuando ya se sabe que se quiere
 * buscar y comparar con filtros — mismo dato real de siempre
 * (`cargarTarjetasFood`), sin un segundo cálculo de precio/descuento.
 */
export default async function DescubrirFoodPage() {
  const anon = createAnonClient();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tarjetas, favoritosIds] = await Promise.all([
    cargarTarjetasFood(anon, { esDemo: false }),
    cargarFavoritosIds(supabase, user?.id ?? null),
  ]);

  return (
    <>
      <FoodHeader />
      <main className="min-h-[70svh] pb-20 sm:pb-6">
        <h1 className="sr-only">Descubrir restaurantes en FOOD.BOOKEA</h1>
        <DescubrirFood negocios={tarjetas} favoritosIds={favoritosIds} logueado={!!user} />
      </main>
      <FoodFooter />
      <BottomNavFood />
    </>
  );
}
