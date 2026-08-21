import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAnonClient } from "@/lib/supabase/server";
import { cargarTarjetasFood } from "@/lib/food/tarjetas";
import { cargarFavoritosIds } from "@/lib/food/favoritos";
import FoodHeader from "@/components/food/food-header";
import FoodFooter from "@/components/food/food-footer";
import BottomNavFood from "@/components/food/bottom-nav-food";
import RestauranteCard from "@/components/food/restaurante-card";
import { IconHeart } from "@/components/icons";

export const metadata: Metadata = { title: "Mis favoritos · FOOD.BOOKEA", robots: { index: false } };

/**
 * MIS FAVORITOS — la pantalla real (0201), no la vitrina de
 * localStorage de /food/demo/favoritos.
 *
 * Reusa `cargarTarjetasFood()` (la MISMA fuente que /food y
 * /food/descubrir) y filtra a los ids que devuelve
 * `cargarFavoritosIds()`: ni un cálculo de precio/descuento propio, ni
 * una segunda forma de decidir qué mostrar.
 */
export default async function FavoritosFoodPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta?volver=food:favoritos");

  const [favoritosIds, tarjetas] = await Promise.all([
    cargarFavoritosIds(supabase, user.id),
    cargarTarjetasFood(createAnonClient(), { esDemo: false }),
  ]);

  const favoritas = tarjetas.filter((t) => favoritosIds.has(t.id));

  return (
    <>
      <FoodHeader />
      <main className="mx-auto min-h-[70svh] max-w-[1280px] px-4 pb-28 pt-8 sm:px-6 sm:pb-10">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-aventurea-orange">
          FOOD.BOOKEA
        </p>
        <h1 className="titulo mt-2 text-[26px] text-aventurea-ink sm:text-[32px]">Mis favoritos</h1>

        {favoritas.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-14 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-aventurea-cream-2 text-aventurea-orange">
              <IconHeart className="h-6 w-6" />
            </span>
            <p className="mt-4 text-[15px] font-extrabold text-aventurea-ink">
              Todavía no guardaste ningún restaurante
            </p>
            <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] text-aventurea-ink-soft">
              Tocá el corazón en cualquier restaurante de{" "}
              <Link href="/food/descubrir" className="font-bold text-aventurea-navy underline">
                Descubrir
              </Link>{" "}
              para guardarlo acá.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {favoritas.map((t, i) => (
              <RestauranteCard
                key={t.id}
                tarjeta={t}
                prioridad={i < 3}
                favoritoInicial
                logueado
              />
            ))}
          </div>
        )}
      </main>
      <div className="lg:hidden" style={{ height: "64px" }} aria-hidden />
      <FoodFooter />
      <BottomNavFood />
    </>
  );
}
