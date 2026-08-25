"use client";

/**
 * EL MOTOR VISUAL COMPLETO DE /assist.
 *
 * Compone las 10 bandas dentro de `<ProveedorMotor>` (el único loop de
 * rAF de la página — ver `motor.tsx`). `page.tsx` se queda como Server
 * Component (metadata, Open Graph); todo lo interactivo vive acá.
 */

import { ProveedorMotor } from "./motor";
import Hero from "./hero";
import Marquesina from "./marquesina";
import Problema from "./problema";
import ComoFunciona from "./como-funciona";
import Escenarios from "./escenarios";
import Tono from "./tono";
import PanelMockup from "./panel-mockup";
import Caracteristicas from "./caracteristicas";
import CtaFinal from "./cta-final";
import Pie from "./pie";

export default function AssistExperiencia() {
  return (
    <ProveedorMotor>
      <Hero />
      <Marquesina />
      <Problema />
      <ComoFunciona />
      <Escenarios />
      <Tono />
      <PanelMockup />
      <Caracteristicas />
      <CtaFinal />
      <Pie />
    </ProveedorMotor>
  );
}
