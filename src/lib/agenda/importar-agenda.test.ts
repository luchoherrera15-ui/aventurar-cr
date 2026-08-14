import { describe, expect, it } from "vitest";
import {
  aFilaReserva,
  detectarChoques,
  normalizarFila,
  ocupaFranjaHoraria,
  validarFila,
  type ConfigNegocio,
  type FilaAgenda,
} from "./importar-agenda";
import { filasDeseadas, type EventoImportado } from "./importar-ics";

/**
 * LOS BLOQUEOS FANTASMA DEL IMPORTADOR.
 *
 * La regla que se prueba acá es una sola y vale para los dos
 * importadores (el de la agenda de papel y el del .ics de Google):
 *
 *   una reserva de un negocio que agenda POR HORAS tiene que salir
 *   CON `hora_inicio`.
 *
 * Por qué importa tanto: la vista `disponibilidad_citas` —de donde la
 * agenda pública saca las franjas ya tomadas— filtra con
 * `hora_inicio is not null` desde la 0055 y en todas sus versiones
 * hasta la 0109. Una fila sin hora se guarda igual, se ve en el panel
 * del dueño… y no le tapa una sola hora al cliente. El DJ ve su boda
 * en el calendario mientras la agenda le sigue ofreciendo ese sábado.
 */

const base = (extra: Partial<ConfigNegocio> = {}): ConfigNegocio => ({
  id: "n1",
  vertical: "eventos",
  categoria: "animacion",
  capacidadMin: null,
  capacidadMax: null,
  eventosPorDia: null,
  ...extra,
});

const PROVEEDOR = base();
const LUGAR = base({ categoria: "lugares" });
const CITAS = base({ vertical: "citas", categoria: "barberia" });
const RESTAURANTE = base({ vertical: "restaurantes", categoria: "pizza" });
const HOSPEDAJE = base({ vertical: "hospedajes", categoria: "casa" });

const fila = (extra: Partial<FilaAgenda> = {}): FilaAgenda =>
  normalizarFila({
    fecha: "2026-09-12",
    nombre: "Boda Marín",
    ...extra,
  } as Parameters<typeof normalizarFila>[0]);

const extra = { importacionId: "imp1", ahoraIso: "2026-08-13T12:00:00.000Z" };

describe("ocupaFranjaHoraria", () => {
  it("es true para citas, restaurantes y proveedores de eventos", () => {
    expect(ocupaFranjaHoraria("citas", "barberia")).toBe(true);
    expect(ocupaFranjaHoraria("restaurantes", "pizza")).toBe(true);
    for (const categoria of ["animacion", "alimentacion", "decoracion", "otros", null]) {
      expect(ocupaFranjaHoraria("eventos", categoria), String(categoria)).toBe(true);
    }
  });

  it("es false para un lugar de eventos y para hospedajes", () => {
    expect(ocupaFranjaHoraria("eventos", "lugares")).toBe(false);
    expect(ocupaFranjaHoraria("hospedajes", "casa")).toBe(false);
  });
});

describe("validarFila — la hora en un negocio por horas", () => {
  it("RECHAZA la fila de un proveedor de eventos sin hora de inicio", () => {
    const r = validarFila(fila(), PROVEEDOR);
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/hora de inicio/i);
  });

  it("acepta la misma fila con hora", () => {
    expect(validarFila(fila({ horaInicio: "15:00" }), PROVEEDOR).ok).toBe(true);
  });

  it("no le pide hora a un lugar para eventos — se alquila por fecha", () => {
    expect(validarFila(fila(), LUGAR).ok).toBe(true);
  });

  it("sigue pidiéndosela a citas y a restaurantes, con su propio mensaje", () => {
    expect(validarFila(fila(), CITAS).errores).toContain("Una cita necesita hora de inicio.");
    expect(validarFila(fila(), RESTAURANTE).errores).toContain(
      "Una reserva de mesa necesita hora.",
    );
  });

  it("un hospedaje sigue pidiendo fecha de salida y no hora", () => {
    const r = validarFila(fila({ fechaFin: "2026-09-15" }), HOSPEDAJE);
    expect(r.ok).toBe(true);
  });
});

