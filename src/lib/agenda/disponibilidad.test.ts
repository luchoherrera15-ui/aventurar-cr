import { describe, expect, it } from "vitest";
import {
  calcularDisponibilidad,
  diaDeSemana,
  instanteEnZona,
  type ParametrosDisponibilidad,
} from "./disponibilidad";

/**
 * El motor es puro: acá se prueba con un negocio de mentira. El
 * 2026-08-03 es lunes (dow 1); la zona es la de Costa Rica (UTC-6
 * fijo, sin horario de verano).
 */

const LUNES = "2026-08-03";
const ZONA = "America/Costa_Rica";

function base(extra: Partial<ParametrosDisponibilidad> = {}): ParametrosDisponibilidad {
  return {
    fecha: LUNES,
    zonaHoraria: ZONA,
    // El negocio abre lunes de 9 a 12.
    horarioNegocio: { "1": { abre: "09:00", cierra: "12:00" } },
    recursos: [],
    duracionMinutos: 60,
    citas: [],
    bloqueos: [],
    ...extra,
  };
}

describe("diaDeSemana e instanteEnZona", () => {
  it("calcula el día de la semana sin depender de la zona del sistema", () => {
    expect(diaDeSemana("2026-08-03")).toBe(1); // lunes
    expect(diaDeSemana("2026-08-02")).toBe(0); // domingo
  });

  it("traduce un instante UTC a la hora de Costa Rica (UTC-6)", () => {
    // 15:30Z = 09:30 en CR.
    expect(instanteEnZona("2026-08-03T15:30:00Z", ZONA)).toEqual({
      fecha: "2026-08-03",
      minutos: 9 * 60 + 30,
    });
  });
});

