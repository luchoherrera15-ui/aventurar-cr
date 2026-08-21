import { describe, expect, it } from "vitest";
import { diasEntre, esRescatable, RITMOS, tramoDelCliente } from "./ciclo-cliente";

/**
 * Las reglas que deciden a quién se le manda un mensaje de "volvé".
 * Se prueban con fechas fijas — el módulo no mira el reloj a propósito.
 */
describe("diasEntre", () => {
  it("cuenta días enteros por UTC", () => {
    expect(diasEntre("2026-08-01", "2026-08-20")).toBe(19);
    expect(diasEntre("2026-08-20", "2026-08-20")).toBe(0);
  });
  it("cruza meses y años sin aritmética de texto", () => {
    expect(diasEntre("2026-12-28", "2027-01-03")).toBe(6);
    expect(diasEntre("2024-02-28", "2024-03-01")).toBe(2); // bisiesto
  });
  it("una fecha rota devuelve null, no NaN", () => {
    expect(diasEntre("no-es-fecha", "2026-08-20")).toBeNull();
  });
});

describe("tramoDelCliente", () => {
  const HOY = "2026-08-20";

  it("sin ninguna visita es «nuevo», sin importar cuándo se afilió", () => {
    // Nunca arrancó ≠ se fue. Son problemas distintos y se arreglan
    // distinto: uno en el mostrador, el otro con un mensaje.
    expect(tramoDelCliente(null, HOY, "semanal")).toEqual({ tramo: "nuevo", dias: null });
  });

  it("cafetería (diario): a los 6 días sigue activo, a los 7 ya está en riesgo", () => {
    expect(tramoDelCliente("2026-08-14", HOY, "diario").tramo).toBe("activo");
    expect(tramoDelCliente("2026-08-13", HOY, "diario").tramo).toBe("en_riesgo");
  });

  it("casillero (mensual): 45 días sin venir sigue siendo normal", () => {
    // El mismo ausente que en una cafetería sería «dormido» acá está
    // dentro del ritmo. El umbral por negocio ES la funcionalidad.
    expect(tramoDelCliente("2026-07-06", HOY, "mensual").tramo).toBe("activo");
    expect(tramoDelCliente("2026-07-06", HOY, "diario").tramo).toBe("dormido");
  });

  it("los cuatro tramos en orden, con el ritmo semanal", () => {
    const u = RITMOS.semanal; // 21 / 45 / 120
    expect(tramoDelCliente("2026-08-10", HOY, "semanal").tramo).toBe("activo"); // 10 días
    expect(tramoDelCliente("2026-07-20", HOY, "semanal").tramo).toBe("en_riesgo"); // 31
    expect(tramoDelCliente("2026-06-20", HOY, "semanal").tramo).toBe("dormido"); // 61
    expect(tramoDelCliente("2026-03-01", HOY, "semanal").tramo).toBe("perdido"); // 172
    expect(u.enRiesgo).toBeLessThan(u.dormido);
    expect(u.dormido).toBeLessThan(u.perdido);
  });

  it("una visita con fecha futura no revienta: se trata como recién venida", () => {
    const r = tramoDelCliente("2026-08-25", HOY, "semanal");
    expect(r.tramo).toBe("activo");
    expect(r.dias).toBe(0);
  });

  it("los umbrales de cada ritmo están ordenados", () => {
    for (const u of Object.values(RITMOS)) {
      expect(u.enRiesgo).toBeLessThan(u.dormido);
      expect(u.dormido).toBeLessThan(u.perdido);
    }
  });
});

describe("esRescatable", () => {
  it("se rescata al que se puede traer de vuelta, no al que ya se fue", () => {
    expect(esRescatable("en_riesgo")).toBe(true);
    expect(esRescatable("dormido")).toBe(true);
    // Gastar cupo de notificaciones en un perdido le resta al
    // recuperable; un activo recibiría spam; un nuevo nunca vino.
    expect(esRescatable("perdido")).toBe(false);
    expect(esRescatable("activo")).toBe(false);
    expect(esRescatable("nuevo")).toBe(false);
  });
});
