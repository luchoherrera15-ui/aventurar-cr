import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import DirectorioPuerta from "@/components/directorio-puerta";
import { puertaPorId } from "@/components/nav/taxonomia-navegacion";

export const metadata: Metadata = {
  title: "Servicios",
  description:
    "Servicios para reservar en Costa Rica: para tu evento, tu mascota y tu vehículo — directo con quien los presta.",
  // Ver la nota de /experiencias: sin negocios detrás no se pide
  // indexación, y tampoco entra al sitemap.
  robots: { index: false, follow: true },
};

/**
 * ============================================================
 * /servicios — una puerta que junta DOS verticales
 * ============================================================
 *
 * Antes de esta ruta, `/servicios` caía en `src/app/[slug]/page.tsx` y
 * terminaba en `notFound()`: 404 duro.
 *
 * `servicios` tampoco es una vertical, y acá está la demostración de por
 * qué no hace falta que lo sea: la pantalla junta la ferretería del
 * evento —transporte, seguridad, baños portátiles, plantas eléctricas,
 * que viven en `eventos` con categoría «otros»— con los rubros de
 * `citas` que la 0188 abrió y que nadie está usando todavía (mascotas,
 * automotriz, tatuajes). El visitante nunca ve la costura.
 *
 * Qué entra exactamente lo decide la puerta en
 * `@/components/nav/taxonomia-navegacion`, no esta pantalla.
 */
export default function ServiciosPage() {
  const puerta = puertaPorId("servicios");
  if (!puerta) notFound();

  return (
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Servicios" />
      <DirectorioPuerta
        puerta={puerta}
        intro="Todo lo que se contrata aparte: para tu evento, para tu mascota y para tu vehículo."
      />
      <SiteFooter />
    </div>
  );
}
