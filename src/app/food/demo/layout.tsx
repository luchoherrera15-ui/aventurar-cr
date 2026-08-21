import type { Metadata } from "next";
import FoodHeader from "@/components/food/food-header";
import FoodFooter from "@/components/food/food-footer";
import BannerDemo from "@/components/food/demo/banner-demo";
import RevealOnScroll from "@/components/reveal-on-scroll";

/**
 * EL LAYOUT DE LA DEMO COMERCIAL (/food/demo/**, servido como
 * food.bookea.lat/demo). Todo lo que cuelga de acá comparte el header
 * en modo demo (la navegación se queda dentro de la demo), la barra
 * "Modo demo" y el noindex — una vitrina de venta jamás debe salir en
 * Google como si fuera el directorio real.
 */
export const metadata: Metadata = {
  title: "Demo · FOOD.BOOKEA",
  description:
    "Recorrido demostrativo de FOOD.BOOKEA: así se ve el marketplace con una red completa de restaurantes, promociones por horario y reservas.",
  robots: { index: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FoodHeader demo />
      <BannerDemo />
      <main>{children}</main>
      <FoodFooter />
      <RevealOnScroll />
    </>
  );
}
