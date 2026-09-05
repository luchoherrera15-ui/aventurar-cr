import type { Metadata } from "next";
import LandingSolutions from "./landing-solutions";
import { TEXTOS } from "./textos";

/**
 * /solutions — la landing en español. La versión en inglés vive en
 * /solutions/en y /soluciones es un alias de esta (dueño, 5 sep 2026).
 * Las tres montan el MISMO componente (landing-solutions.tsx) con su
 * diccionario (textos.ts).
 */
export const metadata: Metadata = {
  title: TEXTOS.es.meta.title,
  description: TEXTOS.es.meta.description,
  alternates: { canonical: "/solutions", languages: { es: "/solutions", en: "/solutions/en" } },
};

export default function SolutionsPage() {
  return <LandingSolutions idioma="es" />;
}
