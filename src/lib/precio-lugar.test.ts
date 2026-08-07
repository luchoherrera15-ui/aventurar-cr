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

// ------------------------------------------------------------------
// Modalidad por_persona (0103) — los números reales de Rancho Las
// Torres: fijo 1-25, tarifa plana el año, y en diciembre fijo por día
// + tarifa deslizante 30→₡5.500, 50→₡4.500, 100→₡4.000.
// ------------------------------------------------------------------

import {
  parsearPrecioPorPersona,
  tarifaPorTramos,
  type PrecioPorPersona,
} from "./precio-lugar";

const LAS_TORRES: PrecioPorPersona = {
  baseMax: 25,
  basePrecio: 95_000,
  tarifa: 3_400,
  dicLunJue: 125_000,
  dicViernes: 145_000,
  dicSabDom: 165_000,
  dicTramos: [
    { invitados: 30, tarifa: 5_500 },
    { invitados: 50, tarifa: 4_500 },
    { invitados: 100, tarifa: 4_000 },
  ],
};

function porPersona(extra: Partial<DatosPrecioLugar> = {}): DatosPrecioLugar {
  return {
    modalidad: "por_persona",
    esDiciembre: false,
    porPersona: LAS_TORRES,
    diaSemana: 2,
    invitados: 20,
    rangos: [],
    horas: null,
    precioHora: null,
    precioFijo: null,
    ...extra,
  };
}

describe("calcularBaseLugar — por persona, resto del año", () => {
  it("el fijo cubre 1-25", () => {
    expect(calcularBaseLugar(porPersona({ invitados: 1 }))).toBe(95_000);
    expect(calcularBaseLugar(porPersona({ invitados: 25 }))).toBe(95_000);
  });

  it("desde 26 es invitados × tarifa, mostrado como total", () => {
    expect(calcularBaseLugar(porPersona({ invitados: 26 }))).toBe(88_400);
    expect(calcularBaseLugar(porPersona({ invitados: 40 }))).toBe(136_000);
    expect(calcularBaseLugar(porPersona({ invitados: 100 }))).toBe(340_000);
  });

  it("sin invitados o sin config no hay precio", () => {
    expect(calcularBaseLugar(porPersona({ invitados: null }))).toBeNull();
    expect(calcularBaseLugar(porPersona({ porPersona: null }))).toBeNull();
  });

  it("una promo de precio fijo del día manda sobre todo", () => {
    expect(calcularBaseLugar(porPersona({ promoPrecioFijo: 60_000 }))).toBe(60_000);
  });
});

describe("calcularBaseLugar — por persona en diciembre", () => {
  const dic = (extra: Partial<DatosPrecioLugar> = {}) =>
    porPersona({ esDiciembre: true, ...extra });

  it("grupos chicos: el fijo del día (lun-jue / viernes / sáb-dom)", () => {
    expect(calcularBaseLugar(dic({ invitados: 20, diaSemana: 1 }))).toBe(125_000);
    expect(calcularBaseLugar(dic({ invitados: 20, diaSemana: 4 }))).toBe(125_000);
    expect(calcularBaseLugar(dic({ invitados: 20, diaSemana: 5 }))).toBe(145_000);
    expect(calcularBaseLugar(dic({ invitados: 20, diaSemana: 6 }))).toBe(165_000);
    // Domingo cobra como sábado (decisión del dueño).
    expect(calcularBaseLugar(dic({ invitados: 20, diaSemana: 0 }))).toBe(165_000);
  });

  it("antes de la primera ancla rige su tarifa (26-30 → ₡5.500)", () => {
    expect(calcularBaseLugar(dic({ invitados: 26 }))).toBe(26 * 5_500);
    expect(calcularBaseLugar(dic({ invitados: 30 }))).toBe(165_000);
  });

  it("entre 30 y 50 la tarifa baja en línea recta hasta ₡4.500", () => {
    expect(calcularBaseLugar(dic({ invitados: 40 }))).toBe(40 * 5_000);
    expect(calcularBaseLugar(dic({ invitados: 50 }))).toBe(50 * 4_500);
  });

  it("entre 50 y 100 sigue bajando suave hasta ₡4.000 y se planta", () => {
    expect(calcularBaseLugar(dic({ invitados: 75 }))).toBe(75 * 4_250);
    expect(calcularBaseLugar(dic({ invitados: 100 }))).toBe(400_000);
    expect(calcularBaseLugar(dic({ invitados: 150 }))).toBe(600_000);
  });

  it("sin tramos de diciembre cae a la tarifa normal", () => {
    const sinTramos = { ...LAS_TORRES, dicTramos: [] };
    expect(calcularBaseLugar(dic({ invitados: 40, porPersona: sinTramos }))).toBe(136_000);
  });
});

describe("tarifaPorTramos y parseo de la config", () => {
  it("interpola al colón entre anclas", () => {
    expect(tarifaPorTramos(LAS_TORRES.dicTramos, 35)).toBe(5_250);
    expect(tarifaPorTramos(LAS_TORRES.dicTramos, 63)).toBe(4_370);
  });

  it("una config malformada devuelve null (nunca ₡0)", () => {
    expect(parsearPrecioPorPersona(null)).toBeNull();
    expect(parsearPrecioPorPersona({ baseMax: 25 })).toBeNull();
    expect(
      parsearPrecioPorPersona({ ...LAS_TORRES, dicTramos: [{ invitados: 30 }] }),
    ).toBeNull();
  });

  it("una config buena pasa entera y ordena los tramos", () => {
    const v = parsearPrecioPorPersona({
      ...LAS_TORRES,
      dicTramos: [...LAS_TORRES.dicTramos].reverse(),
    });
    expect(v?.dicTramos.map((t) => t.invitados)).toEqual([30, 50, 100]);
  });
});
