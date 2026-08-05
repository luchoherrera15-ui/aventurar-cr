import { describe, expect, it } from "vitest";
import {
  adelantoCobrado,
  resumenFinanciero,
  saldoPendiente,
  type ReservaFinanzas,
} from "./finanzas";

// "Hoy" fijo para que los tests no dependan del reloj: 15 de julio 2026.
const HOY = new Date(2026, 6, 15);

function reserva(overrides: Partial<ReservaFinanzas>): ReservaFinanzas {
  return {
    id: overrides.id ?? "r1",
    fecha: "2026-07-20",
    nombre: "Cliente",
    tipo_evento: "Cumpleaños",
    invitados: 30,
    estado: "confirmada",
    monto_total: 100000,
    monto_cobrado_final: null,
    deposito_monto: 25000,
    deposito_validado: false,
    deposito_pagado_en: null,
    evento_pagado: false,
    saldo_pagado_en: null,
    ...overrides,
  };
}

describe("adelantoCobrado", () => {
  it("sin validar no es ingreso", () => {
    expect(adelantoCobrado(reserva({ deposito_validado: false }))).toBe(0);
  });

  it("validado cuenta completo", () => {
    expect(adelantoCobrado(reserva({ deposito_validado: true }))).toBe(25000);
  });

  it("devuelto deja de contar aunque estuviera validado", () => {
    expect(
      adelantoCobrado(reserva({ deposito_validado: true, adelanto_devuelto: true })),
    ).toBe(0);
  });
});

describe("resumenFinanciero — cancelaciones y los dos ejes", () => {
  it("una cancelada con adelanto validado SIGUE contando en lo cobrado (retenido)", () => {
    const r = reserva({
      estado: "rechazada",
      deposito_validado: true,
      deposito_pagado_en: "2026-07-10T12:00:00Z",
    });
    const res = resumenFinanciero({ reservas: [r], gastos: [], hoy: HOY });
    expect(res.entroEsteMes).toBe(25000);
    expect(res.cobradoAdelantos).toBe(25000);
    // ...pero no debe nada: su saldo no aparece en el eje prospectivo.
    expect(res.porCobrarTotal).toBe(0);
    expect(res.cobrosProximos).toHaveLength(0);
    // Y queda auditada en la lista de retenidos.
    expect(res.adelantosRetenidos.map((x) => x.id)).toEqual([r.id]);
  });

  it("una cancelada con adelanto DEVUELTO sale de todos los números", () => {
    const r = reserva({
      estado: "rechazada",
      deposito_validado: true,
      deposito_pagado_en: "2026-07-10T12:00:00Z",
      adelanto_devuelto: true,
    });
    const res = resumenFinanciero({ reservas: [r], gastos: [], hoy: HOY });
    expect(res.entroEsteMes).toBe(0);
    expect(res.cobradoTotal).toBe(0);
    expect(res.adelantosRetenidos).toHaveLength(0);
  });

  it("una viva normal suma en ambos ejes sin doble conteo", () => {
    const r = reserva({
      deposito_validado: true,
      deposito_pagado_en: "2026-07-10T12:00:00Z",
    });
    const res = resumenFinanciero({ reservas: [r], gastos: [], hoy: HOY });
    expect(res.entroEsteMes).toBe(25000);
    // El saldo pendiente descuenta el adelanto una sola vez.
    expect(res.porCobrarTotal).toBe(75000);
    expect(res.totalComprometido).toBe(100000);
  });

  it("bloqueadas y holds temporales nunca son plata", () => {
    const bloqueada = reserva({
      id: "b1",
      estado: "bloqueada",
      deposito_validado: true,
    });
    const temporal = reserva({
      id: "t1",
      estado: "temporal",
      deposito_validado: true,
    });
    const res = resumenFinanciero({ reservas: [bloqueada, temporal], gastos: [], hoy: HOY });
    expect(res.cobradoTotal).toBe(0);
    expect(res.porCobrarTotal).toBe(0);
    expect(res.adelantosRetenidos).toHaveLength(0);
  });

  it("desglosa el mes entre adelantos y saldos", () => {
    const r = reserva({
      fecha: "2026-07-05",
      deposito_validado: true,
      deposito_pagado_en: "2026-07-01T12:00:00Z",
      evento_pagado: true,
      saldo_pagado_en: "2026-07-05T22:00:00Z",
    });
    const res = resumenFinanciero({ reservas: [r], gastos: [], hoy: HOY });
    expect(res.entroEsteMesAdelantos).toBe(25000);
    expect(res.entroEsteMesSaldos).toBe(75000);
    expect(res.entroEsteMes).toBe(100000);
  });
});

describe("saldoPendiente", () => {
  it("descuenta el adelanto aunque no esté validado (ya lo transfirieron)", () => {
    expect(saldoPendiente(reserva({}))).toBe(75000);
  });

  it("evento pagado no debe nada", () => {
    expect(saldoPendiente(reserva({ evento_pagado: true }))).toBe(0);
  });
});
