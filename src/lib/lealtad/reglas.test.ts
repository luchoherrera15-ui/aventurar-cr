import { describe, expect, it } from "vitest";
import {
  calcularAcumulacion,
  estadoDelPrograma,
  puedeActivarse,
  programaOpera,
  transicionValida,
  type ReglasAcumulacion,
} from "./reglas";

/**
 * Estos tests son el CONTRATO entre el panel y el RPC: los dos
 * implementan las mismas fórmulas, y si alguno se aparta, lo que el
 * panel promete y lo que la base otorga dejan de coincidir.
 */

function reglas(extra: Partial<ReglasAcumulacion> = {}): ReglasAcumulacion {
  return {
    puntosPorVisita: 0,
    puntosPorColon: 0.001, // 1 punto por cada ₡1.000
    compraMinima: null,
    maxPorTransaccion: null,
    maxDiarioCliente: null,
    ...extra,
  };
}

describe("calcularAcumulacion — la fórmula", () => {
  it("1 punto por cada ₡1.000, redondeando SIEMPRE hacia abajo", () => {
    expect(calcularAcumulacion(reglas(), 1000)).toMatchObject({ otorga: true, puntos: 1 });
    expect(calcularAcumulacion(reglas(), 5000)).toMatchObject({ otorga: true, puntos: 5 });
    // ₡1.999 NO son 2 puntos: el redondeo nunca regala.
    expect(calcularAcumulacion(reglas(), 1999)).toMatchObject({ otorga: true, puntos: 1 });
    expect(calcularAcumulacion(reglas(), 999)).toMatchObject({ otorga: false });
  });

  it("evita el clásico de flotantes: la tasa se multiplica por enteros", () => {
    // 0.29 × 100 = 28.999999999999996 en IEEE-754: un floor ingenuo da
    // 28 y le roba un punto al cliente. La implementación multiplica
    // micro-puntos enteros justamente para que esto dé 29.
    expect(calcularAcumulacion(reglas({ puntosPorColon: 0.29 }), 100)).toMatchObject({
      puntos: 29,
    });
    expect(calcularAcumulacion(reglas({ puntosPorColon: 0.05 }), 8200)).toMatchObject({
      puntos: 410,
    });
    // Y el floor sigue siendo floor: 0.29 × 99 = 28.71 → 28.
    expect(calcularAcumulacion(reglas({ puntosPorColon: 0.29 }), 99)).toMatchObject({
      puntos: 28,
    });
  });

  it("sellos por visita: sin monto, un sello", () => {
    const sellos = reglas({ puntosPorVisita: 1, puntosPorColon: 0 });
    expect(calcularAcumulacion(sellos, null)).toMatchObject({ otorga: true, puntos: 1 });
  });

  it("se pueden combinar visita + colones, como en la 0060", () => {
    const mixto = reglas({ puntosPorVisita: 2, puntosPorColon: 0.001 });
    expect(calcularAcumulacion(mixto, 3500)).toMatchObject({ puntos: 5 }); // 2 + 3
  });

  it("rechaza montos con decimales o negativos: colones enteros", () => {
    expect(calcularAcumulacion(reglas(), 10.5)).toMatchObject({ otorga: false });
    expect(calcularAcumulacion(reglas(), -100)).toMatchObject({ otorga: false });
  });
});

describe("calcularAcumulacion — compra mínima", () => {
  const conMinimo = reglas({ compraMinima: 2000 });

  it("por debajo del mínimo no otorga, y dice cuánto es", () => {
    const r = calcularAcumulacion(conMinimo, 1500);
    expect(r.otorga).toBe(false);
    // El separador de miles de es-CR varía entre versiones de ICU
    // (punto o espacio fino): se comparan solo los dígitos.
    if (!r.otorga) expect(r.motivo.replace(/\D/g, "")).toContain("2000");
  });

  it("el mínimo exacto sí acumula", () => {
    expect(calcularAcumulacion(conMinimo, 2000)).toMatchObject({ otorga: true, puntos: 2 });
  });

  it("una visita SIN monto no choca contra la compra mínima", () => {
    // La tarjeta de sellos pura no pregunta cuánto se gastó; exigirle
    // un mínimo que nadie digita bloquearía todos los sellos.
    const sellosConMinimo = reglas({
      puntosPorVisita: 1,
      puntosPorColon: 0,
      compraMinima: 2000,
    });
    expect(calcularAcumulacion(sellosConMinimo, null)).toMatchObject({ otorga: true, puntos: 1 });
  });
});

