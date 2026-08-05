import { describe, expect, it } from "vitest";
import {
  desglose,
  etiquetaCobro,
  ingresoMembresia,
  ingresoPorRancho,
  ingresoPorReserva,
  mesesDelRango,
  personasDeReserva,
  resolverCobro,
  type CobroNegocio,
  type ReservaCobro,
} from "./cobro-plataforma";

const DESDE = new Date(2026, 6, 1); // 1 jul 2026
const HASTA = new Date(2026, 7, 31); // 31 ago 2026

function reserva(overrides: Partial<ReservaCobro>): ReservaCobro {
  return {
    id: overrides.id ?? "r1",
    fecha: "2026-07-10",
    invitados: 25,
    rancho_id: "rancho-1",
    monto_total: 100000,
    monto_cobrado_final: null,
    ...overrides,
  };
}

function cobroPropio(overrides: Partial<CobroNegocio>): Map<string, CobroNegocio> {
  return new Map([
    [
      "rancho-1",
      {
        rancho_id: "rancho-1",
        modelo: "comision_por_persona",
        valor: 150,
        ...overrides,
      } as CobroNegocio,
    ],
  ]);
}

describe("resolverCobro", () => {
  it("sin fila propia cae al global (₡/persona) y lo marca", () => {
    const c = resolverCobro("rancho-x", new Map(), 200);
    expect(c).toMatchObject({ modelo: "comision_por_persona", valor: 200, esGlobal: true });
  });

  it("con fila propia la usa", () => {
    const c = resolverCobro("rancho-1", cobroPropio({ modelo: "gratis", valor: 0 }), 200);
    expect(c).toMatchObject({ modelo: "gratis", esGlobal: false });
  });
});

describe("personasDeReserva", () => {
  it("una cita sin invitados cuenta como 1 persona, no 0", () => {
    expect(personasDeReserva(reserva({ invitados: null }))).toBe(1);
    expect(personasDeReserva(reserva({ invitados: 0 }))).toBe(1);
    expect(personasDeReserva(reserva({ invitados: 40 }))).toBe(40);
  });
});

describe("ingresoPorReserva", () => {
  it("por persona: personas × valor", () => {
    const c = resolverCobro("rancho-x", new Map(), 150);
    expect(ingresoPorReserva(reserva({ invitados: 25 }), c)).toBe(3750);
  });

  it("porcentaje: usa el total del evento (manda lo cobrado real)", () => {
    const c = resolverCobro(
      "rancho-1",
      cobroPropio({ modelo: "comision_porcentaje", valor: 10 }),
      0,
    );
    expect(ingresoPorReserva(reserva({ monto_total: 100000 }), c)).toBe(10000);
    expect(
      ingresoPorReserva(reserva({ monto_total: 100000, monto_cobrado_final: 80000 }), c),
    ).toBe(8000);
  });

  it("porcentaje sin monto aporta 0 (y se cuenta aparte como sinMonto)", () => {
    const c = resolverCobro(
      "rancho-1",
      cobroPropio({ modelo: "comision_porcentaje", valor: 10 }),
      0,
    );
    expect(ingresoPorReserva(reserva({ monto_total: null }), c)).toBe(0);
  });

  it("fija por reserva: siempre el valor", () => {
    const c = resolverCobro(
      "rancho-1",
      cobroPropio({ modelo: "comision_fija_reserva", valor: 5000 }),
      0,
    );
    expect(ingresoPorReserva(reserva({}), c)).toBe(5000);
  });

  it("membresía y gratis no cobran por reserva", () => {
    const m = resolverCobro(
      "rancho-1",
      cobroPropio({ modelo: "membresia_mensual", valor: 25000 }),
      0,
    );
    const g = resolverCobro("rancho-1", cobroPropio({ modelo: "gratis", valor: 0 }), 0);
    expect(ingresoPorReserva(reserva({}), m)).toBe(0);
    expect(ingresoPorReserva(reserva({}), g)).toBe(0);
  });
});

describe("ingresoMembresia", () => {
  it("valor × meses calendario del rango; mes parcial cuenta entero", () => {
    const c = resolverCobro(
      "rancho-1",
      cobroPropio({ modelo: "membresia_mensual", valor: 25000 }),
      0,
    );
    // 15 jul → 10 ago toca julio Y agosto: 2 meses enteros.
    expect(ingresoMembresia(c, new Date(2026, 6, 15), new Date(2026, 7, 10))).toBe(50000);
  });

  it("otros modelos dan 0", () => {
    const c = resolverCobro("rancho-x", new Map(), 150);
    expect(ingresoMembresia(c, DESDE, HASTA)).toBe(0);
  });
});

