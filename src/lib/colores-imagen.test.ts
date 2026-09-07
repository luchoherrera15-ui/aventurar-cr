import { describe, expect, it } from "vitest";
import { contraste, hexDe, hslAHex, luminancia, paletaDePixeles, rgbAHsl } from "./colores-imagen";

/** Un «cuadro» de píxeles RGBA a partir de una lista de colores con peso. */
function pixeles(colores: { rgb: [number, number, number]; n: number; a?: number }[]): Uint8ClampedArray {
  const total = colores.reduce((s, c) => s + c.n, 0);
  const out = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const c of colores) {
    for (let k = 0; k < c.n; k++) {
      out[i++] = c.rgb[0];
      out[i++] = c.rgb[1];
      out[i++] = c.rgb[2];
      out[i++] = c.a ?? 255;
    }
  }
  return out;
}

describe("paletaDePixeles", () => {
  it("una imagen totalmente transparente no propone nada", () => {
    expect(paletaDePixeles(pixeles([{ rgb: [255, 0, 0], n: 50, a: 0 }]))).toBeNull();
    expect(paletaDePixeles(new Uint8ClampedArray(0))).toBeNull();
  });

  it("un logo rojo sobre transparente: el dominante es el rojo, no el vacío", () => {
    const p = paletaDePixeles(pixeles([{ rgb: [0, 0, 0], n: 900, a: 0 }, { rgb: [220, 30, 30], n: 100 }]));
    expect(p).not.toBeNull();
    expect(p!.dominante).toBe(hexDe(220, 30, 30));
    // El fondo sale oscuro (la foto es media/oscura) y en el mismo tono.
    const f = rgbAHsl(...hexARgb(p!.fondo));
    expect(f.l).toBeLessThan(0.3);
    expect(Math.abs(f.h - 0)).toBeLessThan(8);
    // Y el acento contrasta con él.
    expect(contraste(p!.acento, p!.fondo)).toBeGreaterThanOrEqual(2.5);
  });

  it("navy con un toque naranja: el acento es el naranja, el fondo el navy", () => {
    const p = paletaDePixeles(
      pixeles([
        { rgb: [10, 18, 40], n: 940 },
        { rgb: [255, 122, 40], n: 40 },
        { rgb: [120, 120, 120], n: 20 },
      ]),
    );
    expect(p).not.toBeNull();
    const a = rgbAHsl(...hexARgb(p!.acento));
    expect(a.h).toBeGreaterThan(15);
    expect(a.h).toBeLessThan(45);
    const f = rgbAHsl(...hexARgb(p!.fondo));
    expect(f.h).toBeGreaterThan(200);
    expect(f.h).toBeLessThan(250);
    expect(f.l).toBeLessThan(0.3);
    expect(p!.muestras[0]).toBe(hexDe(10, 18, 40));
  });

  it("una foto clara propone una página clara", () => {
    const p = paletaDePixeles(pixeles([{ rgb: [245, 238, 225], n: 950 }, { rgb: [40, 120, 200], n: 50 }]));
    const f = rgbAHsl(...hexARgb(p!.fondo));
    expect(f.l).toBeGreaterThan(0.85);
    expect(contraste(p!.acento, p!.fondo)).toBeGreaterThanOrEqual(2.5);
  });

  it("sin ningún color vivo, el acento sale del dominante con más saturación", () => {
    const p = paletaDePixeles(pixeles([{ rgb: [90, 90, 95], n: 1000 }]));
    expect(p).not.toBeNull();
    expect(p!.acento).toMatch(/^#[0-9a-f]{6}$/);
    expect(contraste(p!.acento, p!.fondo)).toBeGreaterThanOrEqual(2.5);
  });

  it("`paso` saltea píxeles sin cambiar el resultado de una imagen pareja", () => {
    const datos = pixeles([{ rgb: [30, 140, 90], n: 400 }]);
    expect(paletaDePixeles(datos, { paso: 4 })!.dominante).toBe(paletaDePixeles(datos)!.dominante);
  });
});

describe("aritmética de color", () => {
  it("hsl ⇄ hex van y vuelven", () => {
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#123456", "#fafafa", "#0a1226"]) {
      const [r, g, b] = hexARgb(hex);
      expect(hslAHex(rgbAHsl(r, g, b))).toBe(hex);
    }
  });

  it("luminancia y contraste (WCAG)", () => {
    expect(luminancia("#ffffff")).toBeCloseTo(1, 5);
    expect(luminancia("#000000")).toBe(0);
    expect(contraste("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contraste("#777777", "#777777")).toBe(1);
  });

  it("hexDe recorta y redondea", () => {
    expect(hexDe(300, -5, 12.6)).toBe("#ff000d");
  });
});

function hexARgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
