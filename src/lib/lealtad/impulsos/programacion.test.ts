import { describe, expect, it } from "vitest";
import type { Horario } from "./tipos";
import {
  calcularEjecucion,
  dentroDelHorario,
  esperaDeReintento,
  horaDeMinutos,
  minutosDeHora,
  validarHorario,
} from "./programacion";

const CR = "America/Costa_Rica";
const NY = "America/New_York";
const d = (s: string) => new Date(s);
const salida = (r: ReturnType<typeof calcularEjecucion>) => (r.ok ? r.ejecutarEn.toISOString() : r.motivo);

// Miércoles 21 de octubre de 2026. Costa Rica = UTC−6 (sin horario de verano).
const INMEDIATO: Horario = { modo: "inmediato" };

describe("el retraso", () => {
  it("5 minutos después de inscribirse", () => {
    const r = calcularEjecucion({ ocurridoEn: d("2026-10-21T15:00:00Z"), retrasoMinutos: 5, horario: INMEDIATO, zona: CR });
    expect(salida(r)).toBe("2026-10-21T15:05:00.000Z");
  });

  it("sin retraso sale en el acto", () => {
    const r = calcularEjecucion({ ocurridoEn: d("2026-10-21T15:00:00Z"), retrasoMinutos: 0, horario: INMEDIATO, zona: CR });
    expect(salida(r)).toBe("2026-10-21T15:00:00.000Z");
  });

  it("horas y días se cuentan en minutos", () => {
    const base = d("2026-10-21T15:00:00Z");
    expect(salida(calcularEjecucion({ ocurridoEn: base, retrasoMinutos: 90, horario: INMEDIATO, zona: CR }))).toBe("2026-10-21T16:30:00.000Z");
    expect(salida(calcularEjecucion({ ocurridoEn: base, retrasoMinutos: 3 * 1440, horario: INMEDIATO, zona: CR }))).toBe("2026-10-24T15:00:00.000Z");
  });

  it("un retraso inválido se trata como cero", () => {
    const r = calcularEjecucion({ ocurridoEn: d("2026-10-21T15:00:00Z"), retrasoMinutos: Number.NaN, horario: INMEDIATO, zona: CR });
    expect(salida(r)).toBe("2026-10-21T15:00:00.000Z");
    const neg = calcularEjecucion({ ocurridoEn: d("2026-10-21T15:00:00Z"), retrasoMinutos: -50, horario: INMEDIATO, zona: CR });
    expect(salida(neg)).toBe("2026-10-21T15:00:00.000Z");
  });
});

describe("hora exacta", () => {
  const nueve: Horario = { modo: "hora_exacta", hora: "09:00" };

  it("si todavía no son las 9, sale hoy a las 9 (hora del negocio)", () => {
    // 14:00 UTC = 08:00 en Costa Rica
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T14:00:00Z"), retrasoMinutos: 0, horario: nueve, zona: CR }))).toBe(
      "2026-10-21T15:00:00.000Z",
    );
  });

  it("si ya pasaron las 9, sale mañana a las 9", () => {
    // 16:00 UTC = 10:00 en Costa Rica
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T16:00:00Z"), retrasoMinutos: 0, horario: nueve, zona: CR }))).toBe(
      "2026-10-22T15:00:00.000Z",
    );
  });

  it("la fecha es la del negocio, no la del servidor: 21:00 del 20 en Costa Rica es el 21 en UTC", () => {
    // 03:00 UTC del 21 = 21:00 del 20 en CR → las 9:00 que vienen son las del 21 en CR
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T03:00:00Z"), retrasoMinutos: 0, horario: nueve, zona: CR }))).toBe(
      "2026-10-21T15:00:00.000Z",
    );
  });

  it("cumpleaños: un hecho a la medianoche local sale ese mismo día a las 9:00", () => {
    // 06:00 UTC = 00:00 en CR del 21
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T06:00:00Z"), retrasoMinutos: 0, horario: nueve, zona: CR }))).toBe(
      "2026-10-21T15:00:00.000Z",
    );
  });

  it("respeta los días permitidos (solo lunes)", () => {
    const lunes: Horario = { modo: "hora_exacta", hora: "09:00", dias: [1] };
    // miércoles 10:00 local → lunes 26 a las 9:00 local (15:00 UTC)
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T16:00:00Z"), retrasoMinutos: 0, horario: lunes, zona: CR }))).toBe(
      "2026-10-26T15:00:00.000Z",
    );
  });

  it("no corre una hora con el horario de verano: las 9:00 de Nueva York siguen siendo las 9:00", () => {
    // 2026-03-08 12:00 UTC = 08:00 EDT (el cambio fue a las 2:00 de esa madrugada)
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-03-08T12:00:00Z"), retrasoMinutos: 0, horario: nueve, zona: NY }))).toBe(
      "2026-03-08T13:00:00.000Z",
    );
    // el día anterior, a las 9:00 EST
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-03-07T12:00:00Z"), retrasoMinutos: 0, horario: nueve, zona: NY }))).toBe(
      "2026-03-07T14:00:00.000Z",
    );
  });
});

