import { describe, expect, it } from "vitest";
import {
  esFechaDeDiciembre,
  mejorPromoPorDiaSemana,
  promoAplicableDelDia,
} from "./promociones";
import type { PromocionDia } from "@/app/mi-negocio/types";

function promo(overrides: Partial<PromocionDia>): PromocionDia {
  return {
    id: overrides.id ?? "promo-1",
    rancho_id: "rancho-1",
    dias_semana: [1, 2, 3],
    tipo: "porcentaje",
    porcentaje_descuento: 20,
    precio_fijo: null,
    personas_max: null,
    etiqueta: "Promo",
    activo: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("promoAplicableDelDia", () => {
  it("un día con solo % devuelve esa promo", () => {
    const promos = [promo({ tipo: "porcentaje", porcentaje_descuento: 15 })];
    expect(promoAplicableDelDia(promos, 1, 10)?.porcentaje_descuento).toBe(15);
  });

  it("precio fijo sin tope de personas gana sobre un % configurado el mismo día", () => {
    const promos = [
      promo({ id: "pct", tipo: "porcentaje", porcentaje_descuento: 50 }),
      promo({ id: "fijo", tipo: "precio_fijo", porcentaje_descuento: null, precio_fijo: 55000 }),
    ];
    expect(promoAplicableDelDia(promos, 1, 20)?.id).toBe("fijo");
  });

  it("precio fijo con tope excedido cae al mejor % disponible", () => {
    const promos = [
      promo({ id: "pct", tipo: "porcentaje", porcentaje_descuento: 30 }),
      promo({
        id: "fijo",
        tipo: "precio_fijo",
        porcentaje_descuento: null,
        precio_fijo: 55000,
        personas_max: 15,
      }),
    ];
    expect(promoAplicableDelDia(promos, 1, 20)?.id).toBe("pct");
  });

  it("precio fijo con tope respetado sí aplica", () => {
    const promos = [
      promo({
        id: "fijo",
        tipo: "precio_fijo",
        porcentaje_descuento: null,
        precio_fijo: 55000,
        personas_max: 15,
      }),
    ];
    expect(promoAplicableDelDia(promos, 1, 10)?.id).toBe("fijo");
  });

  it("dos precios fijos aplicables el mismo día: gana el más barato", () => {
    const promos = [
      promo({ id: "caro", tipo: "precio_fijo", porcentaje_descuento: null, precio_fijo: 70000 }),
      promo({ id: "barato", tipo: "precio_fijo", porcentaje_descuento: null, precio_fijo: 55000 }),
    ];
    expect(promoAplicableDelDia(promos, 1, 5)?.id).toBe("barato");
  });

  it("ignora promociones inactivas", () => {
    const promos = [promo({ activo: false })];
    expect(promoAplicableDelDia(promos, 1, 10)).toBeNull();
  });

  it("ningún día coincide -> null", () => {
    const promos = [promo({ dias_semana: [5, 6] })];
    expect(promoAplicableDelDia(promos, 1, 10)).toBeNull();
  });
});

describe("mejorPromoPorDiaSemana", () => {
  it("ignora personas_max al armar el badge del día", () => {
    const promos = [
      promo({
        id: "fijo",
        tipo: "precio_fijo",
        porcentaje_descuento: null,
        precio_fijo: 55000,
        personas_max: 1,
      }),
    ];
    expect(mejorPromoPorDiaSemana(promos)[1]?.id).toBe("fijo");
  });

  it("elige la mejor promo por cada día de la semana que aparece", () => {
    const promos = [
      promo({ id: "lunes", dias_semana: [1], tipo: "porcentaje", porcentaje_descuento: 10 }),
      promo({ id: "martes", dias_semana: [2], tipo: "porcentaje", porcentaje_descuento: 25 }),
    ];
    const mapa = mejorPromoPorDiaSemana(promos);
    expect(mapa[1]?.id).toBe("lunes");
    expect(mapa[2]?.id).toBe("martes");
    expect(mapa[3]).toBeUndefined();
  });

  it("ignora promociones inactivas", () => {
    const promos = [promo({ activo: false })];
    expect(mejorPromoPorDiaSemana(promos)).toEqual({});
  });
});

/* ==================================================================
   DICIEMBRE NO LLEVA DESCUENTO
   ==================================================================
   Los lugares cobran precios propios de diciembre (más altos, es
   temporada alta) y la promo automática del día se los comía: un lunes
   de diciembre con −30 % quedaba MÁS BARATO que el mismo lunes de
   setiembre. Estos casos fijan la regla. */

describe("diciembre no lleva descuento", () => {
  const entreSemana = promo({ dias_semana: [1, 2, 3, 4], porcentaje_descuento: 30 });

  it("un lunes normal sí tiene promo", () => {
    expect(promoAplicableDelDia([entreSemana], 1, 40)).not.toBeNull();
  });

  it("el mismo lunes en diciembre NO tiene promo", () => {
    expect(promoAplicableDelDia([entreSemana], 1, 40, { esDiciembre: true })).toBeNull();
  });

  it("en diciembre el calendario tampoco anuncia badges", () => {
    expect(mejorPromoPorDiaSemana([entreSemana])).not.toEqual({});
    expect(mejorPromoPorDiaSemana([entreSemana], { esDiciembre: true })).toEqual({});
  });

  it("un precio fijo promocional también queda fuera en diciembre", () => {
    const fijo = promo({
      id: "fijo",
      tipo: "precio_fijo",
      precio_fijo: 55_000,
      porcentaje_descuento: null,
      dias_semana: [1],
    });
    expect(promoAplicableDelDia([fijo], 1, 15)).not.toBeNull();
    expect(promoAplicableDelDia([fijo], 1, 15, { esDiciembre: true })).toBeNull();
  });

  it("reconoce diciembre por la fecha ISO, sin correrse por zona horaria", () => {
    expect(esFechaDeDiciembre("2026-12-01")).toBe(true);
    expect(esFechaDeDiciembre("2026-12-31")).toBe(true);
    expect(esFechaDeDiciembre("2026-11-30")).toBe(false);
    expect(esFechaDeDiciembre("2027-01-01")).toBe(false);
  });
});
