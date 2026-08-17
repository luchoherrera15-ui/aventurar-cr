import { describe, expect, it } from "vitest";
import {
  etiquetaHoras,
  metricasDelDia,
  minutosDeAgenda,
  type CitaParaMetricas,
  type ParametrosMetricasDia,
} from "./metricas-dia";

/**
 * Estas pruebas existen por una razón concreta: la tarjeta de ocupación
 * es la que más fácil se convierte en un número inventado. Acá se fija
 * qué significa exactamente ("minutos agendados ÷ jornada real") y en
 * qué casos NO hay respuesta —que es cuando la tarjeta no se pinta.
 */

// 2026-08-17 es lunes (dow 1) — el mismo día de la maqueta.
const LUNES = "2026-08-17";
const ZONA = "America/Costa_Rica";

const HORARIO = { "1": { abre: "09:00", cierra: "17:00" } };

function cita(parcial: Partial<CitaParaMetricas> = {}): CitaParaMetricas {
  return {
    hora_inicio: "09:00:00",
    duracion_minutos: 60,
    miembro_id: null,
    estado: "confirmada",
    monto_total: null,
    evento_pagado: false,
    monto_cobrado_final: null,
    ...parcial,
  };
}

function params(parcial: Partial<ParametrosMetricasDia> = {}): ParametrosMetricasDia {
  return {
    fecha: LUNES,
    zona: ZONA,
    citas: [],
    equipo: [],
    horario: HORARIO,
    horariosPorMiembro: {},
    bloqueos: [],
    ...parcial,
  };
}

describe("la jornada del día", () => {
  it("sin equipo, el negocio es un solo recurso con su horario", () => {
    expect(minutosDeAgenda(params())).toBe(8 * 60);
  });

  it("cada colaborador activo suma su propia jornada", () => {
    const jornada = minutosDeAgenda(
      params({
        equipo: [
          { id: "a", activo: true },
          { id: "b", activo: true },
        ],
      }),
    );
    expect(jornada).toBe(16 * 60);
  });

  it("quien está pausado no suma horas", () => {
    const jornada = minutosDeAgenda(
      params({
        equipo: [
          { id: "a", activo: true },
          { id: "b", activo: false },
        ],
      }),
    );
    expect(jornada).toBe(8 * 60);
  });

  it("el horario propio manda sobre el del negocio", () => {
    const jornada = minutosDeAgenda(
      params({
        equipo: [{ id: "a", activo: true }],
        horariosPorMiembro: { a: [{ dow: 1, abre: "10:00", cierra: "14:00" }] },
      }),
    );
    expect(jornada).toBe(4 * 60);
  });

  it("un horario partido suma sus dos tramos", () => {
    const jornada = minutosDeAgenda(
      params({
        equipo: [{ id: "a", activo: true }],
        horariosPorMiembro: {
          a: [
            { dow: 1, abre: "08:00", cierra: "12:00" },
            { dow: 1, abre: "14:00", cierra: "18:00" },
          ],
        },
      }),
    );
    expect(jornada).toBe(8 * 60);
  });

  it("el día libre (centinela 00:00–00:01) no es un minuto de jornada", () => {
    const jornada = minutosDeAgenda(
      params({
        equipo: [{ id: "a", activo: true }],
        horariosPorMiembro: { a: [{ dow: 1, abre: "00:00", cierra: "00:01" }] },
      }),
    );
    expect(jornada).toBe(0);
  });

  it("sin horario configurado no hay jornada que medir", () => {
    expect(minutosDeAgenda(params({ horario: null }))).toBe(0);
    // Y el negocio cerrado ese día tampoco: el lunes no está en la llave.
    expect(minutosDeAgenda(params({ horario: { "2": { abre: "09:00", cierra: "17:00" } } }))).toBe(
      0,
    );
  });

  it("un bloqueo del negocio le quita horas a todas las columnas", () => {
    const jornada = minutosDeAgenda(
      params({
        equipo: [
          { id: "a", activo: true },
          { id: "b", activo: true },
        ],
        bloqueos: [
          {
            miembro_id: null,
            inicio: `${LUNES}T12:00:00-06:00`,
            fin: `${LUNES}T13:00:00-06:00`,
          },
        ],
      }),
    );
    expect(jornada).toBe(14 * 60);
  });

  it("un bloqueo personal solo le quita horas a esa persona", () => {
    const jornada = minutosDeAgenda(
      params({
        equipo: [
          { id: "a", activo: true },
          { id: "b", activo: true },
        ],
        bloqueos: [
          { miembro_id: "a", inicio: `${LUNES}T12:00:00-06:00`, fin: `${LUNES}T13:00:00-06:00` },
        ],
      }),
    );
    expect(jornada).toBe(15 * 60);
  });

  it("dos bloqueos que se solapan no descuentan dos veces", () => {
    const jornada = minutosDeAgenda(
      params({
        bloqueos: [
          { miembro_id: null, inicio: `${LUNES}T12:00:00-06:00`, fin: `${LUNES}T14:00:00-06:00` },
          { miembro_id: null, inicio: `${LUNES}T13:00:00-06:00`, fin: `${LUNES}T15:00:00-06:00` },
        ],
      }),
    );
    expect(jornada).toBe(5 * 60);
  });

  it("un bloqueo fuera del horario no descuenta nada", () => {
    const jornada = minutosDeAgenda(
      params({
        bloqueos: [
          { miembro_id: null, inicio: `${LUNES}T19:00:00-06:00`, fin: `${LUNES}T21:00:00-06:00` },
        ],
      }),
    );
    expect(jornada).toBe(8 * 60);
  });

  it("un bloqueo de otro día no toca el día que se está viendo", () => {
    const jornada = minutosDeAgenda(
      params({
        bloqueos: [
          {
            miembro_id: null,
            inicio: "2026-08-18T09:00:00-06:00",
            fin: "2026-08-18T17:00:00-06:00",
          },
        ],
      }),
    );
    expect(jornada).toBe(8 * 60);
  });

  it("un bloqueo de varios días se recorta al día consultado", () => {
    const jornada = minutosDeAgenda(
      params({
        bloqueos: [
          {
            miembro_id: null,
            inicio: "2026-08-16T08:00:00-06:00",
            fin: "2026-08-18T20:00:00-06:00",
          },
        ],
      }),
    );
    expect(jornada).toBe(0);
  });

  it("un compromiso traído del calendario baja la jornada de su columna", () => {
    const jornada = minutosDeAgenda(
      params({
        equipo: [
          { id: "a", activo: true },
          { id: "b", activo: true },
        ],
        citas: [
          cita({ estado: "bloqueada", miembro_id: "a", hora_inicio: "10:00:00", duracion_minutos: 90 }),
        ],
      }),
    );
    expect(jornada).toBe(16 * 60 - 90);
  });

  it("un recurso con cupo simultáneo aguanta esa cantidad de agenda", () => {
    const jornada = minutosDeAgenda(
      params({ equipo: [{ id: "a", activo: true, cupo_simultaneo: 3 }] }),
    );
    expect(jornada).toBe(24 * 60);
  });
});

