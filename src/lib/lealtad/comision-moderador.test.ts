import { describe, it, expect } from "vitest";
import {
  comisionMensualUSD,
  comisionDeNegocioUSD,
  casilleroDePlan,
  dolares,
  CONTEO_VACIO,
} from "./comision-moderador";

const c = (parcial: Partial<typeof CONTEO_VACIO>) => ({ ...CONTEO_VACIO, ...parcial });

describe("comisionDeNegocioUSD — la tarifa por negocio", () => {
  it("Impulso deja $15", () => {
    expect(comisionDeNegocioUSD("impulso")).toBe(15);
  });
  it("Starter deja $1,50", () => {
    expect(comisionDeNegocioUSD("arranque")).toBe(1.5);
  });
  it("Prueba, Ilimitado y lo desconocido no pagan (todavía)", () => {
    expect(comisionDeNegocioUSD("prueba")).toBe(0);
    expect(comisionDeNegocioUSD(null)).toBe(0);
    expect(comisionDeNegocioUSD("ilimitado")).toBe(0);
    expect(comisionDeNegocioUSD("paquete-que-no-existe")).toBe(0);
  });
});

describe("comisionMensualUSD — es la SUMA de las filas", () => {
  it("un negocio de cada uno", () => {
    expect(comisionMensualUSD(c({ arranque: 1 }))).toBe(1.5);
    expect(comisionMensualUSD(c({ impulso: 1 }))).toBe(15);
  });
  it("escala lineal: sin grupos ni saltos", () => {
    expect(comisionMensualUSD(c({ arranque: 4 }))).toBe(6);
    expect(comisionMensualUSD(c({ impulso: 3 }))).toBe(45);
  });
  it("3 Starter + 2 Impulso = $34,50", () => {
    expect(comisionMensualUSD(c({ arranque: 3, impulso: 2 }))).toBe(34.5);
  });
  it("Prueba e Ilimitado no pagan (todavía)", () => {
    expect(comisionMensualUSD(c({ prueba: 5, ilimitado: 4 }))).toBe(0);
  });

  // La razón de ser de la tarifa plana: el total tiene que poder
  // reconstruirse fila por fila. Con la regla vieja (Starter en grupos
  // de 3) esta prueba era imposible de escribir.
  it("el total coincide con sumar cada negocio por separado", () => {
    const negocios = ["arranque", "arranque", "impulso", "prueba", "arranque", "impulso"];
    const porFila = negocios.reduce((s, p) => s + comisionDeNegocioUSD(p), 0);
    expect(comisionMensualUSD(c({ arranque: 3, impulso: 2, prueba: 1 }))).toBe(
      Math.round(porFila * 100) / 100,
    );
  });

  it("no arrastra restos de coma flotante", () => {
    // 7 × 1,5 = 10,5 exacto: nada de «10.500000000000002».
    expect(comisionMensualUSD(c({ arranque: 7 }))).toBe(10.5);
    expect(String(comisionMensualUSD(c({ arranque: 7 })))).toBe("10.5");
  });
});

describe("dolares — decimales solo cuando hacen falta", () => {
  it("redondo va sin decimales", () => {
    expect(dolares(15)).toBe("$15");
    expect(dolares(0)).toBe("$0");
  });
  it("con centavos, dos decimales", () => {
    expect(dolares(1.5)).toBe("$1,50");
    expect(dolares(34.5)).toBe("$34,50");
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
