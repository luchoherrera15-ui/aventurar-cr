import { describe, expect, it } from "vitest";
import { calcularDisponibilidad, type ParametrosDisponibilidad } from "./disponibilidad";
import { normalizarCupo } from "@/lib/reservas/tipo-reserva";

/**
 * FASE 2 — la concurrencia del recurso (`equipo_rancho.cupo_simultaneo`).
 *
 * Lo que estos tests protegen NO es la funcionalidad nueva: es que la
 * funcionalidad nueva no le cambie NADA a los negocios que ya operan.
 * La promesa del diseño es "con cupo 1 el motor se comporta exactamente
 * como antes", y el archivo entero existe para poder auditarla.
 *
 * Mismo negocio de mentira que disponibilidad.test.ts: lunes 2026-08-03,
 * Costa Rica (UTC-6 fijo), el negocio abre de 9 a 12.
 */

const LUNES = "2026-08-03";
const ZONA = "America/Costa_Rica";

function base(extra: Partial<ParametrosDisponibilidad> = {}): ParametrosDisponibilidad {
  return {
    fecha: LUNES,
    zonaHoraria: ZONA,
    horarioNegocio: { "1": { abre: "09:00", cierra: "12:00" } },
    recursos: [],
    duracionMinutos: 60,
    // Paso de una hora para que las listas esperadas se lean solas;
    // los casos que necesitan medias horas lo pisan.
    intervaloMinutos: 60,
    citas: [],
    bloqueos: [],
    ...extra,
  };
}

/** Un recurso con el cupo que se le pida (undefined = como antes). */
function sala(cupoSimultaneo?: number | null) {
  return { id: "sala", horario: null, cupoSimultaneo };
}

describe("normalizarCupo — todo lo raro cae en 1", () => {
  const casos: [unknown, number][] = [
    [null, 1],
    [undefined, 1],
    [0, 1],
    ["", 1],
    ["0", 1],
    [NaN, 1],
    [-5, 1],
    [2.7, 2],
    ["3", 3],
    [true, 1],
    [15, 15],
    // Un Infinity dejaría la agenda sin tope: se ata al mismo 100 del
    // CHECK de la base.
    [Infinity, 100],
    [1e999, 100],
    [500, 100],
  ];
  for (const [entrada, esperado] of casos) {
    it(`${String(entrada)} → ${esperado}`, () => {
      expect(normalizarCupo(entrada)).toBe(esperado);
    });
  }
});

describe("cupo 1 (y null, y ausente) se comporta como antes de la 0109", () => {
  const cita = {
    miembroId: "sala",
    horaInicio: "09:00",
    duracionMinutos: 60,
    exclusiva: false,
  };

  // Los tres deben dar EXACTAMENTE lo mismo: es la equivalencia que
  // sostiene toda la fase.
  for (const [etiqueta, cupo] of [
    ["sin la propiedad", undefined],
    ["con null", null],
    ["con 1 explícito", 1],
  ] as const) {
    it(`una cita ocupa la franja entera ${etiqueta}`, () => {
      const { porRecurso } = calcularDisponibilidad(
        base({ recursos: [sala(cupo)], citas: [cita] }),
      );
      expect(porRecurso.sala).toEqual(["10:00", "11:00"]);
    });
  }

  it("dos citas seguidas van tapando su propia franja", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(1)],
        citas: [cita, { ...cita, horaInicio: "10:00" }],
      }),
    );
    expect(porRecurso.sala).toEqual(["11:00"]);
  });

  it("el negocio sin equipo sigue siendo un recurso exclusivo", () => {
    // Sin recursos no hay dónde declarar concurrencia: el cupo es 1.
    const { porRecurso } = calcularDisponibilidad(
      base({ citas: [{ ...cita, miembroId: null }] }),
    );
    expect(porRecurso[""]).toEqual(["10:00", "11:00"]);
  });
});

describe("cupo 2 o más: caben varias en la misma franja", () => {
  const cita = (hora: string) => ({
    miembroId: "sala",
    horaInicio: hora,
    duracionMinutos: 60,
    exclusiva: false,
  });

  it("con cupo 2, una cita NO tapa la franja", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({ recursos: [sala(2)], citas: [cita("09:00")] }),
    );
    expect(porRecurso.sala).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("con cupo 2, dos citas SÍ la tapan", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({ recursos: [sala(2)], citas: [cita("09:00"), cita("09:00")] }),
    );
    expect(porRecurso.sala).toEqual(["10:00", "11:00"]);
  });

  it("con cupo 3, la tercera es la que llena", () => {
    const dos = calcularDisponibilidad(
      base({ recursos: [sala(3)], citas: [cita("09:00"), cita("09:00")] }),
    );
    expect(dos.porRecurso.sala).toContain("09:00");

    const tres = calcularDisponibilidad(
      base({
        recursos: [sala(3)],
        citas: [cita("09:00"), cita("09:00"), cita("09:00")],
      }),
    );
    expect(tres.porRecurso.sala).not.toContain("09:00");
  });

  it("el cupo es por recurso, no del negocio", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(2), { id: "silla", horario: null }],
        citas: [cita("09:00"), { ...cita("09:00"), miembroId: "silla" }],
      }),
    );
    // La sala aguanta otra; la silla (cupo 1) ya está tomada.
    expect(porRecurso.sala).toContain("09:00");
    expect(porRecurso.silla).not.toContain("09:00");
  });
});

