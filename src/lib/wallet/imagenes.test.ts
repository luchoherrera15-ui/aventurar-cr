import { describe, expect, it } from "vitest";
import sharp, { type OverlayOptions } from "sharp";
import { dibujarBanda, dibujarIcono, dibujarLogo, dibujarTiraDeSellos } from "./imagenes";
import { ICONOS_SELLO_ID } from "@/lib/lealtad/iconos-sello";

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
        total: 10, logrados: 5, colores: COLORES, imagen: null, banda: null, escala,
      });
      const m = await sharp(tira).metadata();
      expect([m.width, m.height]).toEqual([ancho, alto]);
    }
  });

  it("los sellos no llegan al borde", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, banda: null, escala: 2,
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
      total: 10, logrados: 5, colores: COLORES, imagen: null, banda: null, escala: 2,
    });
    const m = await margenes(tira);
    expect(Math.abs(m.izq - m.der)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.arriba - m.abajo)).toBeLessThanOrEqual(2);
  });

  it("con seis o menos usa una sola fila", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 6, logrados: 3, colores: COLORES, imagen: null, banda: null, escala: 2,
    });
    const m = await margenes(tira);
    // Una fila de círculos es más ancha que alta.
    expect(m.alto - m.arriba - m.abajo).toBeLessThan(m.ancho - m.izq - m.der);
  });

  it("ninguno encendido y todos encendidos siguen siendo válidos", async () => {
    for (const logrados of [0, 10]) {
      const tira = await dibujarTiraDeSellos({
        total: 10, logrados, colores: COLORES, imagen: null, banda: null, escala: 2,
      });
      const m = await sharp(tira).metadata();
      expect(m.width).toBe(750);
    }
  });

  it("una tarjeta de un solo sello no se rompe", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 1, logrados: 0, colores: COLORES, imagen: null, banda: null, escala: 2,
    });
    expect((await sharp(tira).metadata()).width).toBe(750);
  });

  it("con muchos sellos siguen entrando sin desbordarse", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 30, logrados: 12, colores: COLORES, imagen: null, banda: null, escala: 2,
    });
    const m = await margenes(tira);
    expect(m.izq).toBeGreaterThan(0);
    expect(m.der).toBeGreaterThan(0);
  });
});

/**
 * Una foto de mentira: franjas horizontales de colores planos. Sirve
 * para saber QUÉ PEDAZO de la imagen sobrevivió al recorte, que es lo
 * único que distingue un «cover» de un estirón.
 */
async function foto(ancho: number, alto: number, franjas: [string, number][]): Promise<Buffer> {
  const capas: OverlayOptions[] = [];
  let y = 0;
  for (const [color, altoFranja] of franjas) {
    capas.push({
      input: { create: { width: ancho, height: altoFranja, channels: 4, background: color } },
      left: 0,
      top: y,
    });
    y += altoFranja;
  }
  return sharp({ create: { width: ancho, height: alto, channels: 4, background: "#000000" } })
    .composite(capas)
    .png()
    .toBuffer();
}

