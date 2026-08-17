import { describe, expect, it } from "vitest";
import {
  construirAuditoria,
  filtrarAuditoria,
  FILTRO_VACIO,
  lineaDeTiempo,
  montoEsperadoDelCobro,
  personasCongeladasVsHoy,
  resumirAuditoria,
  type ReservaAuditoria,
} from "./auditoria-dinero";
import type { CobroPlataforma } from "./libro-cobros";

const HOY = "2026-08-17";
const NOMBRES = { r1: "Rancho El Guayabo", r2: "Salón Los Almendros" };

function reserva(over: Partial<ReservaAuditoria> = {}): ReservaAuditoria {
  return {
    id: "res1",
    rancho_id: "r1",
    fecha: "2026-08-10",
    nombre: "María Rojas",
    tipo_evento: "boda",
    invitados: 100,
    estado: "confirmada",
    monto_total: 500_000,
    monto_cobrado_final: null,
    deposito_monto: 100_000,
    deposito_validado: true,
    deposito_pagado_en: "2026-08-01T15:00:00.000Z",
    evento_pagado: false,
    saldo_pagado_en: null,
    adelanto_devuelto: false,
    metodo_pago: "sinpe",
    tiene_comprobante: true,
    created_at: "2026-07-30T10:00:00.000Z",
    ...over,
  };
}

function cobro(over: Partial<CobroPlataforma> = {}): CobroPlataforma {
  return {
    id: "c1",
    reserva_id: "res1",
    rancho_id: "r1",
    concepto: "reserva",
    personas: 100,
    tarifa: 150,
    modelo: "comision_por_persona",
    monto: 15_000,
    estado: "pendiente",
    semana: "2026-07-27",
    cliente: "María Rojas",
    fecha_evento: "2026-08-10",
    devengado_en: "2026-07-30T10:05:00.000Z",
    pagado_en: null,
    notas: null,
    ...over,
  };
}

function armar(
  reservas: ReservaAuditoria[],
  cobros: CobroPlataforma[],
  comisionGlobal = 150,
) {
  return construirAuditoria({
    reservas,
    cobros,
    nombrePorRancho: NOMBRES,
    cobrosNegocio: [],
    comisionGlobal,
    hoyIso: HOY,
  });
}

describe("montoEsperadoDelCobro", () => {
  it("recalcula los modelos que se sostienen solos", () => {
    expect(montoEsperadoDelCobro(cobro({ personas: 40, tarifa: 150 }))).toBe(6000);
    expect(
      montoEsperadoDelCobro(
        cobro({ modelo: "comision_fija_reserva", tarifa: 5000, personas: 1 }),
      ),
    ).toBe(5000);
  });

  it("NO recalcula los porcentajes: su base pudo cambiar después", () => {
    expect(montoEsperadoDelCobro(cobro({ modelo: "comision_porcentaje" }))).toBeNull();
    expect(montoEsperadoDelCobro(cobro({ modelo: "porcentaje_deposito" }))).toBeNull();
  });
});

describe("construirAuditoria — el recorrido de la plata", () => {
  it("separa el adelanto pactado del que de verdad entró", () => {
    const [f] = armar([reserva({ deposito_validado: false })], []);
    expect(f.adelantoPactado).toBe(100_000);
    expect(f.adelantoEnCaja).toBe(0);
    // El saldo descuenta el adelanto aunque no esté validado.
    expect(f.saldoPorCobrar).toBe(400_000);
  });

  it("un adelanto devuelto deja de ser plata del negocio", () => {
    const [f] = armar([reserva({ adelanto_devuelto: true })], []);
    expect(f.adelantoEnCaja).toBe(0);
  });

  it("cancelar no des-cobra el adelanto retenido", () => {
    const [f] = armar([reserva({ estado: "cancelada" })], []);
    expect(f.adelantoEnCaja).toBe(100_000);
    // Pero una reserva muerta ya no debe saldo a futuro.
    expect(f.saldoPorCobrar).toBe(0);
  });

  it("suma lo devengado, lo cobrado y lo anulado por separado", () => {
    const [f] = armar(
      [reserva()],
      [
        cobro({ id: "c1", monto: 15_000, estado: "pagado", pagado_en: "2026-08-05T12:00:00.000Z" }),
        cobro({ id: "c2", concepto: "cancelacion", modelo: "porcentaje_deposito", tarifa: 10, monto: 10_000 }),
        cobro({ id: "c3", monto: 9_000, estado: "anulado" }),
      ],
    );
    expect(f.comisionDevengada).toBe(25_000);
    expect(f.comisionCobrada).toBe(15_000);
    expect(f.comisionAnulada).toBe(9_000);
  });
});

