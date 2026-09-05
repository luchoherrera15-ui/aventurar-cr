import type { Metadata } from "next";
import LandingSolutions from "../landing-solutions";
import { TEXTOS } from "../textos";

/** /solutions/en — the same landing, in English (owner, Sep 5 2026). */
export const metadata: Metadata = {
  title: TEXTOS.en.meta.title,
  description: TEXTOS.en.meta.description,
  alternates: { canonical: "/solutions/en", languages: { es: "/solutions", en: "/solutions/en" } },
};

export default function SolutionsEnPage() {
  return <LandingSolutions idioma="en" />;
}
