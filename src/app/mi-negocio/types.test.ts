import { describe, expect, it } from "vitest";
import { bloqueDisponibleEnDia, resumenDias, type HorarioBloqueConfig } from "./types";

function bloque(overrides: Partial<HorarioBloqueConfig>): HorarioBloqueConfig {
  return {
    id: "b1",
    etiqueta: "Día completo",
    desde: "08:00",
    hasta: "22:00",
    ...overrides,
  };
}

describe("bloqueDisponibleEnDia", () => {
  it("sin dias_semana (bloque guardado antes del campo) aplica todos los días", () => {
    const b = bloque({});
    for (let dow = 0; dow <= 6; dow++) {
      expect(bloqueDisponibleEnDia(b, dow)).toBe(true);
    }
  });

  it("dias_semana vacío aplica todos los días", () => {
    const b = bloque({ dias_semana: [] });
    expect(bloqueDisponibleEnDia(b, 2)).toBe(true);
  });

  it("con días marcados, solo aplica esos días", () => {
    const b = bloque({ dias_semana: [1, 2, 3, 4] }); // Lun-Jue
    expect(bloqueDisponibleEnDia(b, 1)).toBe(true);
    expect(bloqueDisponibleEnDia(b, 4)).toBe(true);
    expect(bloqueDisponibleEnDia(b, 5)).toBe(false);
    expect(bloqueDisponibleEnDia(b, 0)).toBe(false);
  });
});

describe("resumenDias", () => {
  it("undefined -> null (todos los días)", () => {
    expect(resumenDias(undefined)).toBeNull();
  });

  it("[] -> null (todos los días)", () => {
    expect(resumenDias([])).toBeNull();
  });

  it("los 7 días marcados -> null (equivalente a sin restricción)", () => {
    expect(resumenDias([0, 1, 2, 3, 4, 5, 6])).toBeNull();
  });

  it("rango contiguo Lun-Jue -> 'Lun–Jue'", () => {
    expect(resumenDias([1, 2, 3, 4])).toBe("Lun–Jue");
  });

  it("rango que cruza el domingo (Vie-Sáb-Dom) -> 'Vie–Dom'", () => {
    expect(resumenDias([5, 6, 0])).toBe("Vie–Dom");
  });

  it("un solo día -> ese día solo", () => {
    expect(resumenDias([3])).toBe("Mié");
  });

  it("días sueltos no contiguos -> lista separada por coma", () => {
    expect(resumenDias([1, 3, 5])).toBe("Lun, Mié, Vie");
  });
});