describe("alertas", () => {
  it("detecta dos cobros vivos del mismo concepto", () => {
    const [f] = armar([reserva()], [cobro({ id: "c1" }), cobro({ id: "c2" })]);
    expect(f.alertas).toContain("cobro_duplicado");
    expect(f.detalles.join(" ")).toContain("2 cobros vivos");
  });

  it("un anulado más un vivo NO es duplicado", () => {
    const [f] = armar(
      [reserva()],
      [cobro({ id: "c1", estado: "anulado" }), cobro({ id: "c2" })],
    );
    expect(f.alertas).not.toContain("cobro_duplicado");
  });

  it("detecta el monto que no cuadra con su propia tarifa", () => {
    const [f] = armar([reserva()], [cobro({ personas: 100, tarifa: 150, monto: 12_000 })]);
    expect(f.alertas).toContain("monto_descuadrado");
  });

  it("no acusa de descuadre a un cobro por porcentaje", () => {
    const [f] = armar(
      [reserva()],
      [cobro({ modelo: "comision_porcentaje", tarifa: 5, monto: 1 })],
    );
    expect(f.alertas).not.toContain("monto_descuadrado");
  });

  it("marca el evento pasado sin cobro de plataforma", () => {
    const [f] = armar([reserva({ fecha: "2026-08-01" })], []);
    expect(f.alertas).toContain("sin_cobro_plataforma");
  });

  it("no lo marca si el evento todavía no pasó", () => {
    const [f] = armar([reserva({ fecha: "2026-09-01" })], []);
    expect(f.alertas).not.toContain("sin_cobro_plataforma");
  });

  it("no lo marca si la tarifa del negocio no cobra por reserva", () => {
    const filas = construirAuditoria({
      reservas: [reserva({ fecha: "2026-08-01" })],
      cobros: [],
      nombrePorRancho: NOMBRES,
      cobrosNegocio: [{ rancho_id: "r1", modelo: "gratis", valor: 0 }],
      comisionGlobal: 150,
      hoyIso: HOY,
    });
    expect(filas[0].alertas).not.toContain("sin_cobro_plataforma");
  });

  it("un cobro anulado no salva a un evento pasado", () => {
    const [f] = armar(
      [reserva({ fecha: "2026-08-01" })],
      [cobro({ estado: "anulado" })],
    );
    expect(f.alertas).toContain("sin_cobro_plataforma");
  });

  it("cuenta los días que lleva esperando un depósito sin validar", () => {
    const [f] = armar(
      [
        reserva({
          fecha: "2026-09-20",
          deposito_validado: false,
          deposito_pagado_en: null,
          created_at: "2026-08-05T10:00:00.000Z",
        }),
      ],
      [cobro({ fecha_evento: "2026-09-20" })],
    );
    expect(f.diasEsperandoDeposito).toBe(12);
    expect(f.alertas).toContain("deposito_sin_validar");
  });

  it("un depósito de ayer todavía no es alerta", () => {
    const [f] = armar(
      [
        reserva({
          fecha: "2026-09-20",
          deposito_validado: false,
          deposito_pagado_en: null,
          created_at: "2026-08-16T10:00:00.000Z",
        }),
      ],
      [cobro({ fecha_evento: "2026-09-20" })],
    );
    expect(f.diasEsperandoDeposito).toBe(1);
    expect(f.alertas).not.toContain("deposito_sin_validar");
  });

  it("cuenta los días en hora de Costa Rica, no en UTC", () => {
    // 03:00 UTC del 15 = 21:00 del 14 en Costa Rica. Contra el string
    // UTC daría 2 días (sin alerta); contra el día tico da 3 (con).
    const [f] = armar(
      [
        reserva({
          fecha: "2026-09-20",
          deposito_validado: false,
          deposito_pagado_en: null,
          created_at: "2026-08-15T03:00:00.000Z",
        }),
      ],
      [cobro({ fecha_evento: "2026-09-20" })],
    );
    expect(f.diasEsperandoDeposito).toBe(3);
    expect(f.alertas).toContain("deposito_sin_validar");
  });

  it("marca el validado sin fecha (el rastro que falta)", () => {
    const [f] = armar([reserva({ deposito_pagado_en: null })], [cobro()]);
    expect(f.alertas).toContain("validado_sin_fecha");
  });

  it("una reserva sana no levanta ninguna alerta", () => {
    const [f] = armar([reserva({ fecha: "2026-09-20" })], [cobro({ fecha_evento: "2026-09-20" })]);
    expect(f.alertas).toEqual([]);
  });
});

