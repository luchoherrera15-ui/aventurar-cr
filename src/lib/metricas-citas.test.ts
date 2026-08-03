import { describe, expect, it } from "vitest";
import { reporteCitas, type CitaReporte } from "./metricas-citas";

const HOY = "2026-08-03";

function cita(extra: Partial<CitaReporte>): CitaReporte {
  return {
    fecha: "2026-07-15",
    hora_inicio: "10:00",
    estado: "cumplida",
    miembro_id: "m1",
    monto_total: 10000,
    tipo_evento: "Corte",
    ...extra,
  };
}

describe("reporteCitas", () => {
  it("cuenta totales, ingresos y la tasa de no-show", () => {
    const r = reporteCitas(
      [
        cita({}),
        cita({ monto_total: 5000 }),
        cita({ estado: "no_asistio" }),
        cita({ estado: "cancelada" }),
        // Confirmada de ayer sin marcar.
        cita({ estado: "confirmada", fecha: "2026-08-02" }),
        // Confirmada futura: cuenta como cita pero no como sin marcar.
        cita({ estado: "confirmada", fecha: "2026-08-20" }),
        // Un bloqueo no es una cita.
        cita({ estado: "bloqueada" }),
      ],
      HOY,
    );
    expect(r.total).toBe(6);
    expect(r.cumplidas).toBe(2);
    expect(r.noShows).toBe(1);
    expect(r.canceladas).toBe(1);
    expect(r.sinMarcar).toBe(1);
    expect(r.ingresos).toBe(15000);
    expect(r.tasaNoShow).toBeCloseTo(1 / 3);
  });

  it("desglosa por miembro y ordena por citas", () => {
    const r = reporteCitas(
      [
        cita({ miembro_id: "m1" }),
        cita({ miembro_id: "m2" }),
        cita({ miembro_id: "m2", estado: "no_asistio" }),
        cita({ miembro_id: null }),
      ],
      HOY,
    );
    expect(r.porMiembro[0]).toMatchObject({ miembroId: "m2", citas: 2, noShows: 1 });
    expect(r.porMiembro).toHaveLength(3);
    const sinAsignar = r.porMiembro.find((m) => m.miembroId === null);
    expect(sinAsignar?.cumplidas).toBe(1);
  });

  it("arma el top de servicios y las horas pico sin contar cancelados", () => {
    const r = reporteCitas(
      [
        cita({ tipo_evento: "Corte", hora_inicio: "10:00" }),
        cita({ tipo_evento: "Corte", hora_inicio: "10:30" }),
        cita({ tipo_evento: "Barba", hora_inicio: "14:00", monto_total: 4000 }),
        cita({ tipo_evento: "Tinte", hora_inicio: "15:00", estado: "cancelada" }),
      ],
      HOY,
    );
    expect(r.topServicios[0]).toMatchObject({ nombre: "Corte", veces: 2, ingresos: 20000 });
    expect(r.topServicios.find((s) => s.nombre === "Tinte")).toBeUndefined();
    expect(r.horasPico).toEqual([
      { hora: 10, veces: 2 },
      { hora: 14, veces: 1 },
    ]);
  });

  it("sin citas resueltas la tasa de no-show es null", () => {
    const r = reporteCitas([cita({ estado: "confirmada", fecha: "2026-08-20" })], HOY);
    expect(r.tasaNoShow).toBeNull();
  });
});