describe("los números del día", () => {
  it("cuenta solo las citas reales: ni canceladas ni bloqueos", () => {
    const m = metricasDelDia(
      params({
        citas: [
          cita({ estado: "confirmada" }),
          cita({ estado: "pendiente" }),
          cita({ estado: "cumplida" }),
          cita({ estado: "no_asistio" }),
          cita({ estado: "cancelada" }),
          cita({ estado: "rechazada" }),
          cita({ estado: "bloqueada" }),
        ],
      }),
    );
    expect(m.total).toBe(4);
    expect(m.confirmadas).toBe(1);
    expect(m.sinConfirmar).toBe(1);
    expect(m.yaVinieron).toBe(1);
    expect(m.noVinieron).toBe(1);
  });

  it("la ocupación es minutos agendados sobre jornada", () => {
    const m = metricasDelDia(
      params({
        citas: [cita({ duracion_minutos: 120 }), cita({ duracion_minutos: 120 })],
      }),
    );
    expect(m.minutosAgendados).toBe(240);
    expect(m.minutosDeAgenda).toBe(480);
    expect(m.ocupacion).toBe(50);
  });

  it("sin duración guardada se miden los 30 min que dibuja la agenda", () => {
    const m = metricasDelDia(params({ citas: [cita({ duracion_minutos: null })] }));
    expect(m.minutosAgendados).toBe(30);
  });

  it("sin jornada la ocupación es null, no 0% — y por eso no se pinta", () => {
    const m = metricasDelDia(params({ horario: null, citas: [cita()] }));
    expect(m.minutosDeAgenda).toBe(0);
    expect(m.ocupacion).toBeNull();
    // El dato honesto sí queda: hay una cita agendada ese día.
    expect(m.total).toBe(1);
    expect(m.minutosAgendados).toBe(60);
  });

  it("agendar por encima del horario pasa de 100 y se dice tal cual", () => {
    const m = metricasDelDia(
      params({
        horario: { "1": { abre: "09:00", cierra: "11:00" } },
        citas: [cita({ duracion_minutos: 180 })],
      }),
    );
    expect(m.ocupacion).toBe(150);
  });

  it("cobrado usa el monto real cobrado por encima de la cotización", () => {
    const m = metricasDelDia(
      params({
        citas: [
          cita({ estado: "cumplida", monto_total: 10000, evento_pagado: true }),
          cita({
            estado: "cumplida",
            monto_total: 10000,
            monto_cobrado_final: 15000,
            evento_pagado: true,
          }),
        ],
      }),
    );
    expect(m.cobrado).toBe(25000);
    expect(m.porCobrar).toBe(0);
  });

  it("por cobrar deja afuera lo ya cobrado, lo cancelado y a quien no vino", () => {
    const m = metricasDelDia(
      params({
        citas: [
          cita({ estado: "confirmada", monto_total: 8000 }),
          cita({ estado: "pendiente", monto_total: 5000 }),
          cita({ estado: "cumplida", monto_total: 12000, evento_pagado: true }),
          cita({ estado: "no_asistio", monto_total: 9000 }),
          cita({ estado: "cancelada", monto_total: 20000 }),
        ],
      }),
    );
    expect(m.porCobrar).toBe(13000);
    expect(m.cobrado).toBe(12000);
  });

  it("una cita sin precio no inventa un monto", () => {
    const m = metricasDelDia(params({ citas: [cita({ monto_total: null })] }));
    expect(m.porCobrar).toBe(0);
    expect(m.cobrado).toBe(0);
  });

  it("un día sin nada da ceros y ninguna ocupación falsa", () => {
    const m = metricasDelDia(params({ horario: null }));
    expect(m).toMatchObject({
      total: 0,
      minutosAgendados: 0,
      minutosDeAgenda: 0,
      ocupacion: null,
      cobrado: 0,
      porCobrar: 0,
    });
  });
});

describe("etiquetaHoras", () => {
  it("escribe las horas como las diría el dueño", () => {
    expect(etiquetaHoras(45)).toBe("45 min");
    expect(etiquetaHoras(60)).toBe("1 h");
    expect(etiquetaHoras(510)).toBe("8 h 30 min");
    expect(etiquetaHoras(0)).toBe("0 min");
  });
});