describe("resumirAuditoria — los totales cuadran con lo listado", () => {
  it("suma exactamente las filas que recibe", () => {
    const filas = armar(
      [
        reserva({ id: "res1" }),
        reserva({ id: "res2", rancho_id: "r2", monto_total: 200_000, deposito_monto: 50_000 }),
      ],
      [
        cobro({ id: "c1", reserva_id: "res1", monto: 15_000 }),
        cobro({
          id: "c2",
          reserva_id: "res2",
          rancho_id: "r2",
          monto: 7_500,
          estado: "pagado",
          pagado_en: "2026-08-06T12:00:00.000Z",
        }),
      ],
    );
    const r = resumirAuditoria(filas);
    expect(r.reservas).toBe(2);
    expect(r.totalEventos).toBe(700_000);
    expect(r.adelantosEnCaja).toBe(150_000);
    expect(r.comisionDevengada).toBe(22_500);
    expect(r.comisionCobrada).toBe(7_500);
    expect(r.comisionPorCobrar).toBe(15_000);
  });

  it("el resumen de un subconjunto suma solo ese subconjunto", () => {
    const filas = armar(
      [reserva({ id: "res1" }), reserva({ id: "res2", monto_total: 200_000 })],
      [],
    );
    const soloUna = resumirAuditoria(filas.slice(0, 1));
    expect(soloUna.reservas).toBe(1);
    expect(soloUna.totalEventos).toBe(500_000);
  });

  it("cuenta una sola vez la reserva con varias alertas", () => {
    const filas = armar(
      [reserva({ fecha: "2026-08-01", deposito_pagado_en: null })],
      [],
    );
    const r = resumirAuditoria(filas);
    expect(filas[0].alertas.length).toBeGreaterThan(1);
    expect(r.conAlertas).toBe(1);
    expect(r.porAlerta.sin_cobro_plataforma).toBe(1);
    expect(r.porAlerta.validado_sin_fecha).toBe(1);
  });
});

describe("filtrarAuditoria", () => {
  const filas = armar(
    [
      reserva({ id: "res1", nombre: "María Rojas", fecha: "2026-09-20" }),
      reserva({ id: "res2", nombre: "Carlos Mora", fecha: "2026-08-01", rancho_id: "r2" }),
    ],
    [cobro({ reserva_id: "res1", fecha_evento: "2026-09-20" })],
  );

  it("sin filtro devuelve todo", () => {
    expect(filtrarAuditoria(filas, FILTRO_VACIO)).toHaveLength(2);
  });

  it("filtra por alerta", () => {
    const soloSinCobro = filtrarAuditoria(filas, {
      ...FILTRO_VACIO,
      alerta: "sin_cobro_plataforma",
    });
    expect(soloSinCobro.map((f) => f.reserva.id)).toEqual(["res2"]);
  });

  it("busca por cliente y por negocio, sin distinguir mayúsculas", () => {
    expect(
      filtrarAuditoria(filas, { ...FILTRO_VACIO, busqueda: "carlos" }),
    ).toHaveLength(1);
    expect(
      filtrarAuditoria(filas, { ...FILTRO_VACIO, busqueda: "almendros" }),
    ).toHaveLength(1);
  });

  it("solo problemas deja fuera a las sanas", () => {
    const conAlerta = filtrarAuditoria(filas, { ...FILTRO_VACIO, soloProblemas: true });
    expect(conAlerta.map((f) => f.reserva.id)).toEqual(["res2"]);
  });
});

describe("lineaDeTiempo", () => {
  it("no inventa hitos que la base no sostiene", () => {
    const [f] = armar(
      [reserva({ fecha: "2026-09-20", deposito_monto: 0, deposito_validado: false })],
      [],
    );
    const claves = lineaDeTiempo(f).map((h) => h.clave);
    expect(claves).toContain("creada");
    expect(claves.some((c) => c.startsWith("adelanto"))).toBe(false);
    expect(claves).toContain("sin-cobro");
  });

  it("dice «sin fecha registrada» en vez de inventar una", () => {
    const [f] = armar([reserva({ deposito_pagado_en: null })], [cobro()]);
    const hito = lineaDeTiempo(f).find((h) => h.clave === "adelanto-validado");
    expect(hito?.cuando).toBe("sin fecha registrada");
    expect(hito?.estado).toBe("alerta");
  });

  it("pone el cobro devengado y su pago como dos hitos", () => {
    const [f] = armar(
      [reserva()],
      [cobro({ estado: "pagado", pagado_en: "2026-08-06T12:00:00.000Z" })],
    );
    const claves = lineaDeTiempo(f).map((h) => h.clave);
    expect(claves).toContain("cobro-c1");
    expect(claves).toContain("cobro-pagado-c1");
  });

  it("no afirma quién acreditó el saldo", () => {
    const [f] = armar(
      [reserva({ evento_pagado: true, saldo_pagado_en: "2026-08-10T05:00:00.000Z" })],
      [cobro()],
    );
    const hito = lineaDeTiempo(f).find((h) => h.clave === "saldo-cobrado");
    expect(hito?.detalle).toContain("no distingue");
  });
});

describe("personasCongeladasVsHoy", () => {
  it("avisa cuando la reserva cambió después de congelarse el cobro", () => {
    const [f] = armar([reserva({ invitados: 120 })], [cobro({ personas: 100 })]);
    expect(personasCongeladasVsHoy(f)).toEqual({ congeladas: 100, hoy: 120 });
  });

  it("calla cuando coinciden", () => {
    const [f] = armar([reserva({ invitados: 100 })], [cobro({ personas: 100 })]);
    expect(personasCongeladasVsHoy(f)).toBeNull();
  });

  it("calla si el modelo no es por persona", () => {
    const [f] = armar(
      [reserva({ invitados: 120 })],
      [cobro({ modelo: "comision_fija_reserva", personas: 1, tarifa: 5000, monto: 5000 })],
    );
    expect(personasCongeladasVsHoy(f)).toBeNull();
  });
});
