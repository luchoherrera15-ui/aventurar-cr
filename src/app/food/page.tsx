import type { Metadata } from "next";
import { createAnonClient } from "@/lib/supabase/server";
import { cargarTarjetasFood } from "@/lib/food/tarjetas";
import FoodHeader from "@/components/food/food-header";
import FoodFooter from "@/components/food/food-footer";
import DirectorioFood from "@/components/food/directorio-food";
import RevealOnScroll from "@/components/reveal-on-scroll";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "FOOD.BOOKEA — Restaurantes con descuento por horario",
  description:
    "Reservá una franja horaria en tu restaurante favorito y comé con descuento en Costa Rica.",
};

/**
 * EL DIRECTORIO PÚBLICO DE FOOD.BOOKEA — rediseño visual completo
 * (agosto 2026). La lógica de datos NO cambió: sigue siendo el cliente
 * anónimo (createAnonClient, no el de cookies — ver src/lib/supabase/
 * server.ts) y sigue filtrando `es_demo = false` explícito (0193: la
 * RLS por sí sola no separa real de demo, dos políticas SELECT
 * permisivas se combinan con OR).
 *
 * Lo que cambió es la forma: en vez de un grid de tarjetas chicas con
 * nombre y descripción, cada tarjeta ahora es una oferta completa
 * (foto grande, descuento, ubicación, horario y precio) armada por
 * `cargarTarjetasFood()` (src/lib/food/tarjetas.ts) — el mismo cálculo
 * que usa /food/demo, para que las dos vistas nunca se desalineen.
 */
export default async function FoodDirectorioPage() {
  const supabase = createAnonClient();
  const tarjetas = await cargarTarjetasFood(supabase, { esDemo: false });

  return (
    <>
      <FoodHeader />
      <main>
        <DirectorioFood negocios={tarjetas} modo="real" />
      </main>
      <FoodFooter />
      <RevealOnScroll />
    </>
  );
}
