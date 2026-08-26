import { describe, expect, it } from "vitest";
import { calcularComision, formatearDolares, planGeneraComision } from "./comision";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA TABLA QUE EL DUEÑO APROBÓ, PALABRA POR PALABRA
 * ════════════════════════════════════════════════════════════════════
 *
 * Esto no es una prueba de una función: es el contrato de cuánto se le
 * paga a una persona real todos los meses. El 26 de agosto de 2026 el
 * dueño confirmó esta tabla textualmente («sí, así correcto, esa es la
 * comisión»), y estos números son ESA tabla.
 *
 * ⚠️ SI UNA DE ESTAS FALLA, NO SE ACTUALIZA EL NÚMERO. Se averigua qué
 * cambió y se habla con el dueño. Ajustar la prueba para que pase es
 * cambiarle la comisión a alguien sin decírselo.
 */

describe("la escala de Starter es la que aprobó el dueño", () => {
  // negocios → dólares. La tabla, tal cual se le mostró y aprobó.
  const APROBADA: [number, number][] = [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 6],
    [4, 7],
    [5, 8],
    [6, 12],
    [7, 13],
  ];

  for (const [negocios, esperado] of APROBADA) {
    it(`${negocios} negocios Starter pagan $${esperado}`, () => {
      expect(calcularComision({ starter: negocios, impulso: 0 }).total).toBe(esperado);
    });
  }

  it("el salto de $2 a $6 al llegar a 3 es intencional, no un redondeo", () => {
    // Es la razón de ser de toda la escala: premiar el trío completo.
    // Si alguien la "arregla" a algo lineal, le baja la comisión a todo
    // socio que tenga tríos completos.
    const dos = calcularComision({ starter: 2, impulso: 0 }).total;
    const tres = calcularComision({ starter: 3, impulso: 0 }).total;
    expect(tres - dos).toBe(4);
  });

  it("cada trío nuevo suma $6, no más ni menos", () => {
    for (let trios = 1; trios <= 10; trios++) {
      const n = trios * 3;
      expect(calcularComision({ starter: n, impulso: 0 }).total, `${n} negocios`).toBe(trios * 6);
    }
  });

  it("la comisión nunca baja al sumar un negocio", () => {
    // Una escala donde conseguir un cliente más te hace ganar MENOS
    // sería un incentivo invertido. Se comprueba en vez de suponerlo.
    let previa = -1;
    for (let n = 0; n <= 60; n++) {
      const hoy = calcularComision({ starter: n, impulso: 0 }).total;
      expect(hoy, `${n} negocios`).toBeGreaterThanOrEqual(previa);
      previa = hoy;
    }
  });
});

describe("el desglose explica de dónde sale cada dólar", () => {
  it("separa tríos de sueltos", () => {
    const d = calcularComision({ starter: 5, impulso: 0 });
    expect(d.triosStarter).toBe(1);
    expect(d.sueltosStarter).toBe(2);
    expect(d.montoTrios).toBe(6);
    expect(d.montoSueltos).toBe(2);
    expect(d.total).toBe(8);
  });

  it("dice cuántos faltan para el próximo trío", () => {
    // Para la pantalla: sin esto, quien tiene 5 ve «$8» y no sabe que
    // con UNO más pasa a $12. Un incentivo que no se ve no incentiva.
    expect(calcularComision({ starter: 4, impulso: 0 }).faltanParaElTrio).toBe(2);
    expect(calcularComision({ starter: 5, impulso: 0 }).faltanParaElTrio).toBe(1);
    // Con el trío justo, faltan 3 para el SIGUIENTE — no cero.
    expect(calcularComision({ starter: 6, impulso: 0 }).faltanParaElTrio).toBe(3);
  });
});

describe("Impulso paga por negocio", () => {
  it("cada uno suma $10", () => {
    expect(calcularComision({ starter: 0, impulso: 1 }).total).toBe(10);
    expect(calcularComision({ starter: 0, impulso: 4 }).total).toBe(40);
  });

  it("los dos planes se suman sin pisarse", () => {
    // El ejemplo que se le mostró al dueño: 3 Starter + 2 Impulso.
    const d = calcularComision({ starter: 3, impulso: 2 });
    expect(d.montoTrios).toBe(6);
    expect(d.montoImpulso).toBe(20);
    expect(d.total).toBe(26);
  });
});

describe("un dato roto no se convierte en plata rara", () => {
  it("los negativos y los decimales se tratan como cero o se truncan", () => {
    expect(calcularComision({ starter: -5, impulso: -2 }).total).toBe(0);
    // 3,9 negocios no existe: se cuentan los 3 que hay.
    expect(calcularComision({ starter: 3.9, impulso: 0 }).total).toBe(6);
  });

  it("un NaN no llega al total", () => {
    // Sale de un `count` de la base, y una consulta que falló puede
    // devolver null. Sin el filtro, el socio ve «$NaN» en su panel.
    const d = calcularComision({ starter: NaN, impulso: Number.POSITIVE_INFINITY });
    expect(Number.isFinite(d.total)).toBe(true);
    expect(d.total).toBe(0);
  });
});

describe("los planes que generan comisión", () => {
  it("son arranque (que se muestra «Starter») e impulso", () => {
    expect(planGeneraComision("arranque")).toBe(true);
    expect(planGeneraComision("impulso")).toBe(true);
  });

  it("«starter» NO es un plan: no existe con ese id", () => {
    // El dueño lo llama así y la UI lo muestra así, pero el id es
    // `arranque`. Confundirlos hace que la comisión se calcule sobre un
    // conjunto vacío y todos los socios cobren cero sin que falle nada.
    expect(planGeneraComision("starter")).toBe(false);
  });

  it("prueba e ilimitado no generan comisión hoy", () => {
    expect(planGeneraComision("prueba")).toBe(false);
    expect(planGeneraComision("ilimitado")).toBe(false);
    expect(planGeneraComision(null)).toBe(false);
    expect(planGeneraComision(undefined)).toBe(false);
  });
});

describe("el formato de la plata", () => {
  it("va sin decimales", () => {
    expect(formatearDolares(8)).toBe("$8");
    expect(formatearDolares(8.4)).toBe("$8");
    // Nada de «$8,00»: todos los montos de la escala son enteros y los
    // centavos en una tabla de comisiones solo agregan ruido.
    expect(formatearDolares(8)).not.toContain(",");
  });

  it("separa los miles como se escribe en Costa Rica", () => {
    // ⚠️ El separador de `es-CR` es un ESPACIO angosto (U+202F), no un
    // punto. Se compara contra el mismo `toLocaleString` en vez de
    // clavar el carácter: escrito a mano, un espacio normal pasaría
    // desapercibido en el archivo y rompería la prueba sin que se vea
    // por qué.
    expect(formatearDolares(1200)).toBe(`$${(1200).toLocaleString("es-CR")}`);
  });

  it("un valor roto no imprime «$NaN»", () => {
    expect(formatearDolares(NaN)).toBe("$0");
  });
});
