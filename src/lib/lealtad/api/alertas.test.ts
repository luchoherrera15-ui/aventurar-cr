import { describe, expect, it } from "vitest";
import { evaluarAnomalias, mediana, type SenalesDeUso } from "./alertas";

/**
 * Sin detección, todo lo demás es teoría. Estos casos son la
 * diferencia entre enterarse en horas y enterarse cuando el dueño se
 * queja.
 */

function senales(extra: Partial<SenalesDeUso> = {}): SenalesDeUso {
  return {
    llamadasHoy: 100,
    medianaPrevia: 100,
    ipsNuevas: 0,
    miembrosHoy: 40,
    medianaMiembros: 40,
    bloqueos429: 0,
    ...extra,
  };
}

describe("evaluarAnomalias", () => {
  it("un día normal no molesta a nadie", () => {
    expect(evaluarAnomalias(senales())).toEqual({ nivel: "ninguna", motivos: [] });
  });

  it("una IP nueva SIEMPRE avisa, aunque el volumen sea normal", () => {
    // Es la señal más barata y la que más veces va a acertar: el POS
    // de una barbería llama desde una o dos direcciones.
    const v = evaluarAnomalias(senales({ ipsNuevas: 1 }));
    expect(v.nivel).toBe("aviso");
    expect(v.motivos[0]).toContain("nunca se había usado");
  });

  it("tres veces la mediana avisa; diez veces apaga", () => {
    expect(evaluarAnomalias(senales({ llamadasHoy: 350 })).nivel).toBe("aviso");
    expect(evaluarAnomalias(senales({ llamadasHoy: 1200 })).nivel).toBe("suspender");
  });

  it("NO se dispara con volúmenes chicos: el primer día no es una anomalía", () => {
    // Pasar de 2 a 8 llamadas es cuadruplicar y no significa nada.
    expect(evaluarAnomalias(senales({ llamadasHoy: 8, medianaPrevia: 2 })).nivel).toBe("ninguna");
  });

  it("detecta el BARRIDO aunque el volumen total no cambie tanto", () => {
    // Mil llamadas a la misma tarjeta es un bug; mil llamadas a mil
    // tarjetas distintas es otra cosa.
    const v = evaluarAnomalias(senales({ miembrosHoy: 500, medianaMiembros: 40 }));
    expect(v.nivel).toBe("suspender");
    expect(v.motivos.join(" ")).toContain("barrido");
  });

  it("con pocas tarjetas de base tampoco se dispara", () => {
    expect(evaluarAnomalias(senales({ miembrosHoy: 15, medianaMiembros: 2 })).nivel).toBe("ninguna");
  });

  it("los 429 sostenidos avisan pero no apagan solos", () => {
    const v = evaluarAnomalias(senales({ bloqueos429: 80 }));
    expect(v.nivel).toBe("aviso");
    expect(v.motivos.join(" ")).toContain("empujando el techo");
  });

  it("acumula todos los motivos, no solo el primero", () => {
    const v = evaluarAnomalias(
      senales({ llamadasHoy: 400, ipsNuevas: 2, bloqueos429: 100 }),
    );
    expect(v.motivos.length).toBe(3);
  });

  it("basta UNA señal de nivel suspender para apagar, aunque las otras estén bien", () => {
    expect(evaluarAnomalias(senales({ llamadasHoy: 2000 })).nivel).toBe("suspender");
  });
});

describe("mediana", () => {
  it("con lista impar toma el del medio", () => {
    expect(mediana([1, 100, 3])).toBe(3);
  });

  it("con lista par promedia los dos del medio", () => {
    expect(mediana([1, 3, 5, 9])).toBe(4);
  });

  it("no se deja correr por un día raro — que es justo el que se busca", () => {
    expect(mediana([10, 10, 10, 10, 10000])).toBe(10);
  });

  it("sin datos devuelve 0, que con el piso de ruido significa «no comparar»", () => {
    expect(mediana([])).toBe(0);
  });

  it("no modifica el arreglo que recibe", () => {
    const original = [5, 1, 3];
    mediana(original);
    expect(original).toEqual([5, 1, 3]);
  });
});
