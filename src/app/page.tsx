import type { Metadata } from "next";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import AvisoSuperior from "@/components/home/aviso-superior";
import HeaderSimple from "@/components/home/header-simple";
import HeroBusqueda from "@/components/home/hero-busqueda";
import ExploraBookea from "@/components/home/explora-bookea";
import RielesCatalogo from "@/components/home/rieles-catalogo";
import ExplorarRubros from "@/components/home/explorar-rubros";
import { DATOS_ORGANIZACION } from "@/lib/seo-organizacion";
import { leerCatalogoPortada } from "./home-datos";
import { urlSitio } from "@/lib/sitio";

/**
 * ============================================================
 * LA PORTADA DE BOOKEA — `bookea.lat`
 * ============================================================
 *
 * ── TERCERA VUELTA (pedido del dueño, ago 2026) ───────────────────
 *
 * El buscador sobre el fondo difuminado y los rieles por vertical
 * (`HeroBusqueda` + `RielesCatalogo`, de la vuelta anterior) se quedan
 * tal cual. Lo que cambió es TODO lo que iba abajo: "Todo lo que
 * Bookea te da" (`CarruselServicios`), la banda de llamada
 * (`CtaLlamada`), la vidriera de 5 negocios (`MarketplaceVidriera`) y
 * "Tu talento merece ser encontrado" (`BloqueNegocios`) quedan
 * afuera — el pedido explícito fue «los rieles es lo que tendrá esta
 * página abajo». En su lugar, justo debajo de los rieles, va
 * `ExplorarRubros` ("cards pequeños con cada categoría"): 36 rubros
 * reales agrupados por vertical, ya armado desde antes pero huérfano
 * (sin ningún consumidor) hasta ahora.
 *
 * Los cuatro componentes retirados NO se borraron del repo — solo
 * dejaron de importarse acá. Si hacen falta en otro lado, siguen
 * enteros en `src/components/home/`.
 *
 * ── EL ORDEN DE LA PÁGINA ─────────────────────────────────────────
 *
 *   1. `AvisoSuperior`            — arriba del header, igual que antes.
 *   2. `HeaderSimple`             — logo, LOGIN, "¡Une tu negocio!". Sin
 *                                    buscador propio: el buscador vive
 *                                    en el héroe, no en la barra.
 *   3. `HeroBusqueda`             — título + buscador + "Otros servicios".
 *   4. `RielesCatalogo`           — el catálogo real, un riel por vertical
 *                                    (datos de `leerCatalogoPortada()`),
 *                                    con tarjetas más chicas que en el
 *                                    directorio (ver `rieles-catalogo.tsx`).
 *   5. `ExplorarRubros`           — "Explorá por rubro", 36 tiles chicos.
 *   6. `SiteFooter`.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ────────────────────────────────────
 * Ni estrellas, ni cifras inventadas, ni negocios de mentira. Los
 * rieles consultan la base — ver `rieles-catalogo.tsx`. `ExplorarRubros`
 * no promete negocios, solo abre la puerta a cada rubro (ver el doc
 * comment de ese archivo).
 */

export const metadata: Metadata = {
  title: {
    absolute: "Bookea — Reservá servicios y encontrá proveedores para eventos",
  },
  description:
    "Reservá citas de belleza, barbería, spa y salud, y encontrá lugares, catering, música y decoración para tu evento en todo Costa Rica. Precios en colones, a la vista, y reserva directa sin cadenas de WhatsApp.",
  alternates: { canonical: urlSitio("/") },
};

export default async function Home() {
  const catalogo = await leerCatalogoPortada();

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ORGANIZACION) }}
      />

      <AvisoSuperior />
      <HeaderSimple />

      <main className="flex-1">
        <HeroBusqueda />
        <div className="px-5 py-12 sm:px-8">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-14 sm:gap-16">
            <ExploraBookea />
            <RielesCatalogo {...catalogo} />
            <ExplorarRubros />
          </div>
        </div>
      </main>

      <SiteFooter />
      <RevealOnScroll />
    </div>
  );
}
