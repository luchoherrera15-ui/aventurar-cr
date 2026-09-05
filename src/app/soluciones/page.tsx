import type { Metadata } from "next";
import LandingSolutions from "@/app/solutions/landing-solutions";
import { TEXTOS } from "@/app/solutions/textos";

/**
 * /soluciones — la misma landing que /solutions, con la URL en español
 * (dueño, 5 sep 2026: «bookea.lat/soluciones también»). El canónico
 * apunta a /solutions para que Google no vea dos páginas iguales.
 */
export const metadata: Metadata = {
  title: TEXTOS.es.meta.title,
  description: TEXTOS.es.meta.description,
  alternates: { canonical: "/solutions", languages: { es: "/solutions", en: "/solutions/en" } },
};

export default function SolucionesPage() {
  return <LandingSolutions idioma="es" />;
}
