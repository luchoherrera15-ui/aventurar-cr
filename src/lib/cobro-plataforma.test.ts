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
import { claveFecha, inicioDeSemana, rangoSemana } from "./finanzas";
// Las reglas del LIBRO (lo devengado) viven en el script de
// recuperación, que es el espejo en JavaScript del trigger de la 0106.
// Se prueban desde acá para que la cuenta que va a escribir plata en
// `cobros_plataforma` no sea la única del proyecto sin pruebas.
import {
  lunesDeSemana,
  montoCancelacion,
  montoDevengado,
  personasCobrables,
  planificar,
  resolverTarifa,
  totalPorCobrar,
} from "../../scripts/backfill-cobros-plataforma.mjs";

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

// ============================================================
// EL LIBRO DE COBROS (0106) — lo DEVENGADO, no la proyección.
//
// Estas pruebas fijan lo que el dueño pidió con sus palabras: "150
// colones por persona, reserva que se hace, reserva que se anota". Son
// el contrato de la plata: si alguien cambia el trigger o el script de
// recuperación y la cuenta deja de dar, se cae acá y no en la factura.
// ============================================================

describe("el ejemplo del dueño: 100 personas × ₡150", () => {
  it("da ₡15.000, y la proyección y el libro dan lo MISMO", () => {
    const r = reserva({ invitados: 100 });
    const tarifa = { modelo: "comision_por_persona", valor: 150 };

    // El libro (espejo del trigger).
    expect(montoDevengado(r, tarifa)).toBe(15000);
    // La proyección (src/lib/cobro-plataforma.ts).
    expect(ingresoPorReserva(r, resolverCobro("rancho-x", new Map(), 150))).toBe(15000);
  });

  it("la tarifa propia del negocio le gana al default global", () => {
    const r = reserva({ invitados: 10 });
    const propias = new Map([
      ["rancho-1", { rancho_id: "rancho-1", modelo: "comision_fija_reserva", valor: 5000 }],
    ]);
    expect(montoDevengado(r, resolverTarifa("rancho-1", propias, 150))).toBe(5000);
    // El que no tiene fila propia cae al global, igual que resolverCobro.
    expect(montoDevengado(r, resolverTarifa("rancho-2", propias, 150))).toBe(1500);
  });
});

describe("personasCobrables (libro)", () => {
  it("una reserva sin invitados cuenta como 1 persona, no 0", () => {
    expect(personasCobrables(null)).toBe(1);
    expect(personasCobrables(0)).toBe(1);
    expect(personasCobrables(undefined)).toBe(1);
    // Y por lo tanto deja plata, no ₡0.
    expect(montoDevengado({ invitados: null }, { modelo: "comision_por_persona", valor: 150 })).toBe(150);
  });

  it("nunca cobra por medias personas", () => {
    expect(personasCobrables(12.7)).toBe(12);
  });

  it("dice lo mismo que personasDeReserva de la proyección", () => {
    for (const invitados of [null, 0, 1, 37, 100]) {
      expect(personasCobrables(invitados)).toBe(
        personasDeReserva(reserva({ invitados })),
      );
    }
  });
});

describe("montoDevengado por modelo (espejo del trigger)", () => {
  it("porcentaje: manda lo cobrado real y redondea a colón entero", () => {
    const t = { modelo: "comision_porcentaje", valor: 7 };
    expect(montoDevengado({ monto_total: 100000, monto_cobrado_final: 80000 }, t)).toBe(5600);
    // 33.333 × 7 % = 2333,31 → ₡2.333
    expect(montoDevengado({ monto_total: 33333, monto_cobrado_final: null }, t)).toBe(2333);
  });

  it("membresía y gratis no devengan por reserva", () => {
    expect(montoDevengado({ invitados: 50 }, { modelo: "membresia_mensual", valor: 25000 })).toBe(0);
    expect(montoDevengado({ invitados: 50 }, { modelo: "gratis", valor: 0 })).toBe(0);
  });
});

describe("cancelación: el 10 % del depósito retenido", () => {
  it("cobra el 10 %, redondeado al colón", () => {
    expect(montoCancelacion(25000)).toBe(2500);
    // 25.555 × 10 % = 2555,5 → ₡2.556
    expect(montoCancelacion(25555)).toBe(2556);
  });

  it("sin depósito no hay nada que cobrar", () => {
    expect(montoCancelacion(0)).toBe(0);
    expect(montoCancelacion(null)).toBe(0);
    expect(montoCancelacion(undefined)).toBe(0);
  });
});

