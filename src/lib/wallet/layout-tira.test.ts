import { describe, expect, it } from "vitest";
import {
  CONFIG_CLASICA,
  TIRA_ALTO,
  TIRA_ANCHO,
  configDesdeJson,
  layoutDeLaTira,
  type ConfigTira,
} from "./layout-tira";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA RED QUE PROTEGE A LAS TARJETAS YA EMITIDAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Este módulo salió de `imagenes.ts`, donde el layout estaba escrito a
 * mano. Hay miles de pases ya instalados en teléfonos ajenos, y todos
 * se vuelven a dibujar con ESTE código la próxima vez que su dueño
 * gane un sello.
 *
 * Si el refactor movió un píxel, la tarjeta de alguien cambia de
 * aspecto sin que nadie lo haya pedido. El primer bloque de tests es
 * el algoritmo VIEJO reimplementado a mano, comparado contra el nuevo.
 */

/**
 * El cálculo tal cual estaba en `imagenes.ts` antes del refactor,
 * copiado literal de ese archivo. Es el testigo: si el nuevo se
 * desvía, esto lo delata.
 */
function layoutViejo(total: number, ancho: number, alto: number) {
  const filas = total > 6 ? 2 : 1;
  const porFila = Math.ceil(total / filas);

  const margenX = ancho * 0.07;
  const margenY = alto * 0.07;
  const utilX = ancho - margenX * 2;
  const utilY = alto - margenY * 2;

  const diametro = Math.max(
    8,
    Math.round(Math.min((utilX / porFila) * 0.88, (utilY / filas) * 0.9)),
  );
  const pasoX = utilX / porFila;
  const pasoY = utilY / filas;

  const posiciones: { x: number; y: number }[] = [];
  for (let i = 0; i < total; i++) {
    const fila = Math.floor(i / porFila);
    const col = i % porFila;
    posiciones.push({
      x: Math.round(margenX + pasoX * col + (pasoX - diametro) / 2),
      y: Math.round(margenY + pasoY * fila + (pasoY - diametro) / 2),
    });
  }
  return { diametro, filas, porFila, posiciones };
}

describe("con la configuración clásica, NADA se movió", () => {
  // Las metas que existen de verdad en el producto, y los tres tamaños
  // que pide Apple.
  const METAS = [1, 3, 5, 6, 7, 8, 10, 12, 15, 20, 30];
  const ESCALAS = [1, 2, 3];

  for (const escala of ESCALAS) {
    for (const total of METAS) {
      it(`${total} sellos a ${escala}× cae en el mismo lugar que antes`, () => {
        const viejo = layoutViejo(total, TIRA_ANCHO * escala, TIRA_ALTO * escala);
        const nuevo = layoutDeLaTira(
          total,
          CONFIG_CLASICA,
          TIRA_ANCHO * escala,
          TIRA_ALTO * escala,
        );

        expect(nuevo.diametro, "el diámetro cambió").toBe(viejo.diametro);
        expect(nuevo.filas).toBe(viejo.filas);
        expect(nuevo.porFila).toBe(viejo.porFila);
        expect(nuevo.posiciones, "alguna posición se movió").toEqual(viejo.posiciones);
      });
    }
  }
});

