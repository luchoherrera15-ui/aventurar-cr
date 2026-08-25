import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import DirectorioPuerta from "@/components/directorio-puerta";
import { puertaPorId } from "@/components/nav/taxonomia-navegacion";

export const metadata: Metadata = {
  title: "Experiencias",
  description:
    "Escapadas y experiencias para reservar en Costa Rica — directo con quien las ofrece, sin intermediarios.",
  // Con cero negocios detrás, pedirle a Google que la indexe sería
  // sembrar una página vacía. Se quita el día que la sección tenga algo
  // — y por eso tampoco está en el sitemap todavía.
  robots: { index: false, follow: true },
};

/**
 * ============================================================
 * /experiencias — la puerta que hasta hoy era un 404
 * ============================================================
 *
 * Antes de esta ruta, `/experiencias` caía en `src/app/[slug]/page.tsx`
 * y terminaba en `notFound()`: 404 duro. Una de las cinco puertas del
 * header no puede ser un callejón sin salida.
 *
 * ⚠️ NO es una vertical. El CHECK de `ranchos.vertical` (0076) acepta
 * `eventos | citas | hospedajes | restaurantes` y `experiencias` sería
 * rechazado por la base. Esta pantalla es una LENTE sobre lo que sí
 * existe: hoy, los hospedajes de categoría `experiencia`. Los rubros de
 * tours y aventura que se pidieron están declarados en la taxonomía como
 * «sin base» y no se dibujan hasta que existan de verdad.
 */
export default function ExperienciasPage() {
  const puerta = puertaPorId("experiencias");
  if (!puerta) notFound();

  return (
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Experiencias" />
      <DirectorioPuerta
        puerta={puerta}
        intro="Escapadas, estadías con actividad incluida y planes para reservar en línea."
      />
      <SiteFooter />
    </div>
  );
}