describe("calcularAcumulacion — topes", () => {
  it("recorta al tope por transacción y lo dice", () => {
    const r = calcularAcumulacion(reglas({ maxPorTransaccion: 3 }), 9000);
    expect(r).toMatchObject({ otorga: true, puntos: 3, recortadoPor: "transaccion" });
  });

  it("recorta al espacio que queda del tope diario", () => {
    const r = calcularAcumulacion(reglas({ maxDiarioCliente: 10 }), 8000, 7);
    expect(r).toMatchObject({ otorga: true, puntos: 3, recortadoPor: "dia" });
  });

  it("con el tope diario lleno no otorga nada", () => {
    const r = calcularAcumulacion(reglas({ maxDiarioCliente: 10 }), 5000, 10);
    expect(r.otorga).toBe(false);
  });

  it("el tope diario manda sobre el de transacción", () => {
    const r = calcularAcumulacion(
      reglas({ maxPorTransaccion: 5, maxDiarioCliente: 4 }),
      50000,
      2,
    );
    expect(r).toMatchObject({ puntos: 2, recortadoPor: "dia" });
  });
});

describe("estadoDelPrograma — compatibilidad con el booleano viejo", () => {
  it("sin columna estado, deriva del activo de la 0060", () => {
    expect(estadoDelPrograma({ estado: null, activo: true })).toBe("activo");
    expect(estadoDelPrograma({ estado: null, activo: false })).toBe("pausado");
    expect(estadoDelPrograma({ activo: true })).toBe("activo");
  });

  it("la columna nueva manda cuando existe", () => {
    expect(estadoDelPrograma({ estado: "borrador", activo: true })).toBe("borrador");
    expect(estadoDelPrograma({ estado: "archivado", activo: true })).toBe("archivado");
  });

  it("solo el activo opera; el pausado conserva pero no acumula", () => {
    expect(programaOpera({ estado: "activo", activo: false })).toBe(true);
    expect(programaOpera({ estado: "pausado", activo: true })).toBe(false);
    expect(programaOpera({ estado: "borrador", activo: true })).toBe(false);
  });
});

describe("puedeActivarse — la validación antes de activar", () => {
  it("sin reglas que otorguen algo, no", () => {
    const r = puedeActivarse({ puntos_por_visita: 0, puntos_por_colon: 0, recompensasActivas: 2 });
    expect(r.puede).toBe(false);
  });

  it("sin recompensa activa, no: sería una tarjeta que no promete nada", () => {
    const r = puedeActivarse({ puntos_por_visita: 1, puntos_por_colon: 0, recompensasActivas: 0 });
    expect(r.puede).toBe(false);
  });

  it("con reglas y recompensa, sí", () => {
    expect(
      puedeActivarse({ puntos_por_visita: 1, puntos_por_colon: 0, recompensasActivas: 1 }),
    ).toEqual({ puede: true });
  });
});

describe("transicionValida — el ciclo de vida", () => {
  it("activo y pausado van y vienen", () => {
    expect(transicionValida("activo", "pausado", true)).toBe(true);
    expect(transicionValida("pausado", "activo", true)).toBe(true);
  });

  it("archivar se puede desde cualquier estado", () => {
    expect(transicionValida("activo", "archivado", true)).toBe(true);
    expect(transicionValida("borrador", "archivado", false)).toBe(true);
  });

  it("con historial, archivado es para siempre", () => {
    expect(transicionValida("archivado", "activo", true)).toBe(false);
    expect(transicionValida("archivado", "borrador", true)).toBe(false);
    // Sin movimientos sí se puede desarchivar a borrador.
    expect(transicionValida("archivado", "borrador", false)).toBe(true);
  });

  it("no se vuelve a borrador con movimientos encima", () => {
    expect(transicionValida("pausado", "borrador", true)).toBe(false);
    expect(transicionValida("pausado", "borrador", false)).toBe(true);
  });
});
