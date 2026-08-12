import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { dibujarIcono, dibujarLogo, dibujarTiraDeSellos } from "./imagenes";

/**
 * La tira de sellos es una IMAGEN generada, no un componente: Apple no
 * deja poner elementos donde uno quiera. Lo que se prueba acá es que
 * salga con las medidas que Apple espera y que los sellos no se
 * desborden — porque iOS recorta la tira en pantallas angostas y lo
 * que toca el borde es lo primero que se pierde.
 */

const COLORES = { fondo: "#2F4230", sello: "#D9E8C4" };

/**
 * Dónde empiezan y terminan los sellos dentro de la tira.
 *
 * Se detecta por DIFERENCIA CONTRA EL FONDO, no por brillo absoluto:
 * un sello apagado (26% de opacidad) queda a un pelo del color de
 * fondo, y cualquier umbral fijo se lo pierde o lo agarra por suerte.
 */
async function margenes(tira: Buffer) {
  const { data, info } = await sharp(tira).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // La esquina superior izquierda siempre es fondo: hay margen ahí.
  const [fr, fg, fb] = [data[0], data[1], data[2]];
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const dist =
        Math.abs(data[i] - fr) + Math.abs(data[i + 1] - fg) + Math.abs(data[i + 2] - fb);
      if (dist > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return {
    izq: x0,
    der: info.width - 1 - x1,
    arriba: y0,
    abajo: info.height - 1 - y1,
    ancho: info.width,
    alto: info.height,
  };
}

describe("dibujarTiraDeSellos", () => {
  it("respeta las medidas de Apple en cada escala", async () => {
    for (const [escala, ancho, alto] of [[1, 375, 123], [2, 750, 246], [3, 1125, 369]] as const) {
      const tira = await dibujarTiraDeSellos({
        total: 10, logrados: 5, colores: COLORES, imagen: null, escala,
      });
      const m = await sharp(tira).metadata();
      expect([m.width, m.height]).toEqual([ancho, alto]);
    }
  });

  it("los sellos no llegan al borde", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, escala: 2,
    });
    const m = await margenes(tira);
    // Al menos un 5% de aire a cada lado: es lo que salva a los sellos
    // de las puntas cuando iOS recorta.
    expect(m.izq).toBeGreaterThan(m.ancho * 0.05);
    expect(m.der).toBeGreaterThan(m.ancho * 0.05);
    expect(m.arriba).toBeGreaterThan(m.alto * 0.05);
    expect(m.abajo).toBeGreaterThan(m.alto * 0.05);
  });

  it("queda centrada: el aire de un lado es igual al del otro", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, escala: 2,
    });
    const m = await margenes(tira);
    expect(Math.abs(m.izq - m.der)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.arriba - m.abajo)).toBeLessThanOrEqual(2);
  });

  it("con seis o menos usa una sola fila", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 6, logrados: 3, colores: COLORES, imagen: null, escala: 2,
    });
    const m = await margenes(tira);
    // Una fila de círculos es más ancha que alta.
    expect(m.alto - m.arriba - m.abajo).toBeLessThan(m.ancho - m.izq - m.der);
  });

  it("ninguno encendido y todos encendidos siguen siendo válidos", async () => {
    for (const logrados of [0, 10]) {
      const tira = await dibujarTiraDeSellos({
        total: 10, logrados, colores: COLORES, imagen: null, escala: 2,
      });
      const m = await sharp(tira).metadata();
      expect(m.width).toBe(750);
    }
  });

  it("una tarjeta de un solo sello no se rompe", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 1, logrados: 0, colores: COLORES, imagen: null, escala: 2,
    });
    expect((await sharp(tira).metadata()).width).toBe(750);
  });

  it("con muchos sellos siguen entrando sin desbordarse", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 30, logrados: 12, colores: COLORES, imagen: null, escala: 2,
    });
    const m = await margenes(tira);
    expect(m.izq).toBeGreaterThan(0);
    expect(m.der).toBeGreaterThan(0);
  });
});

describe("dibujarLogo", () => {
  it("escribe el nombre del negocio cuando no hay logo subido", async () => {
    const logo = await dibujarLogo({ nombre: "Pura Matcha", imagen: null, ancho: 320, alto: 100 });
    const m = await sharp(logo).metadata();
    expect([m.width, m.height]).toEqual([320, 100]);
    // Tiene que haber tinta: un lienzo vacío sería un logo invisible.
    const { data } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let opacos = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 20) opacos++;
    expect(opacos).toBeGreaterThan(100);
  });
});

describe("dibujarIcono", () => {
  it("sale cuadrado en los tres tamaños que pide Apple", async () => {
    for (const lado of [29, 58, 87]) {
      const m = await sharp(await dibujarIcono(lado)).metadata();
      expect([m.width, m.height]).toEqual([lado, lado]);
    }
  });
});