async function pixel(imagen: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data, info } = await sharp(imagen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

/** Cuántos píxeles son de ESE color, con tolerancia. */
async function cuantosDe(imagen: Buffer, [r, g, b]: [number, number, number]): Promise<number> {
  const { data } = await sharp(imagen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (
      Math.abs(data[i] - r) < 12 &&
      Math.abs(data[i + 1] - g) < 12 &&
      Math.abs(data[i + 2] - b) < 12
    ) {
      n++;
    }
  }
  return n;
}

const SELLO_RGB: [number, number, number] = [217, 232, 196]; // #D9E8C4

describe("dibujarBanda", () => {
  it("respeta las medidas de Apple en cada escala", async () => {
    const imagen = await foto(800, 800, [["#3366cc", 800]]);
    for (const [escala, ancho, alto] of [[1, 375, 123], [2, 750, 246], [3, 1125, 369]] as const) {
      const m = await sharp(await dibujarBanda({ imagen, escala })).metadata();
      expect([m.width, m.height]).toEqual([ancho, alto]);
    }
  });

  it("recorta la foto en vez de estirarla", async () => {
    // Una foto ALTA (200×1200) con el centro azul y las puntas verdes.
    // Recortada a lo ancho, solo sobrevive el centro; estirada, el
    // verde de arriba y abajo entraría igual y la marca saldría
    // aplastada. Por eso se mira el color, no las medidas.
    const alta = await foto(200, 1200, [["#22aa44", 500], ["#3366cc", 200], ["#22aa44", 500]]);
    const banda = await dibujarBanda({ imagen: alta, escala: 1 });
    expect(await cuantosDe(banda, [34, 170, 68])).toBe(0);
    expect(await cuantosDe(banda, [51, 102, 204])).toBe(375 * 123);
  });

  it("toma el centro y no una esquina", async () => {
    // Ancha (1200×200): se recorta a los lados, y lo que queda es la
    // franja del medio — no el principio de la foto.
    const ancha = await sharp(await foto(200, 1200, [["#22aa44", 500], ["#3366cc", 200], ["#22aa44", 500]]))
      .rotate(90)
      .png()
      .toBuffer();
    const banda = await dibujarBanda({ imagen: ancha, escala: 1 });
    expect(await cuantosDe(banda, [51, 102, 204])).toBeGreaterThan(0);
  });
});

describe("dibujarTiraDeSellos con la banda del negocio", () => {
  // Blanco puro: sobre este fondo un sello apagado desaparece si no hay
  // velo, que es justo lo que el velo existe para evitar.
  const blanca = () => foto(900, 300, [["#ffffff", 300]]);

  it("la foto se ve, el color plano ya no", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, banda: await blanca(), escala: 2,
    });
    const [r, g, b] = await pixel(tira, 2, 2);
    // Ni el verde del negocio (47,66,48) ni el blanco pelado: es la
    // foto con el velo encima.
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(230);
    expect(Math.abs(r - g) + Math.abs(g - b)).toBeLessThan(12);
  });

  it("los sellos siguen ahí: la foto no se los come", async () => {
    const banda = await blanca();
    const conFoto = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, banda, escala: 2,
    });
    const sinFoto = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, banda: null, escala: 2,
    });
    const encendidos = await cuantosDe(sinFoto, SELLO_RGB);
    expect(encendidos).toBeGreaterThan(1000);
    // Los mismos cinco sellos encendidos, con foto o sin ella.
    expect(await cuantosDe(conFoto, SELLO_RGB)).toBeGreaterThan(encendidos * 0.95);
  });

  it("sigue midiendo lo que Apple espera en las tres escalas", async () => {
    const banda = await blanca();
    for (const [escala, ancho, alto] of [[1, 375, 123], [2, 750, 246], [3, 1125, 369]] as const) {
      const tira = await dibujarTiraDeSellos({
        total: 8, logrados: 3, colores: COLORES, imagen: null, banda, escala,
      });
      const m = await sharp(tira).metadata();
      expect([m.width, m.height]).toEqual([ancho, alto]);
    }
  });
});