describe("aFilaReserva — qué columnas se escriben", () => {
  it("un proveedor de eventos importa CON hora_inicio y duración en minutos", () => {
    const r = aFilaReserva(fila({ horaInicio: "15:00", horaFin: "19:00" }), PROVEEDOR, extra);
    expect(r.hora_inicio).toBe("15:00");
    expect(r.duracion_minutos).toBe(240);
  });

  it("y conserva el texto del bloque que su panel viene mostrando", () => {
    const r = aFilaReserva(fila({ horaInicio: "15:00", horaFin: "19:00" }), PROVEEDOR, extra);
    expect(r.horario_bloque).toBe("3:00 p.m. – 7:00 p.m.");
    expect(r.duracion_horas).toBe(4);
  });

  it("sin hora de cierre le asume el bloque de dos horas de su propia agenda", () => {
    const r = aFilaReserva(fila({ horaInicio: "15:00" }), PROVEEDOR, extra);
    expect(r.hora_inicio).toBe("15:00");
    expect(r.duracion_minutos).toBe(120);
    // Sin cierre anotado no se inventa un texto de bloque.
    expect(r.horario_bloque).toBeUndefined();
  });

  it("una cita sin hora de cierre sigue durando 60 minutos", () => {
    const r = aFilaReserva(fila({ horaInicio: "09:00" }), CITAS, extra);
    expect(r.duracion_minutos).toBe(60);
    expect(r.horario_bloque).toBeUndefined();
  });

  it("un lugar para eventos NO escribe hora_inicio: su día es del cliente", () => {
    const r = aFilaReserva(fila({ horaInicio: "15:00", horaFin: "23:00" }), LUGAR, extra);
    expect(r.hora_inicio).toBeUndefined();
    expect(r.horario_bloque).toBe("3:00 p.m. – 11:00 p.m.");
    expect(r.duracion_horas).toBe(8);
  });

  it("un hospedaje sigue guardando el rango de noches", () => {
    const r = aFilaReserva(fila({ fechaFin: "2026-09-15" }), HOSPEDAJE, extra);
    expect(r.fecha_fin).toBe("2026-09-15");
    expect(r.hora_inicio).toBeUndefined();
  });
});

describe("detectarChoques — un proveedor choca por franja, no por día", () => {
  const dos = (a: Partial<FilaAgenda>, b: Partial<FilaAgenda>) => [fila(a), fila(b)];

  it("deja pasar dos servicios el mismo día si no se traslapan", () => {
    const filas = dos(
      { nombre: "Fiesta infantil", horaInicio: "15:00", horaFin: "17:00" },
      { nombre: "Boda", horaInicio: "21:00", horaFin: "23:00" },
    );
    expect(detectarChoques(filas, PROVEEDOR).size).toBe(0);
  });

  it("marca el traslape dentro del lote", () => {
    const filas = dos(
      { nombre: "Fiesta infantil", horaInicio: "15:00", horaFin: "19:00" },
      { nombre: "Boda", horaInicio: "18:00", horaFin: "23:00" },
    );
    const problemas = detectarChoques(filas, PROVEEDOR);
    expect(problemas.get(filas[1].id)).toMatch(/traslapa con Fiesta infantil/);
  });

  it("un lugar sigue chocando por DÍA, con cupo 1", () => {
    const filas = dos(
      { nombre: "Boda Marín", horaInicio: "15:00" },
      { nombre: "Quinceaños", horaInicio: "21:00" },
    );
    expect(detectarChoques(filas, LUGAR).get(filas[1].id)).toMatch(/cupo es 1 por día/);
  });

  it("al proveedor le sigue valiendo el cupo por día que haya declarado", () => {
    const negocio = base({ eventosPorDia: 1 });
    const filas = dos(
      { nombre: "Fiesta infantil", horaInicio: "15:00", horaFin: "17:00" },
      { nombre: "Boda", horaInicio: "21:00", horaFin: "23:00" },
    );
    expect(detectarChoques(filas, negocio).get(filas[1].id)).toMatch(/cupo es 1 por día/);
  });
});

describe("filasDeseadas — el .ics de Google", () => {
  const todoElDia: EventoImportado = {
    uid: "abc123",
    titulo: "Boda Marín",
    fecha: "2026-09-12",
    fechaFin: null,
    horaInicio: null,
    duracionMinutos: null,
  };

  it("un compromiso de día completo tapa el día entero en un negocio por horas", () => {
    const filas = [...filasDeseadas([todoElDia], true).values()];
    expect(filas).toHaveLength(1);
    expect(filas[0].horaInicio).toBe("00:00");
    expect(filas[0].duracionMinutos).toBe(1440);
  });

  it("uno de varios días se abre en una fila por día", () => {
    const filas = [...filasDeseadas([{ ...todoElDia, fechaFin: "2026-09-14" }], true).values()];
    expect(filas.map((f) => f.fecha)).toEqual(["2026-09-12", "2026-09-13", "2026-09-14"]);
    expect(filas.every((f) => f.horaInicio === "00:00" && f.duracionMinutos === 1440)).toBe(true);
  });

  it("en un lugar (por fecha) el mismo compromiso se guarda tal cual", () => {
    const filas = [...filasDeseadas([{ ...todoElDia, fechaFin: "2026-09-14" }], false).values()];
    expect(filas).toHaveLength(1);
    expect(filas[0].horaInicio).toBeNull();
    expect(filas[0].fechaFin).toBe("2026-09-14");
  });

  it("un compromiso CON hora no se toca en ningún caso", () => {
    const conHora: EventoImportado = {
      ...todoElDia,
      horaInicio: "15:00",
      duracionMinutos: 240,
    };
    for (const porFranja of [true, false]) {
      const filas = [...filasDeseadas([conHora], porFranja).values()];
      expect(filas[0].horaInicio, String(porFranja)).toBe("15:00");
      expect(filas[0].uid).toBe("abc123");
    }
  });
});