describe("solapes: contiguas, parciales y contenidas", () => {
  const enSala = (horaInicio: string, duracionMinutos: number) => ({
    miembroId: "sala",
    horaInicio,
    duracionMinutos,
    exclusiva: false,
  });

  it("dos citas exactamente contiguas NO chocan (los rangos son semiabiertos)", () => {
    // 09:00-10:00 no estorba al espacio de las 10:00. Es el caso más
    // común de una barbería: back-to-back todo el día.
    const { porRecurso } = calcularDisponibilidad(
      base({ recursos: [sala(1)], citas: [enSala("09:00", 60)] }),
    );
    expect(porRecurso.sala).toContain("10:00");
  });

  it("un solape parcial sí choca", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(1)],
        citas: [enSala("09:30", 60)],
        intervaloMinutos: 30,
      }),
    );
    // 09:00-10:00 se monta sobre 09:30-10:30, y 10:00 también.
    expect(porRecurso.sala).not.toContain("09:00");
    expect(porRecurso.sala).not.toContain("10:00");
    expect(porRecurso.sala).toContain("10:30");
  });

  it("una cita que contiene a la franja también choca", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(1)],
        horarioNegocio: { "1": { abre: "09:00", cierra: "14:00" } },
        citas: [enSala("09:00", 180)],
      }),
    );
    expect(porRecurso.sala).toEqual(["12:00", "13:00"]);
  });

  it("con cupo 2, el solape parcial consume cupo igual", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(2)],
        citas: [enSala("09:30", 60), enSala("09:30", 60)],
        intervaloMinutos: 30,
      }),
    );
    expect(porRecurso.sala).not.toContain("09:00");
    expect(porRecurso.sala).toContain("10:30");
  });
});

describe("buffers", () => {
  it("el buffer de la cita existente sigue tapando, tenga el cupo que tenga", () => {
    const conBuffer = {
      miembroId: "sala",
      horaInicio: "09:00",
      duracionMinutos: 45,
      bufferMinutos: 15,
      exclusiva: false,
    };
    // Ocupa 09:00-10:00 (45 + 15). Con cupo 1 no hay espacio a las 09:00.
    const uno = calcularDisponibilidad(
      base({ recursos: [sala(1)], citas: [conBuffer], duracionMinutos: 60 }),
    );
    expect(uno.porRecurso.sala).toEqual(["10:00", "11:00"]);

    // Con cupo 2 el buffer sigue contando como ocupación, pero cabe otra.
    const dos = calcularDisponibilidad(
      base({ recursos: [sala(2)], citas: [conBuffer], duracionMinutos: 60 }),
    );
    expect(dos.porRecurso.sala).toContain("09:00");
  });

  it("el buffer del servicio consultado también consume cupo", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(2)],
        duracionMinutos: 45,
        bufferMinutos: 15,
        citas: [
          { miembroId: "sala", horaInicio: "10:00", duracionMinutos: 60, exclusiva: false },
          { miembroId: "sala", horaInicio: "10:00", duracionMinutos: 60, exclusiva: false },
        ],
        intervaloMinutos: 30,
      }),
    );
    // 09:30 + 45 + 15 = 10:30, se monta sobre las dos de las 10:00.
    expect(porRecurso.sala).not.toContain("09:30");
    expect(porRecurso.sala).toContain("09:00");
  });
});

describe("lo exclusivo tapa la franja entera aunque sobre cupo", () => {
  const bloqueoDelDueno = {
    miembroId: "sala",
    horaInicio: "09:00",
    duracionMinutos: 60,
    // Es lo que la vista marca para las reservas 'bloqueada': el
    // compromiso que el sync trae del calendario del dueño.
    exclusiva: true,
  };

  it("una reserva exclusiva tapa la franja con cupo 5", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({ recursos: [sala(5)], citas: [bloqueoDelDueno] }),
    );
    expect(porRecurso.sala).toEqual(["10:00", "11:00"]);
  });

  it("sin el dato, una cita se asume exclusiva (lado conservador)", () => {
    // Es lo que pasa mientras la vista no tenga la columna `exclusiva`:
    // preferimos no ofrecer la hora antes que dejar reservar encima.
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(5)],
        citas: [{ miembroId: "sala", horaInicio: "09:00", duracionMinutos: 60 }],
      }),
    );
    expect(porRecurso.sala).not.toContain("09:00");
  });

  it("los bloqueos de agenda siguen siendo exclusivos con cualquier cupo", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(5)],
        bloqueos: [
          { miembroId: null, inicio: "2026-08-03T15:00:00Z", fin: "2026-08-03T16:00:00Z" },
        ],
      }),
    );
    // 15:00Z = 09:00 en Costa Rica.
    expect(porRecurso.sala).toEqual(["10:00", "11:00"]);
  });
});

describe("las citas del negocio (sin miembro) estorban a todos los recursos", () => {
  it("con cupo 2, una cita sin miembro consume un cupo de cada recurso", () => {
    const { porRecurso } = calcularDisponibilidad(
      base({
        recursos: [sala(2)],
        citas: [
          { miembroId: null, horaInicio: "09:00", duracionMinutos: 60, exclusiva: false },
        ],
      }),
    );
    expect(porRecurso.sala).toContain("09:00");

    const llena = calcularDisponibilidad(
      base({
        recursos: [sala(2)],
        citas: [
          { miembroId: null, horaInicio: "09:00", duracionMinutos: 60, exclusiva: false },
          { miembroId: "sala", horaInicio: "09:00", duracionMinutos: 60, exclusiva: false },
        ],
      }),
    );
    expect(llena.porRecurso.sala).not.toContain("09:00");
  });
});
