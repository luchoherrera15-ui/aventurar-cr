import { describe, expect, it } from "vitest";
import { calcularBaseLugar, type DatosPrecioLugar } from "./precio-lugar";

/** Un lugar que cobra por rango de personas, sin nada de diciembre. */
function base(extra: Partial<DatosPrecioLugar> = {}): DatosPrecioLugar {
  return {
    modalidad: "rango_personas",
    esDiciembre: false,
    invitados: 30,
    rangos: [
      { min_invitados: 1, max_invitados: 20, precio: 80_000 },
      { min_invitados: 21, max_invitados: 50, precio: 120_000 },
    ],
    horas: null,
    precioHora: null,
    precioFijo: null,
    ...extra,
  };
}

describe("calcularBaseLugar — rangos de personas", () => {
  it("cobra el rango que cubre a los invitados", () => {
    expect(calcularBaseLugar(base({ invitados: 15 }))).toBe(80_000);
    expect(calcularBaseLugar(base({ invitados: 30 }))).toBe(120_000);
  });

  it("los bordes del rango entran (20 y 21 caen en rangos distintos)", () => {
    expect(calcularBaseLugar(base({ invitados: 20 }))).toBe(80_000);
    expect(calcularBaseLugar(base({ invitados: 21 }))).toBe(120_000);
  });

  it("sin invitados todavía no hay precio", () => {
    expect(calcularBaseLugar(base({ invitados: null }))).toBeNull();
  });

  it("una cantidad fuera de todos los rangos queda a cotizar", () => {
    expect(calcularBaseLugar(base({ invitados: 300 }))).toBeNull();
  });
});

describe("calcularBaseLugar — diciembre por rangos (0099)", () => {
  const conDiciembre = {
    rangosDiciembre: [
      { min_invitados: 1, max_invitados: 20, precio: 150_000 },
      { min_invitados: 21, max_invitados: 50, precio: 220_000 },
    ],
  };

  it("en diciembre manda el rango de diciembre", () => {
    expect(calcularBaseLugar(base({ esDiciembre: true, invitados: 15, ...conDiciembre }))).toBe(
      150_000,
    );
    expect(calcularBaseLugar(base({ esDiciembre: true, invitados: 30, ...conDiciembre }))).toBe(
      220_000,
    );
  });

  it("fuera de diciembre esos rangos no se usan", () => {
    expect(calcularBaseLugar(base({ esDiciembre: false, invitados: 15, ...conDiciembre }))).toBe(
      80_000,
    );
  });

  it("sin rangos de diciembre cargados, ese mes se cobra como siempre — nunca ₡0", () => {
    expect(calcularBaseLugar(base({ esDiciembre: true, invitados: 15 }))).toBe(80_000);
  });

  it("respeta la tarifa por persona vieja de quien nunca migró a rangos", () => {
    expect(
      calcularBaseLugar(
        base({ esDiciembre: true, invitados: 10, tarifaDiciembrePorPersona: 5_000 }),
      ),
    ).toBe(50_000);
  });

  it("los rangos de diciembre le ganan a la tarifa por persona vieja", () => {
    expect(
      calcularBaseLugar(
        base({
          esDiciembre: true,
          invitados: 15,
          tarifaDiciembrePorPersona: 5_000,
          ...conDiciembre,
        }),
      ),
    ).toBe(150_000);
  });

  it("una tarifa vieja en cero no cobra cero: cae al precio de siempre", () => {
    expect(
      calcularBaseLugar(base({ esDiciembre: true, invitados: 15, tarifaDiciembrePorPersona: 0 })),
    ).toBe(80_000);
  });
});

describe("calcularBaseLugar — precio fijo", () => {
  const fijo = { modalidad: "fijo" as const, precioFijo: 300_000 };

  it("cobra el fijo de siempre fuera de diciembre", () => {
    expect(calcularBaseLugar(base(fijo))).toBe(300_000);
  });

  it("en diciembre cobra el fijo de diciembre si lo cargaron", () => {
    expect(
      calcularBaseLugar(base({ ...fijo, esDiciembre: true, precioFijoDiciembre: 450_000 })),
    ).toBe(450_000);
  });

  it("sin fijo de diciembre, ese mes cobra el de siempre", () => {
    expect(calcularBaseLugar(base({ ...fijo, esDiciembre: true }))).toBe(300_000);
  });

  it("sin ningún fijo cargado queda a cotizar", () => {
    expect(calcularBaseLugar(base({ modalidad: "fijo", precioFijo: null }))).toBeNull();
  });
});

describe("calcularBaseLugar — por hora", () => {
  const porHora = { modalidad: "hora" as const, horas: 4, precioHora: 25_000 };

  it("multiplica horas por la tarifa", () => {
    expect(calcularBaseLugar(base(porHora))).toBe(100_000);
  });

  it("en diciembre usa la tarifa por hora de diciembre", () => {
    expect(
      calcularBaseLugar(base({ ...porHora, esDiciembre: true, precioHoraDiciembre: 40_000 })),
    ).toBe(160_000);
  });

  it("sin tarifa de diciembre, ese mes cobra la de siempre", () => {
    expect(calcularBaseLugar(base({ ...porHora, esDiciembre: true }))).toBe(100_000);
  });

  it("sin horas elegidas todavía no hay precio", () => {
    expect(calcularBaseLugar(base({ ...porHora, horas: null }))).toBeNull();
  });
});

describe("calcularBaseLugar — la promo de precio fijo del día", () => {
  it("pisa cualquier modalidad", () => {
    expect(calcularBaseLugar(base({ promoPrecioFijo: 99_000 }))).toBe(99_000);
  });

  it("pisa también los precios de diciembre", () => {
    expect(
      calcularBaseLugar(
        base({
          esDiciembre: true,
          promoPrecioFijo: 99_000,
          rangosDiciembre: [{ min_invitados: 1, max_invitados: 50, precio: 500_000 }],
        }),
      ),
    ).toBe(99_000);
  });

  it("una promo de ₡0 (evento de cortesía) es un precio válido, no 'sin precio'", () => {
    expect(calcularBaseLugar(base({ promoPrecioFijo: 0 }))).toBe(0);
  });
});