describe("los sellos entran en la tira", () => {
  const config = (extra: Partial<ConfigTira>): ConfigTira => ({
    ...CONFIG_CLASICA,
    ...extra,
  });

  it("ningún sello se sale por la derecha ni por abajo", () => {
    // El caso que rompe una tarjeta sin que se note hasta que llega al
    // teléfono: un sello dibujado fuera del lienzo.
    for (const total of [1, 6, 7, 10, 20, 30]) {
      for (const escalaSello of [0.5, 1, 1.5, 3]) {
        const l = layoutDeLaTira(total, config({ escalaSello }));
        for (const p of l.posiciones) {
          expect(p.x + l.diametro, `total ${total}, escala ${escalaSello}`).toBeLessThanOrEqual(
            l.ancho,
          );
          expect(p.y + l.diametro, `total ${total}, escala ${escalaSello}`).toBeLessThanOrEqual(
            l.alto,
          );
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("una escala enorme no hace que los sellos se pisen", () => {
    // Sin tope, `escalaSello: 10` daría círculos más anchos que su
    // celda y la fila se convertiría en una mancha.
    const l = layoutDeLaTira(10, config({ escalaSello: 10 }));
    const separacion = l.posiciones[1].x - l.posiciones[0].x;
    expect(l.diametro).toBeLessThanOrEqual(separacion);
  });
});

describe("las opciones hacen lo que dicen", () => {
  const config = (extra: Partial<ConfigTira>): ConfigTira => ({
    ...CONFIG_CLASICA,
    ...extra,
  });

  it("«arriba» deja los sellos más arriba que «abajo»", () => {
    const arriba = layoutDeLaTira(5, config({ alineacionV: "arriba" }));
    const abajo = layoutDeLaTira(5, config({ alineacionV: "abajo" }));
    expect(arriba.posiciones[0].y).toBeLessThan(abajo.posiciones[0].y);
  });

  it("«izquierda» deja el primer sello más a la izquierda que «derecha»", () => {
    const izq = layoutDeLaTira(5, config({ alineacionH: "izquierda" }));
    const der = layoutDeLaTira(5, config({ alineacionH: "derecha" }));
    expect(izq.posiciones[0].x).toBeLessThan(der.posiciones[0].x);
  });

  it("dos filas forzadas reparten en dos, aunque quepan en una", () => {
    const una = layoutDeLaTira(5, config({ filas: 1 }));
    const dos = layoutDeLaTira(5, config({ filas: 2 }));
    expect(una.filas).toBe(1);
    expect(dos.filas).toBe(2);
    // Con dos filas los sellos NO comparten la misma `y`.
    expect(new Set(dos.posiciones.map((p) => p.y)).size).toBe(2);
  });

  it("más escala, sellos más grandes", () => {
    const chico = layoutDeLaTira(5, config({ escalaSello: 0.6 }));
    const grande = layoutDeLaTira(5, config({ escalaSello: 1 }));
    expect(chico.diametro).toBeLessThan(grande.diametro);
  });
});

describe("los datos rotos no tumban el dibujo", () => {
  it("cero sellos devuelve una tira vacía en vez de dividir por cero", () => {
    const l = layoutDeLaTira(0);
    expect(l.posiciones).toEqual([]);
    expect(Number.isFinite(l.diametro)).toBe(true);
  });

  it("un total negativo se trata como cero", () => {
    expect(layoutDeLaTira(-5).posiciones).toEqual([]);
  });

  it("un total con decimales se redondea hacia abajo", () => {
    expect(layoutDeLaTira(5.9).posiciones).toHaveLength(5);
  });

  it("el diámetro nunca baja del mínimo legible", () => {
    // 30 sellos en una sola fila es el peor caso de apretado.
    const l = layoutDeLaTira(30, { ...CONFIG_CLASICA, filas: 1 });
    expect(l.diametro).toBeGreaterThanOrEqual(8);
  });
});

describe("lo que viene de la base se sanea antes de dibujar", () => {
  it("un objeto vacío es el layout clásico", () => {
    expect(configDesdeJson({})).toEqual(CONFIG_CLASICA);
  });

  it("null, un arreglo o un texto caen al clásico", () => {
    expect(configDesdeJson(null)).toEqual(CONFIG_CLASICA);
    expect(configDesdeJson([1, 2])).toEqual(CONFIG_CLASICA);
    expect(configDesdeJson("filas: 2")).toEqual(CONFIG_CLASICA);
    expect(configDesdeJson(undefined)).toEqual(CONFIG_CLASICA);
  });

  it("un campo roto degrada SOLO ese campo", () => {
    const c = configDesdeJson({ alineacionV: "abajo", filas: "muchas" });
    expect(c.alineacionV).toBe("abajo");
    expect(c.filas).toBe(CONFIG_CLASICA.filas);
  });

  it("NaN e Infinity no llegan a la aritmética", () => {
    // Un NaN en la escala produce un diámetro NaN y un PNG en blanco,
    // que Apple rechaza sin decir por qué.
    //
    // NaN e Infinity NO se recortan, caen al clásico: JSON no puede
    // representarlos, así que un valor así no es «alguien pidió mucho»
    // sino un dato corrupto, y adivinarle una intención sería inventar.
    expect(configDesdeJson({ escalaSello: NaN }).escalaSello).toBe(CONFIG_CLASICA.escalaSello);
    expect(configDesdeJson({ escalaSello: Infinity }).escalaSello).toBe(CONFIG_CLASICA.escalaSello);
    expect(configDesdeJson({ margenY: NaN }).margenY).toBe(CONFIG_CLASICA.margenY);
  });

  it("los valores fuera de rango se recortan, no se descartan", () => {
    // Alguien que guardó 5 quería sellos grandes: se le da el máximo,
    // no el default.
    expect(configDesdeJson({ escalaSello: 5 }).escalaSello).toBe(2);
    expect(configDesdeJson({ escalaSello: 0.01 }).escalaSello).toBe(0.4);
    expect(configDesdeJson({ margenY: 0.9 }).margenY).toBe(0.25);
    expect(configDesdeJson({ margenY: -1 }).margenY).toBe(0);
  });

  it("cualquier basura guardada sigue produciendo una tira dibujable", () => {
    const basura = [
      { filas: null, escalaSello: "grande", alineacionH: 7 },
      { escalaSello: -99, margenY: "mucho" },
      { alineacionV: {}, filas: [] },
    ];
    for (const b of basura) {
      const l = layoutDeLaTira(10, configDesdeJson(b));
      expect(Number.isFinite(l.diametro)).toBe(true);
      expect(l.diametro).toBeGreaterThan(0);
      for (const p of l.posiciones) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(p.x + l.diametro).toBeLessThanOrEqual(l.ancho);
        expect(p.y + l.diametro).toBeLessThanOrEqual(l.alto);
      }
    }
  });
});