describe("horario y herencia", () => {
  it("sin equipo, ofrece el horario del negocio cada 30 min", () => {
    const r = calcularDisponibilidad(base());
    // 9:00–12:00 con servicio de 60: el último arranque es 11:00.
    expect(r.cualquiera).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("un recurso sin horario propio hereda el del negocio", () => {
    const r = calcularDisponibilidad(
      base({ recursos: [{ id: "ana", horario: null }] }),
    );
    expect(r.porRecurso.ana).toContain("09:00");
    expect(r.porRecurso.ana).toContain("11:00");
  });

  it("el horario propio del recurso manda sobre el del negocio", () => {
    const r = calcularDisponibilidad(
      base({
        recursos: [
          // Ana trabaja el lunes solo de 10 a 11 (aunque el negocio
          // abra de 9 a 12).
          { id: "ana", horario: { "1": [{ abre: "10:00", cierra: "11:00" }] } },
        ],
      }),
    );
    expect(r.porRecurso.ana).toEqual(["10:00"]);
  });

  it("soporta horario partido (mañana y tarde)", () => {
    const r = calcularDisponibilidad(
      base({
        duracionMinutos: 30,
        recursos: [
          {
            id: "ana",
            horario: {
              "1": [
                { abre: "09:00", cierra: "10:00" },
                { abre: "15:00", cierra: "16:00" },
              ],
            },
          },
        ],
      }),
    );
    expect(r.porRecurso.ana).toEqual(["09:00", "09:30", "15:00", "15:30"]);
  });

  it("un día con horario propio vacío = ese día no trabaja", () => {
    const r = calcularDisponibilidad(
      base({ recursos: [{ id: "ana", horario: { "1": [] } }] }),
    );
    expect(r.porRecurso.ana).toEqual([]);
  });
});

describe("citas existentes y buffers", () => {
  it("una cita ocupa su duración: ese espacio no se ofrece", () => {
    const r = calcularDisponibilidad(
      base({
        duracionMinutos: 30,
        citas: [{ miembroId: null, horaInicio: "10:00:00", duracionMinutos: 60 }],
      }),
    );
    expect(r.cualquiera).not.toContain("10:00");
    expect(r.cualquiera).not.toContain("10:30");
    expect(r.cualquiera).toContain("09:30");
    expect(r.cualquiera).toContain("11:00");
  });

  it("el buffer de la cita existente también bloquea", () => {
    const r = calcularDisponibilidad(
      base({
        duracionMinutos: 30,
        citas: [
          // 10:00–10:30 + 30 de limpieza: hasta las 11:00 nada.
          { miembroId: null, horaInicio: "10:00", duracionMinutos: 30, bufferMinutos: 30 },
        ],
      }),
    );
    expect(r.cualquiera).not.toContain("10:30");
    expect(r.cualquiera).toContain("11:00");
  });

  it("el buffer del servicio consultado impide pegarse a la siguiente cita", () => {
    const r = calcularDisponibilidad(
      base({
        duracionMinutos: 30,
        bufferMinutos: 30,
        citas: [{ miembroId: null, horaInicio: "10:00", duracionMinutos: 60 }],
      }),
    );
    // 09:30 + 30 de servicio + 30 de buffer invade la cita de las 10.
    expect(r.cualquiera).not.toContain("09:30");
    expect(r.cualquiera).toContain("09:00");
  });

  it("las citas de una persona no estorban a la otra, y 'cualquiera' es la unión", () => {
    const r = calcularDisponibilidad(
      base({
        recursos: [
          { id: "ana", horario: null },
          { id: "beto", horario: null },
        ],
        citas: [{ miembroId: "ana", horaInicio: "09:00", duracionMinutos: 180 }],
      }),
    );
    expect(r.porRecurso.ana).toEqual([]);
    expect(r.porRecurso.beto).toContain("09:00");
    expect(r.cualquiera).toContain("09:00");
  });
});

describe("bloqueos", () => {
  it("un bloqueo del negocio entero frena a todo el equipo", () => {
    const r = calcularDisponibilidad(
      base({
        recursos: [
          { id: "ana", horario: null },
          { id: "beto", horario: null },
        ],
        bloqueos: [
          // 15:00Z–18:00Z = 09:00–12:00 CR: el día entero del negocio.
          { miembroId: null, inicio: "2026-08-03T15:00:00Z", fin: "2026-08-03T18:00:00Z" },
        ],
      }),
    );
    expect(r.cualquiera).toEqual([]);
  });

  it("un bloqueo por recurso frena solo a ese recurso", () => {
    const r = calcularDisponibilidad(
      base({
        recursos: [
          { id: "ana", horario: null },
          { id: "beto", horario: null },
        ],
        bloqueos: [
          { miembroId: "ana", inicio: "2026-08-03T15:00:00Z", fin: "2026-08-03T18:00:00Z" },
        ],
      }),
    );
    expect(r.porRecurso.ana).toEqual([]);
    expect(r.porRecurso.beto?.length).toBeGreaterThan(0);
  });

  it("unas vacaciones de varios días cubren el día consultado completo", () => {
    const r = calcularDisponibilidad(
      base({
        bloqueos: [
          { miembroId: null, inicio: "2026-08-01T06:00:00Z", fin: "2026-08-10T06:00:00Z" },
        ],
      }),
    );
    expect(r.cualquiera).toEqual([]);
  });

  it("un bloqueo de otro día no afecta", () => {
    const r = calcularDisponibilidad(
      base({
        bloqueos: [
          { miembroId: null, inicio: "2026-08-04T15:00:00Z", fin: "2026-08-04T18:00:00Z" },
        ],
      }),
    );
    expect(r.cualquiera.length).toBeGreaterThan(0);
  });
});

describe("cierre, intervalo y hoy", () => {
  it("no ofrece espacios donde el servicio no cabe antes del cierre", () => {
    const r = calcularDisponibilidad(base({ duracionMinutos: 120 }));
    // 9:00–12:00 con 120 min: el último arranque posible es 10:00.
    expect(r.cualquiera).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("respeta un intervalo distinto (cada 15 min)", () => {
    const r = calcularDisponibilidad(
      base({ duracionMinutos: 30, intervaloMinutos: 15 }),
    );
    expect(r.cualquiera).toContain("09:15");
    expect(r.cualquiera).toContain("09:45");
  });

  it("hoy no ofrece horas que ya pasaron en la zona del negocio", () => {
    const r = calcularDisponibilidad(
      // 16:05Z = 10:05 CR: las 9, 9:30 y 10:00 ya pasaron.
      base({ ahora: new Date("2026-08-03T16:05:00Z") }),
    );
    expect(r.cualquiera).toEqual(["10:30", "11:00"]);
  });

  it("una fecha ya pasada no ofrece nada", () => {
    const r = calcularDisponibilidad(base({ ahora: new Date("2026-08-04T12:00:00Z") }));
    expect(r.cualquiera).toEqual([]);
  });
});