describe("la semana de corte: lunes a domingo", () => {
  it("el lunes es el inicio y el domingo el cierre", () => {
    // 10 ago 2026 es lunes; 16 ago, domingo.
    expect(lunesDeSemana("2026-08-12T15:00:00Z")).toBe("2026-08-10");
    expect(claveFecha(inicioDeSemana(new Date(2026, 7, 16)))).toBe("2026-08-10");
    expect(rangoSemana(new Date(2026, 7, 10))).toBe("10 – 16 ago");
  });

  it("el domingo y el lunes siguiente caen en semanas DISTINTAS", () => {
    // Domingo 9 de agosto, 8 p. m. en Costa Rica.
    expect(lunesDeSemana("2026-08-10T02:00:00Z")).toBe("2026-08-03");
    // Lunes 10 de agosto, 1 a. m. en Costa Rica: ya es otra semana.
    expect(lunesDeSemana("2026-08-10T07:00:00Z")).toBe("2026-08-10");
  });

  it("usa la hora de Costa Rica, no la del servidor", () => {
    // 05:59 UTC del lunes todavía es domingo 11:59 p. m. acá: cuenta
    // en la semana que cierra, no en la que abre.
    expect(lunesDeSemana("2026-08-10T05:59:00Z")).toBe("2026-08-03");
    expect(lunesDeSemana("2026-08-10T06:00:00Z")).toBe("2026-08-10");
  });

  it("sin fecha usable no inventa semana", () => {
    expect(lunesDeSemana(null)).toBeNull();
    expect(lunesDeSemana("cualquier cosa")).toBeNull();
  });
});

describe("totalPorCobrar: qué suma y qué no", () => {
  const libro = [
    { estado: "pendiente", monto: 15000 },
    { estado: "pendiente", monto: 3000 },
    { estado: "pagado", monto: 900000 },
    { estado: "anulado", monto: 750000 },
  ];

  it("solo lo pendiente: lo anulado no suma y lo pagado tampoco", () => {
    expect(totalPorCobrar(libro)).toBe(18000);
  });

  it("un libro sin pendientes debe ₡0", () => {
    expect(totalPorCobrar(libro.filter((c) => c.estado !== "pendiente"))).toBe(0);
  });
});

describe("planificar: la recuperación de lo ya confirmado", () => {
  const tarifas = new Map<string, { rancho_id: string; modelo: string; valor: number }>();
  const base = {
    id: "res-1",
    fecha: "2026-09-12",
    nombre: "Karla Jiménez",
    invitados: 100,
    rancho_id: "rancho-1",
    monto_total: 400000,
    monto_cobrado_final: null,
    created_at: "2026-08-12T15:00:00Z",
  };

  it("arma el asiento con el monto congelado y la semana del created_at", () => {
    const { filas } = planificar({
      reservas: [base],
      tarifasPorRancho: tarifas,
      comisionGlobal: 150,
    });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      reserva_id: "res-1",
      rancho_id: "rancho-1",
      concepto: "reserva",
      personas: 100,
      tarifa: 150,
      modelo: "comision_por_persona",
      monto: 15000,
      estado: "pendiente",
      semana: "2026-08-10",
      cliente: "Karla Jiménez",
      fecha_evento: "2026-09-12",
    });
    // Queda marcada: lo recuperado se distingue de lo que anota el trigger.
    expect(String(filas[0].notas)).toContain("recuperado");
  });

  it("correrlo dos veces no duplica: se salta lo que ya tiene asiento", () => {
    const { filas, omitidas } = planificar({
      reservas: [base],
      tarifasPorRancho: tarifas,
      comisionGlobal: 150,
      yaConAsiento: new Set(["res-1"]),
    });
    expect(filas).toHaveLength(0);
    expect(omitidas.yaTenian).toBe(1);
  });

  it("no anota lo que no cobra: membresía, gratis, tarifa en ₡0 o sin negocio", () => {
    const conMembresia = new Map([
      ["rancho-m", { rancho_id: "rancho-m", modelo: "membresia_mensual", valor: 25000 }],
      ["rancho-g", { rancho_id: "rancho-g", modelo: "gratis", valor: 0 }],
    ]);
    const { filas, omitidas } = planificar({
      reservas: [
        { ...base, id: "a", rancho_id: "rancho-m" },
        { ...base, id: "b", rancho_id: "rancho-g" },
        { ...base, id: "c", rancho_id: null },
        { ...base, id: "d", rancho_id: "rancho-1" }, // global en ₡0
      ],
      tarifasPorRancho: conMembresia,
      comisionGlobal: 0,
    });
    expect(filas).toHaveLength(0);
    expect(omitidas).toMatchObject({ sinCobro: 2, sinNegocio: 1, montoCero: 1 });
  });

  it("suma lo mismo que la proyección cuando la tarifa no cambió", () => {
    const reservas = [
      { ...base, id: "a", invitados: 100 },
      { ...base, id: "b", invitados: 25 },
      { ...base, id: "c", invitados: null },
    ];
    const { filas } = planificar({
      reservas,
      tarifasPorRancho: tarifas,
      comisionGlobal: 150,
    });
    const devengado = totalPorCobrar(filas);
    const global = resolverCobro("rancho-1", new Map(), 150);
    const proyectado = reservas.reduce(
      (acc, r) => acc + ingresoPorReserva(reserva({ id: r.id, invitados: r.invitados }), global),
      0,
    );
    expect(devengado).toBe(proyectado);
    expect(devengado).toBe(150 * (100 + 25 + 1));
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