describe("ventana", () => {
  const laboral: Horario = { modo: "ventana", desde: "09:00", hasta: "18:00", dias: [1, 2, 3, 4, 5], siguiente_ventana: true };

  it("dentro de la ventana sale en el acto", () => {
    // miércoles 10:00 local
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T16:00:00Z"), retrasoMinutos: 0, horario: laboral, zona: CR }))).toBe(
      "2026-10-21T16:00:00.000Z",
    );
  });

  it("antes de que abra, espera a que abra ese mismo día", () => {
    // miércoles 07:00 local
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T13:00:00Z"), retrasoMinutos: 0, horario: laboral, zona: CR }))).toBe(
      "2026-10-21T15:00:00.000Z",
    );
  });

  it("después de que cierra, espera al día siguiente", () => {
    // miércoles 19:00 local → jueves 09:00 local
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-22T01:00:00Z"), retrasoMinutos: 0, horario: laboral, zona: CR }))).toBe(
      "2026-10-22T15:00:00.000Z",
    );
  });

  it("un sábado salta al lunes", () => {
    // sábado 24, 08:00 local
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-24T14:00:00Z"), retrasoMinutos: 0, horario: laboral, zona: CR }))).toBe(
      "2026-10-26T15:00:00.000Z",
    );
  });

  it("el retraso se suma ANTES de mirar la ventana (17:55 + 10 min cae afuera)", () => {
    // miércoles 17:55 local = 23:55 UTC; +10 → 18:05 local → jueves 09:00
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T23:55:00Z"), retrasoMinutos: 10, horario: laboral, zona: CR }))).toBe(
      "2026-10-22T15:00:00.000Z",
    );
  });

  it("el último minuto de la ventana todavía cuenta", () => {
    // miércoles 18:00 local
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-22T00:00:00Z"), retrasoMinutos: 0, horario: laboral, zona: CR }))).toBe(
      "2026-10-22T00:00:00.000Z",
    );
  });

  it("sin «siguiente ventana», lo que cae afuera no se manda", () => {
    const estricto: Horario = { ...laboral, siguiente_ventana: false };
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-22T01:00:00Z"), retrasoMinutos: 0, horario: estricto, zona: CR }))).toBe(
      "fuera_de_horario",
    );
    // pero adentro sí
    expect(salida(calcularEjecucion({ ocurridoEn: d("2026-10-21T16:00:00Z"), retrasoMinutos: 0, horario: estricto, zona: CR }))).toBe(
      "2026-10-21T16:00:00.000Z",
    );
  });
});