describe("dibujarTiraDeSellos con un icono elegido (0145)", () => {
  /**
   * El icono reemplaza al LOGO dentro del sello. Lo que se comprueba
   * acá es lo que se ve en el teléfono: que el ganado esté LLENO, que el
   * que falta esté en CONTORNO, y —sobre todo— que el negocio que no
   * eligió icono siga recibiendo exactamente la misma imagen de antes.
   */
  it("sin icono, la tira es byte por byte la de siempre", async () => {
    // El parámetro es opcional: esta es la garantía de que agregarlo no
    // le movió un pixel a nadie. Si algún día el dibujo cambia, este
    // test se pone rojo antes que un cliente.
    const comun = { total: 10, logrados: 5, colores: COLORES, imagen: null, banda: null } as const;
    const sinParametro = await dibujarTiraDeSellos({ ...comun, escala: 2 });
    const conNull = await dibujarTiraDeSellos({ ...comun, escala: 2, icono: null });
    expect(conNull.equals(sinParametro)).toBe(true);
  });

  it("sigue midiendo lo que Apple espera en las tres escalas", async () => {
    for (const [escala, ancho, alto] of [[1, 375, 123], [2, 750, 246], [3, 1125, 369]] as const) {
      const tira = await dibujarTiraDeSellos({
        total: 10, logrados: 5, colores: COLORES, imagen: null, banda: null, escala, icono: "cafe",
      });
      const m = await sharp(tira).metadata();
      expect([m.width, m.height]).toEqual([ancho, alto]);
    }
  });

  it("los sellos tampoco llegan al borde", async () => {
    const tira = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, banda: null, escala: 2, icono: "tijera",
    });
    const m = await margenes(tira);
    expect(m.izq).toBeGreaterThan(m.ancho * 0.05);
    expect(m.der).toBeGreaterThan(m.ancho * 0.05);
    expect(m.arriba).toBeGreaterThan(m.alto * 0.05);
    expect(m.abajo).toBeGreaterThan(m.alto * 0.05);
  });

  it("el ganado es un disco LLENO y el que falta es un aro: se distinguen sin contar", async () => {
    const conTodos = await dibujarTiraDeSellos({
      total: 10, logrados: 10, colores: COLORES, imagen: null, banda: null, escala: 2, icono: "cafe",
    });
    const conNinguno = await dibujarTiraDeSellos({
      total: 10, logrados: 0, colores: COLORES, imagen: null, banda: null, escala: 2, icono: "cafe",
    });
    const llenos = await cuantosDe(conTodos, SELLO_RGB);
    const vacios = await cuantosDe(conNinguno, SELLO_RGB);
    // Los dos pintan con el color del acento —el aro también— pero un
    // disco macizo tiene MUCHO más de ese color que un contorno. Si
    // alguien cambiara el vacío por un disco tenue, esto se cae.
    expect(llenos).toBeGreaterThan(2000);
    expect(vacios).toBeGreaterThan(200);
    expect(vacios).toBeLessThan(llenos * 0.5);
  });

  it("la mitad llenos queda entre los dos extremos", async () => {
    const mitad = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, banda: null, escala: 2, icono: "cafe",
    });
    const todos = await dibujarTiraDeSellos({
      total: 10, logrados: 10, colores: COLORES, imagen: null, banda: null, escala: 2, icono: "cafe",
    });
    const ninguno = await dibujarTiraDeSellos({
      total: 10, logrados: 0, colores: COLORES, imagen: null, banda: null, escala: 2, icono: "cafe",
    });
    const n = await cuantosDe(mitad, SELLO_RGB);
    expect(n).toBeGreaterThan(await cuantosDe(ninguno, SELLO_RGB));
    expect(n).toBeLessThan(await cuantosDe(todos, SELLO_RGB));
  });

  it("el icono MANDA sobre el logo: con los dos, el sello es el icono", async () => {
    // El logo blanco sobre blanco es justo el que revienta a sharp
    // (`trim()` dice «Image is entirely blank»). Con icono ni se toca.
    const logoBlanco = await foto(300, 300, [["#ffffff", 300]]);
    const conIcono = await dibujarTiraDeSellos({
      total: 8, logrados: 4, colores: COLORES, imagen: logoBlanco, banda: null, escala: 2, icono: "flor",
    });
    const soloIcono = await dibujarTiraDeSellos({
      total: 8, logrados: 4, colores: COLORES, imagen: null, banda: null, escala: 2, icono: "flor",
    });
    expect(conIcono.equals(soloIcono)).toBe(true);
  });

  it("los doce se dibujan sin romperse, encendidos y apagados", async () => {
    for (const icono of ICONOS_SELLO_ID) {
      const tira = await dibujarTiraDeSellos({
        total: 4, logrados: 2, colores: COLORES, imagen: null, banda: null, escala: 1, icono,
      });
      const m = await sharp(tira).metadata();
      expect([m.width, m.height]).toEqual([375, 123]);
    }
  });

  it("sobre la foto del negocio se siguen viendo", async () => {
    const blanca = await foto(900, 300, [["#ffffff", 300]]);
    const tira = await dibujarTiraDeSellos({
      total: 10, logrados: 5, colores: COLORES, imagen: null, banda: blanca, escala: 2, icono: "cafe",
    });
    // El velo va abajo y los sellos encima: el acento tiene que
    // sobrevivir a la foto clara.
    expect(await cuantosDe(tira, SELLO_RGB)).toBeGreaterThan(500);
  });

  it("un color roto no se cuela dentro del SVG del sello", async () => {
    // El color del acento sale de una columna de texto y acá se
    // concatena en MARKUP. Con una comilla adentro el SVG quedaría mal
    // formado y el pase entero se caería; se usa el color de respaldo y
    // la tira sale igual.
    const tira = await dibujarTiraDeSellos({
      total: 6,
      logrados: 3,
      colores: { fondo: "#2F4230", sello: '#D9E8C4"/><script/>' },
      imagen: null,
      banda: null,
      escala: 1,
      icono: "cafe",
    });
    expect((await sharp(tira).metadata()).width).toBe(375);
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
