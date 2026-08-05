import { describe, expect, it } from "vitest";
import {
  cupoDelNegocio,
  expandirRangos,
  fechasBloqueadas,
  fechasLlenas,
  fechasSinDisponibilidad,
  type ReservaParaCupo,
} from "./disponibilidad-dias";

describe("expandirRangos", () => {
  it("una reserva de un solo día queda igual", () => {
    expect(expandirRangos([{ fecha: "2026-08-09", estado: "confirmada" }])).toEqual([
      { fecha: "2026-08-09", estado: "confirmada" },
    ]);
  });

  it("un alquiler multi-día bloquea también los días intermedios y el último", () => {
    const filas = expandirRangos([
      { fecha: "2026-08-20", estado: "confirmada", fecha_fin: "2026-08-22" },
    ]);
    expect(filas.map((f) => f.fecha)).toEqual(["2026-08-20", "2026-08-21", "2026-08-22"]);
  });

  it("cruza fin de mes sin desfase de zona horaria", () => {
    const filas = expandirRangos([
      { fecha: "2026-08-31", estado: "confirmada", fecha_fin: "2026-09-02" },
    ]);
    expect(filas.map((f) => f.fecha)).toEqual(["2026-08-31", "2026-09-01", "2026-09-02"]);
  });

  it("fecha_fin anterior o igual a la fecha no expande nada", () => {
    const filas = expandirRangos([
      { fecha: "2026-08-09", estado: "confirmada", fecha_fin: "2026-08-09" },
    ]);
    expect(filas).toHaveLength(1);
  });

  it("un fecha_fin corrupto no explota: corta en el tope", () => {
    const filas = expandirRangos(
      [{ fecha: "2026-08-09", estado: "confirmada", fecha_fin: "3000-01-01" }],
      5,
    );
    expect(filas).toHaveLength(6);
  });
});

describe("fechasLlenas", () => {
  it("sin tope (cupo null) nunca llena una fecha, sin importar cuántas reservas tenga", () => {
    const reservas: ReservaParaCupo[] = [
      { fecha: "2026-08-09", estado: "confirmada" },
      { fecha: "2026-08-09", estado: "confirmada" },
      { fecha: "2026-08-09", estado: "pendiente" },
    ];
    expect(fechasLlenas(reservas, null)).toEqual(new Set());
  });

  it("con cupo 1 (Lugar típico), una sola confirmada ya llena el día", () => {
    const reservas: ReservaParaCupo[] = [{ fecha: "2026-08-09", estado: "confirmada" }];
    expect(fechasLlenas(reservas, 1)).toEqual(new Set(["2026-08-09"]));
  });

  it("cuenta pendientes junto con confirmadas contra el cupo", () => {
    const reservas: ReservaParaCupo[] = [
      { fecha: "2026-08-09", estado: "pendiente" },
      { fecha: "2026-08-09", estado: "pendiente" },
    ];
    expect(fechasLlenas(reservas, 2)).toEqual(new Set(["2026-08-09"]));
    expect(fechasLlenas(reservas, 3)).toEqual(new Set());
  });

  it("ignora rechazadas: una reserva caída no debería tapar la fecha", () => {
    const reservas: ReservaParaCupo[] = [
      { fecha: "2026-08-09", estado: "rechazada" },
      { fecha: "2026-08-09", estado: "rechazada" },
    ];
    expect(fechasLlenas(reservas, 1)).toEqual(new Set());
  });

  it("un negocio con cupo 3 sigue con lugar hasta la tercera reserva del día", () => {
    const reservas: ReservaParaCupo[] = [
      { fecha: "2026-09-01", estado: "confirmada" },
      { fecha: "2026-09-01", estado: "confirmada" },
    ];
    expect(fechasLlenas(reservas, 3)).toEqual(new Set());
    reservas.push({ fecha: "2026-09-01", estado: "pendiente" });
    expect(fechasLlenas(reservas, 3)).toEqual(new Set(["2026-09-01"]));
  });
});

describe("fechasBloqueadas", () => {
  it("solo las 'bloqueada' cuentan, no confirmadas ni pendientes", () => {
    const reservas: ReservaParaCupo[] = [
      { fecha: "2026-08-10", estado: "bloqueada" },
      { fecha: "2026-08-11", estado: "confirmada" },
    ];
    expect(fechasBloqueadas(reservas)).toEqual(new Set(["2026-08-10"]));
  });
});

describe("fechasSinDisponibilidad", () => {
  it("junta llenas y bloqueadas, ordenadas y sin repetir", () => {
    const reservas: ReservaParaCupo[] = [
      { fecha: "2026-08-16", estado: "confirmada" },
      { fecha: "2026-08-09", estado: "bloqueada" },
      { fecha: "2026-08-02", estado: "confirmada" },
    ];
    expect(fechasSinDisponibilidad(reservas, 1)).toEqual([
      "2026-08-02",
      "2026-08-09",
      "2026-08-16",
    ]);
  });

  it("una fecha llena y bloqueada a la vez no sale duplicada", () => {
    const reservas: ReservaParaCupo[] = [
      { fecha: "2026-08-09", estado: "bloqueada" },
      { fecha: "2026-08-09", estado: "confirmada" },
    ];
    expect(fechasSinDisponibilidad(reservas, 1)).toEqual(["2026-08-09"]);
  });
});

describe("cupoDelNegocio", () => {
  it("usa lo configurado si existe, sin importar la categoría", () => {
    expect(cupoDelNegocio(3, "lugares")).toBe(3);
    expect(cupoDelNegocio(5, "catering")).toBe(5);
  });

  it("un Lugar sin configurar cae en 1", () => {
    expect(cupoDelNegocio(null, "lugares")).toBe(1);
  });

  it("otra categoría sin configurar queda sin tope", () => {
    expect(cupoDelNegocio(null, "catering")).toBe(null);
  });
});
