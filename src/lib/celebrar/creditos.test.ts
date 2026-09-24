import { describe, expect, it } from "vitest";
import { PAQUETES, PRECIOS, PRECIO_A_MEDIDA_CRC, PRECIO_PLANTILLA_CRC, VALOR_CREDITO_CRC, colones, creditosDePublicar, leerPago } from "./creditos";
import { paquetePorId } from "./pagos/creditos-pagados";

describe("los precios por invitación (24 sep 2026)", () => {
  it("plantilla ₡7 500 y a medida ₡10 500, en créditos enteros", () => {
    expect(PRECIO_PLANTILLA_CRC).toBe(7_500);
    expect(PRECIO_A_MEDIDA_CRC).toBe(10_500);
    expect(creditosDePublicar(false) * VALOR_CREDITO_CRC).toBe(7_500);
    expect(creditosDePublicar(true) * VALOR_CREDITO_CRC).toBe(10_500);
    expect(Number.isInteger(PRECIOS.publicar)).toBe(true);
    expect(Number.isInteger(PRECIOS.a_medida)).toBe(true);
  });

  it("lo que se cobra con tarjeta acredita exactamente lo que cuesta la invitación", () => {
    const inv = PAQUETES.find((p) => p.id === "inv")!;
    const medida = PAQUETES.find((p) => p.id === "medida")!;
    expect(inv.creditos).toBe(PRECIOS.publicar);
    expect(inv.precioCRC).toBe(PRECIO_PLANTILLA_CRC);
    expect(medida.creditos).toBe(PRECIOS.a_medida);
    expect(medida.precioCRC).toBe(PRECIO_A_MEDIDA_CRC);
  });

  it("los paquetes viejos se siguen reconociendo (un pago puede llegar tarde)", () => {
    expect(paquetePorId("p250")).toEqual({ id: "p250", creditos: 250, precioCRC: 11_500, partner: false });
  });

  it("una invitación pagada con los planes viejos sigue contando como pagada", () => {
    for (const plan of ["whatsapp", "panel", "plantilla", "medida"]) {
      expect(leerPago({ plan, creditos: 80, en: "2026-09-22T00:00:00Z" })?.plan).toBe(plan);
    }
    expect(leerPago({ plan: "otro", creditos: 80, en: "x" })).toBeNull();
  });

  it("formatea colones", () => {
    expect(colones(7_500).replace(/\s/g, " ")).toMatch(/^₡7.500$/);
  });
});