describe("mesesDelRango", () => {
  it("cruza el año sin perderse meses", () => {
    expect(mesesDelRango(new Date(2026, 10, 20), new Date(2027, 0, 5))).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });
});

describe("desglose", () => {
  const c = resolverCobro("rancho-x", new Map(), 100);

  it("por día incluye buckets vacíos (sin huecos) y suma donde corresponde", () => {
    const filas = desglose(
      [reserva({ fecha: "2026-07-02", invitados: 10 })],
      c,
      new Date(2026, 6, 1),
      new Date(2026, 6, 3),
      "dia",
    );
    expect(filas).toHaveLength(3);
    expect(filas.map((f) => f.ingreso)).toEqual([0, 1000, 0]);
  });

  it("por semana agrupa con lunes como inicio", () => {
    // 6 jul 2026 es lunes; el 8 y el 12 caen en esa misma semana.
    const filas = desglose(
      [
        reserva({ id: "a", fecha: "2026-07-08", invitados: 10 }),
        reserva({ id: "b", fecha: "2026-07-12", invitados: 5 }),
      ],
      c,
      new Date(2026, 6, 6),
      new Date(2026, 6, 12),
      "semana",
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ reservas: 2, personas: 15, ingreso: 1500 });
  });

  it("por mes usa meses calendario", () => {
    const filas = desglose(
      [
        reserva({ id: "a", fecha: "2026-07-08" }),
        reserva({ id: "b", fecha: "2026-08-20" }),
      ],
      c,
      DESDE,
      HASTA,
      "mes",
    );
    expect(filas.map((f) => f.clave)).toEqual(["2026-07", "2026-08"]);
    expect(filas[0].reservas).toBe(1);
    expect(filas[1].reservas).toBe(1);
  });

  it("ignora reservas fuera del rango", () => {
    const filas = desglose(
      [reserva({ fecha: "2026-09-01" })],
      c,
      DESDE,
      HASTA,
      "mes",
    );
    expect(filas.every((f) => f.reservas === 0)).toBe(true);
  });
});

describe("ingresoPorRancho", () => {
  it("cada negocio con su tarifa; el resto con la global", () => {
    const cobros = cobroPropio({ modelo: "comision_fija_reserva", valor: 5000 });
    const filas = ingresoPorRancho(
      [
        reserva({ id: "a", rancho_id: "rancho-1" }),
        reserva({ id: "b", rancho_id: "rancho-2", invitados: 10 }),
      ],
      cobros,
      100,
      DESDE,
      HASTA,
    );
    expect(filas.get("rancho-1")?.ingreso).toBe(5000);
    expect(filas.get("rancho-1")?.cobro.esGlobal).toBe(false);
    expect(filas.get("rancho-2")?.ingreso).toBe(1000);
    expect(filas.get("rancho-2")?.cobro.esGlobal).toBe(true);
  });

  it("la membresía entra aunque el negocio no tenga reservas en el rango", () => {
    const cobros = cobroPropio({ modelo: "membresia_mensual", valor: 25000 });
    const filas = ingresoPorRancho([], cobros, 100, DESDE, HASTA);
    // jul + ago = 2 meses.
    expect(filas.get("rancho-1")?.ingreso).toBe(50000);
    expect(filas.get("rancho-1")?.reservas).toBe(0);
  });

  it("cuenta las reservas sin monto para avisar en la UI", () => {
    const cobros = cobroPropio({ modelo: "comision_porcentaje", valor: 10 });
    const filas = ingresoPorRancho(
      [
        reserva({ id: "a", monto_total: null }),
        reserva({ id: "b", monto_total: 200000 }),
      ],
      cobros,
      0,
      DESDE,
      HASTA,
    );
    expect(filas.get("rancho-1")?.sinMonto).toBe(1);
    expect(filas.get("rancho-1")?.ingreso).toBe(20000);
  });
});

describe("etiquetaCobro", () => {
  it("marca el global y formatea cada modelo", () => {
    expect(etiquetaCobro(resolverCobro("x", new Map(), 150))).toBe("₡150/persona (global)");
    expect(
      etiquetaCobro(
        resolverCobro("rancho-1", cobroPropio({ modelo: "comision_porcentaje", valor: 8 }), 0),
      ),
    ).toBe("8% del evento");
    expect(
      etiquetaCobro(
        resolverCobro("rancho-1", cobroPropio({ modelo: "gratis", valor: 0 }), 0),
      ),
    ).toBe("Gratis");
  });
});
