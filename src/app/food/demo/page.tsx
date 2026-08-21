import MarketplaceDemo from "@/components/food/demo/marketplace-demo";

/**
 * LA DEMO COMERCIAL DE FOOD.BOOKEA — food.bookea.lat/demo.
 *
 * Reemplaza al showcase viejo (0193, que leía negocios `es_demo` de la
 * base): esta versión es una vitrina de venta completa con 45
 * restaurantes ficticios que viven como DATOS ESTÁTICOS en
 * src/lib/food/demo/datos — cero consultas y cero escrituras a
 * Supabase, que es el aislamiento más fuerte posible respecto de
 * producción. Header, barra "Modo demo", footer y noindex vienen del
 * layout del segmento (./layout.tsx).
 */
export default function FoodDemoPage() {
  return <MarketplaceDemo />;
}
