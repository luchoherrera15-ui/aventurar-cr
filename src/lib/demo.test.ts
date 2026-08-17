import { describe, expect, it } from "vitest";
import { esDemo } from "./demo";

/**
 * El bug real que fija esta suite: la interfaz decidía si un negocio era
 * de muestra mirando SOLO el prefijo del slug, y los guiones de siembra
 * marcan `detalles.demo = true` siempre — incluso en los demos cuyo
 * slug NO lleva el prefijo, que se sembraron justamente para parecer un
 * negocio real (Café Oscuro, SILENCE BARBER SHOP). Esos dos salían en
 * la portada indistinguibles de un local que sí existe.
 */
describe("esDemo — la marca de detalles manda", () => {
  it("un demo sembrado sin prefijo en el slug SÍ es demo (el caso que fallaba)", () => {
    expect(esDemo("cafe-oscuro", { demo: true, sembrado: "cafe-oscuro" })).toBe(true);
    expect(esDemo("silence-barber-shop", { demo: true })).toBe(true);
  });

  it("un demo con prefijo en el slug sigue siendo demo aunque no traiga detalles", () => {
    expect(esDemo("demo-nails-studio-cr", null)).toBe(true);
    expect(esDemo("demo-zen-spa-masajes", undefined)).toBe(true);
  });

  it("los dos criterios juntos, que es como los siembran de verdad", () => {
    expect(esDemo("demo-salon-elegance-cr", { demo: true, horario_citas: {} })).toBe(true);
  });
});

describe("esDemo — un negocio real nunca se marca", () => {
  it("sin marca y sin prefijo, es real", () => {
    expect(esDemo("rancholastorres", { en_configuracion: false })).toBe(false);
    expect(esDemo("puramatcha-bar", {})).toBe(false);
    expect(esDemo("rancho-don-luis", null)).toBe(false);
  });

  it("un negocio real cuyo nombre EMPIEZA distinto a «demo-» no se confunde", () => {
    // «demonio», «democracia»: el prefijo es "demo-" CON guion.
    expect(esDemo("demoliciones-cr", null)).toBe(false);
    expect(esDemo("democracia-eventos", {})).toBe(false);
  });

  it("`demo` con un valor que no es exactamente true no alcanza", () => {
    // jsonb libre: alguien podría dejar "false", 0 o el string "true".
    // Solo el booleano true marca — lo demás se trata como no-demo para
    // no etiquetar de muestra a un negocio real por un dato mal escrito.
    expect(esDemo("negocio-real", { demo: false })).toBe(false);
    expect(esDemo("negocio-real", { demo: "true" })).toBe(false);
    expect(esDemo("negocio-real", { demo: 1 })).toBe(false);
  });
});

describe("esDemo — valores ausentes no revientan", () => {
  it("slug nulo o vacío sin detalles", () => {
    expect(esDemo(null, null)).toBe(false);
    expect(esDemo(undefined, undefined)).toBe(false);
    expect(esDemo("", null)).toBe(false);
  });

  it("slug nulo pero marcado en detalles: sigue siendo demo", () => {
    expect(esDemo(null, { demo: true })).toBe(true);
  });
});
