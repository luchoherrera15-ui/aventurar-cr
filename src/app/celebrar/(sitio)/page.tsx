import type { Metadata } from "next";
import { urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { MARCA } from "@/lib/celebrar/marca";
import Cierre from "./portada/cierre";
import ComoFunciona from "./portada/como-funciona";
import Demos from "./portada/demos";
import Faq from "./portada/faq";
import Funciones from "./portada/funciones";
import Hero from "./portada/hero";
import Precios from "./portada/precios";
import Tipos from "./portada/tipos";
import VideoIA from "./portada/video-ia";
import Vitrina from "./portada/vitrina";

export const metadata: Metadata = {
  title: { absolute: MARCA.tituloPortada },
  description: MARCA.descripcion,
  alternates: { canonical: urlPublicaCelebrar("/") },
};

/**
 * La portada de CELEBRAR (v2, sólida y profesional). El orden sigue el
 * brief y la estructura que las plataformas del rubro ya validaron:
 * héroe marino con el teléfono → ocasiones → funciones en tarjetas →
 * vitrina del producto → video con IA → cómo funciona → precios →
 * preguntas → banda final. Componentes de servidor sin estado; lo
 * único vivo es la invitación del teléfono.
 */
export default function PortadaCelebrar() {
  return (
    <>
      <Hero />
      <Tipos />
      <Demos />
      <Funciones />
      <Vitrina />
      <VideoIA />
      <ComoFunciona />
      <Precios />
      <Faq />
      <Cierre />
    </>
  );
}
