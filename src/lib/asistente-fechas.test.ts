import { describe, expect, it } from "vitest";
import { contextoFechaActual, filtrarFechasPasadas } from "./asistente-fechas";

/**
 * Escenario base del bug reportado: el asistente confundía meses y
 * días que ya habían pasado porque nunca se le decía qué fecha era
 * "hoy". Estas pruebas cubren la parte determinística y testeable del
 * arreglo — la interpretación en lenguaje natural del modelo no se
 * puede probar acá sin llamar a la API real.
 */

describe("contextoFechaActual", () => {
  it("refleja exactamente la fecha y hora que recibe, nunca una fija", () => {
    const texto = contextoFechaActual("2026-08-03", "10:15 a. m.");
    expect(texto).toContain("Lunes 3 de agosto de 2026");
    expect(texto).toContain("10:15 a. m.");
    expect(texto).toContain("America/Costa_Rica");
  });

  it("cambia de mes y de año sin tocar código (no hay fecha fija adentro)", () => {
    // "Hoy es ..." tiene que reflejar la fecha recibida — el resto del
    // texto son reglas con ejemplos ilustrativos fijos, no la fecha real.
    const texto = contextoFechaActual("2027-01-01", "12:00 p. m.");
    expect(texto).toContain("Hoy es Viernes 1 de enero de 2027");
  });

  it("trae las reglas de meses pasados, expresiones relativas y confirmación completa", () => {
    const texto = contextoFechaActual("2026-08-03", "9:00 a. m.");
    expect(texto).toMatch(/ya pasó/i);
    expect(texto).toMatch(/mañana/i);
    expect(texto).toMatch(/año que viene/i);
    expect(texto).toMatch(/día, mes y año/i);
  });
});

describe("filtrarFechasPasadas", () => {
  it("descarta fechas anteriores a hoy y conserva las de hoy en adelante", () => {
    const { validas, descartadas } = filtrarFechasPasadas(
      ["2026-07-15", "2026-08-01", "2026-08-03", "2026-08-04", "2026-09-01"],
      "2026-08-03",
    );
    expect(validas).toEqual(["2026-08-03", "2026-08-04", "2026-09-01"]);
    expect(descartadas).toEqual(["2026-07-15", "2026-08-01"]);
  });

  it("hoy mismo cuenta como válida, no como pasada", () => {
    const { validas, descartadas } = filtrarFechasPasadas(["2026-08-03"], "2026-08-03");
    expect(validas).toEqual(["2026-08-03"]);
    expect(descartadas).toEqual([]);
  });

  it("descarta una fecha de un mes ya pasado — el escenario exacto del bug", () => {
    // Hoy 3 de agosto de 2026; la API devuelve por error una fecha de
    // julio de 2026 (mes ya pasado): tiene que descartarse, no mostrarse.
    const { validas, descartadas } = filtrarFechasPasadas(
      ["2026-08-20", "2026-07-10", "2026-08-05"],
      "2026-08-03",
    );
    expect(descartadas).toEqual(["2026-07-10"]);
    expect(validas).toEqual(["2026-08-20", "2026-08-05"]);
  });

  it("descarta una fecha de un año ya pasado", () => {
    const { validas, descartadas } = filtrarFechasPasadas(
      ["2025-12-31", "2026-08-03"],
      "2026-08-03",
    );
    expect(descartadas).toEqual(["2025-12-31"]);
    expect(validas).toEqual(["2026-08-03"]);
  });

  it("sin fechas pasadas, descartadas queda vacío", () => {
    const { validas, descartadas } = filtrarFechasPasadas(
      ["2026-08-10", "2026-08-20"],
      "2026-08-03",
    );
    expect(validas).toHaveLength(2);
    expect(descartadas).toEqual([]);
  });

  it("arreglo vacío no rompe nada", () => {
    expect(filtrarFechasPasadas([], "2026-08-03")).toEqual({ validas: [], descartadas: [] });
  });
});
