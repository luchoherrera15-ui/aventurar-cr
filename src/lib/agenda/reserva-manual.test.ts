import { describe, expect, it } from "vitest";
import { pideHoraReserva, resolverHorarioReserva } from "./reserva-manual";
import { aFilaReserva, normalizarFila, type ConfigNegocio } from "./importar-agenda";

/**
 * EL BLOQUEO FANTASMA DE LA PUERTA DE AL LADO.
 *
 * `importar-agenda.test.ts` prueba que una fila IMPORTADA de un negocio
 * que agenda por horas salga con `hora_inicio` (sin eso no entra en
 * `disponibilidad_citas` y el bloqueo no bloquea nada). La reserva que
 * el dueño carga A MANO desde el calendario del panel cae en la misma
 * tabla por otra puerta, y hasta ahora salía sin hora SIEMPRE.
 *
 * Acá se prueban las dos mitades:
 *   1. que el proveedor/restaurante/cita no pueda guardar sin hora, y
 *      que lo que se guarda tenga la MISMA duración que asume el
 *      importador (o la agenda pública) cuando nadie dijo cuánto dura;
 *   2. que UN LUGAR DE ALQUILER NO CAMBIE EN NADA — ni una columna de
 *      horario de más, escriba lo que escriba quien llame.
 */

const LUGAR = { vertical: "eventos", categoria: "lugares" };
const PROVEEDOR = { vertical: "eventos", categoria: "animacion" };
const CITAS = { vertical: "citas", categoria: "barberia" };
const RESTAURANTE = { vertical: "restaurantes", categoria: "pizza" };
const HOSPEDAJE = { vertical: "hospedajes", categoria: "casa" };

const sinHora = { horaInicio: null, horaFin: null };

describe("pideHoraReserva", () => {
  it("sale del discriminador oficial, no de una condición nueva", () => {
    expect(pideHoraReserva(PROVEEDOR)).toBe(true);
    expect(pideHoraReserva(CITAS)).toBe(true);
    expect(pideHoraReserva(RESTAURANTE)).toBe(true);
    expect(pideHoraReserva(LUGAR)).toBe(false);
    expect(pideHoraReserva(HOSPEDAJE)).toBe(false);
  });

  it("un negocio viejo sin vertical se trata como eventos", () => {
    expect(pideHoraReserva({ vertical: null, categoria: "animacion" })).toBe(true);
    expect(pideHoraReserva({ vertical: null, categoria: "lugares" })).toBe(false);
  });
});

describe("un lugar de alquiler no cambia en nada", () => {
  it("no escribe una sola columna de horario", () => {
    const r = resolverHorarioReserva(LUGAR, sinHora);
    expect(r.error).toBeNull();
    expect(r.campos).toEqual({});
  });

  it("tampoco si alguien le manda horas igual", () => {
    const r = resolverHorarioReserva(LUGAR, { horaInicio: "14:00", horaFin: "22:00" });
    expect(r.error).toBeNull();
    // Ni hora_inicio (lo volvería una franja) ni horario_bloque (ese
    // texto lo escribe el dueño desde "Modificar", como siempre).
    expect(r.campos).toEqual({});
  });

  it("guarda sin hora, que es como cargó su agenda toda la vida", () => {
    expect(resolverHorarioReserva(LUGAR, { horaInicio: "", horaFin: "" }).error).toBeNull();
  });

  it("un hospedaje tampoco: reserva un rango de días, no una franja", () => {
    const r = resolverHorarioReserva(HOSPEDAJE, sinHora);
    expect(r.error).toBeNull();
    expect(r.campos).toEqual({});
  });
});