describe("vigencia de la campaña", () => {
  it("un hecho anterior al inicio no se manda (nada retroactivo)", () => {
    const r = calcularEjecucion({
      ocurridoEn: d("2026-10-21T15:00:00Z"),
      retrasoMinutos: 5,
      horario: INMEDIATO,
      zona: CR,
      vigenteDesde: "2026-11-01",
    });
    expect(salida(r)).toBe("antes_de_vigencia");
  });

  it("si la salida cae después del último día, no se manda", () => {
    // 23:30 local del 21 + 60 min = 00:30 del 22; la campaña terminó el 21
    const r = calcularEjecucion({
      ocurridoEn: d("2026-10-22T05:30:00Z"),
      retrasoMinutos: 60,
      horario: INMEDIATO,
      zona: CR,
      vigenteHasta: "2026-10-21",
    });
    expect(salida(r)).toBe("fuera_de_vigencia");
  });

  it("el último día de la campaña todavía vale", () => {
    const r = calcularEjecucion({
      ocurridoEn: d("2026-10-21T15:00:00Z"),
      retrasoMinutos: 5,
      horario: INMEDIATO,
      zona: CR,
      vigenteDesde: "2026-10-21",
      vigenteHasta: "2026-10-21",
    });
    expect(salida(r)).toBe("2026-10-21T15:05:00.000Z");
  });
});

describe("dentroDelHorario", () => {
  const laboral: Horario = { modo: "ventana", desde: "09:00", hasta: "18:00", dias: [1, 2, 3, 4, 5] };
  it("inmediato y hora exacta no restringen el momento", () => {
    expect(dentroDelHorario(d("2026-10-21T08:00:00Z"), { modo: "inmediato" }, CR)).toBe(true);
    expect(dentroDelHorario(d("2026-10-21T08:00:00Z"), { modo: "hora_exacta", hora: "09:00" }, CR)).toBe(true);
  });
  it("ventana: adentro y afuera", () => {
    expect(dentroDelHorario(d("2026-10-21T16:00:00Z"), laboral, CR)).toBe(true); // mié 10:00
    expect(dentroDelHorario(d("2026-10-22T01:00:00Z"), laboral, CR)).toBe(false); // mié 19:00
    expect(dentroDelHorario(d("2026-10-24T16:00:00Z"), laboral, CR)).toBe(false); // sáb 10:00
  });
});

describe("validarHorario", () => {
  it("acepta lo bien formado", () => {
    expect(validarHorario({ modo: "inmediato" })).toBeNull();
    expect(validarHorario({ modo: "hora_exacta", hora: "09:00" })).toBeNull();
    expect(validarHorario({ modo: "ventana", desde: "09:00", hasta: "18:00", dias: [1, 2] })).toBeNull();
  });
  it("rechaza lo mal formado con un mensaje en español", () => {
    expect(validarHorario({ modo: "hora_exacta", hora: "25:00" })).toMatch(/hora exacta/);
    expect(validarHorario({ modo: "hora_exacta" })).toMatch(/hora exacta/);
    expect(validarHorario({ modo: "ventana", desde: "18:00", hasta: "09:00" })).toMatch(/anterior/);
    expect(validarHorario({ modo: "ventana", desde: "09:00" })).toMatch(/inicio y la de fin/);
    expect(validarHorario({ modo: "ventana", desde: "09:00", hasta: "10:00", dias: [] })).toMatch(/al menos un día/);
    expect(validarHorario({ modo: "ventana", desde: "09:00", hasta: "10:00", dias: [9] })).toMatch(/días permitidos/);
    expect(validarHorario({ modo: "inmediato", dias: [1] })).toMatch(/limitar los días/);
    expect(validarHorario(null)).toMatch(/no es válido/);
  });
});

describe("utilidades", () => {
  it("minutosDeHora / horaDeMinutos", () => {
    expect(minutosDeHora("09:30")).toBe(570);
    expect(minutosDeHora("24:00")).toBeNull();
    expect(minutosDeHora("9:30")).toBeNull();
    expect(minutosDeHora(undefined)).toBeNull();
    expect(horaDeMinutos(570)).toBe("09:30");
    expect(horaDeMinutos(0)).toBe("00:00");
  });
  it("esperaDeReintento sube y se queda en la última", () => {
    expect(esperaDeReintento(1, [5, 30])).toBe(5);
    expect(esperaDeReintento(2, [5, 30])).toBe(30);
    expect(esperaDeReintento(9, [5, 30])).toBe(30);
    expect(esperaDeReintento(0, [5, 30])).toBe(5);
  });
});
