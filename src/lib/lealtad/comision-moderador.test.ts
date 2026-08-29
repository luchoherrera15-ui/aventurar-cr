import { describe, it, expect } from "vitest";
import {
  comisionMensualUSD,
  casilleroDePlan,
  CONTEO_VACIO,
} from "./comision-moderador";

const c = (parcial: Partial<typeof CONTEO_VACIO>) => ({ ...CONTEO_VACIO, ...parcial });

describe("comisionMensualUSD — Starter en grupos de 3", () => {
  it("1 Starter suelto = $1", () => {
    expect(comisionMensualUSD(c({ arranque: 1 }))).toBe(1);
  });
  it("2 Starter sueltos = $2", () => {
    expect(comisionMensualUSD(c({ arranque: 2 }))).toBe(2);
  });
  it("3 Starter (un trío) = $18 ($6 cada uno)", () => {
    expect(comisionMensualUSD(c({ arranque: 3 }))).toBe(18);
  });
  it("4 Starter = $19 (un trío + 1 suelto)", () => {
    expect(comisionMensualUSD(c({ arranque: 4 }))).toBe(19);
  });
  it("6 Starter = $36 (dos tríos)", () => {
    expect(comisionMensualUSD(c({ arranque: 6 }))).toBe(36);
  });
});

describe("comisionMensualUSD — Impulso y combinaciones", () => {
  it("1 Impulso = $10", () => {
    expect(comisionMensualUSD(c({ impulso: 1 }))).toBe(10);
  });
  it("3 Impulso = $30", () => {
    expect(comisionMensualUSD(c({ impulso: 3 }))).toBe(30);
  });
  it("3 Starter + 2 Impulso = $38", () => {
    expect(comisionMensualUSD(c({ arranque: 3, impulso: 2 }))).toBe(38);
  });
  it("Prueba e Ilimitado no pagan (todavía)", () => {
    expect(comisionMensualUSD(c({ prueba: 5, ilimitado: 4 }))).toBe(0);
  });
});

describe("casilleroDePlan", () => {
  it("mapea los ids y el nulo (gratis)", () => {
    expect(casilleroDePlan("arranque")).toBe("arranque");
    expect(casilleroDePlan("impulso")).toBe("impulso");
    expect(casilleroDePlan("ilimitado")).toBe("ilimitado");
    expect(casilleroDePlan(null)).toBe("prueba");
    expect(casilleroDePlan("desconocido")).toBe("otros");
  });
});