describe("un negocio que agenda por horas no puede guardar sin hora", () => {
  it("al proveedor de eventos se le explica POR QUÉ", () => {
    const r = resolverHorarioReserva(PROVEEDOR, sinHora);
    expect(r.campos).toBeUndefined();
    expect(r.error).toMatch(/hora de inicio/i);
    expect(r.error).toMatch(/no le tapa ninguna hora/i);
  });

  it("a la cita y a la mesa también, en su idioma", () => {
    expect(resolverHorarioReserva(CITAS, sinHora).error).toBe(
      "Una cita necesita hora de inicio.",
    );
    expect(resolverHorarioReserva(RESTAURANTE, sinHora).error).toBe(
      "Una reserva de mesa necesita hora.",
    );
  });

  it("una hora mal escrita no pasa", () => {
    expect(resolverHorarioReserva(PROVEEDOR, { horaInicio: "25:00", horaFin: null }).error).toMatch(
      /hora de inicio no es válida/i,
    );
    expect(resolverHorarioReserva(PROVEEDOR, { horaInicio: "9", horaFin: null }).error).toMatch(
      /hora de inicio no es válida/i,
    );
    expect(
      resolverHorarioReserva(PROVEEDOR, { horaInicio: "15:00", horaFin: "26:30" }).error,
    ).toMatch(/hora de cierre no es válida/i);
  });
});

describe("lo que se guarda cuando sí hay hora", () => {
  it("el proveedor sin hora de cierre asume el bloque de su agenda pública", () => {
    const r = resolverHorarioReserva(PROVEEDOR, { horaInicio: "15:00", horaFin: null });
    expect(r.error).toBeNull();
    expect(r.campos).toEqual({ hora_inicio: "15:00", duracion_minutos: 120 });
  });

  it("con hora de cierre sale la duración real y el texto del bloque", () => {
    const r = resolverHorarioReserva(PROVEEDOR, { horaInicio: "15:00", horaFin: "19:30" });
    expect(r.campos).toEqual({
      hora_inicio: "15:00",
      duracion_minutos: 270,
      horario_bloque: "3:00 p.m. – 7:30 p.m.",
      duracion_horas: 4.5,
    });
  });

  it("una fiesta que cruza medianoche dura lo que dura", () => {
    const r = resolverHorarioReserva(PROVEEDOR, { horaInicio: "21:00", horaFin: "02:00" });
    expect(r.campos?.duracion_minutos).toBe(300);
    expect(r.campos?.duracion_horas).toBe(5);
  });

  it("una cita y una mesa duran 60 min cuando nadie dice cuánto", () => {
    expect(resolverHorarioReserva(CITAS, { horaInicio: "09:00", horaFin: null }).campos).toEqual({
      hora_inicio: "09:00",
      duracion_minutos: 60,
    });
    // El restaurante NO se lleva `horario_bloque`: ese texto es del
    // panel de eventos, igual que en `aFilaReserva`.
    expect(
      resolverHorarioReserva(RESTAURANTE, { horaInicio: "20:00", horaFin: "22:00" }).campos,
    ).toEqual({ hora_inicio: "20:00", duracion_minutos: 120 });
  });
});

describe("las dos puertas a `reservas` suponen lo mismo", () => {
  const config = (extra: Partial<ConfigNegocio>): ConfigNegocio => ({
    id: "n1",
    vertical: "eventos",
    categoria: "animacion",
    capacidadMin: null,
    capacidadMax: null,
    eventosPorDia: null,
    ...extra,
  });

  it("mano e importador escriben las mismas columnas de horario", () => {
    for (const [negocio, cfg] of [
      [PROVEEDOR, config({})],
      [CITAS, config({ vertical: "citas", categoria: "barberia" })],
      [RESTAURANTE, config({ vertical: "restaurantes", categoria: "pizza" })],
    ] as const) {
      for (const horas of [
        { horaInicio: "15:00", horaFin: null },
        { horaInicio: "15:00", horaFin: "19:30" },
      ]) {
        const aMano = resolverHorarioReserva(negocio, horas);
        const importada = aFilaReserva(
          normalizarFila({ fecha: "2026-09-12", nombre: "Boda Marín", ...horas }),
          cfg,
          { importacionId: "imp1", ahoraIso: "2026-08-13T12:00:00.000Z" },
        );
        for (const columna of [
          "hora_inicio",
          "duracion_minutos",
          "horario_bloque",
          "duracion_horas",
        ]) {
          expect(
            aMano.campos?.[columna] ?? null,
            `${cfg.vertical} · ${horas.horaFin ?? "sin cierre"} · ${columna}`,
          ).toEqual(importada[columna] ?? null);
        }
      }
    }
  });
});
