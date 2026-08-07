import { describe, expect, it } from "vitest";
import { actividadReciente, type ReservaAuditoria } from "./metricas";

function reserva(overrides: Partial<ReservaAuditoria>): ReservaAuditoria {
  return {
    id: "r1",
    rancho_id: "rancho-1",
    cliente_id: "cliente-1",
    fecha: "2026-08-10",
    nombre: "Cliente de prueba",
    contacto: null,
    correo: null,
    whatsapp: null,
    cedula: null,
    tipo_evento: null,
    invitados: null,
    estado: "confirmada",
    horario_bloque: null,
    monto_total: 10000,
    metodo_pago: null,
    deposito_monto: null,
    deposito_comprobante_url: null,
    deposito_validado: false,
    evento_pagado: false,
    terminos_aceptados: false,
    notas: null,
    origen: "web",
    detalle_pedido: null,
    created_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

describe("actividadReciente", () => {
  it("sin reservas -> lista vacía", () => {
    expect(actividadReciente([])).toEqual([]);
  });

  it("ordena por created_at descendente (más reciente primero)", () => {
    const items = actividadReciente([
      reserva({ id: "vieja", created_at: "2026-08-01T10:00:00Z" }),
      reserva({ id: "nueva", created_at: "2026-08-03T10:00:00Z" }),
      reserva({ id: "media", created_at: "2026-08-02T10:00:00Z" }),
    ]);
    expect(items.map((i) => i.id)).toEqual(["nueva", "media", "vieja"]);
  });

  it("excluye las reservas bloqueadas (no son actividad de un cliente)", () => {
    const items = actividadReciente([
      reserva({ id: "bloqueo", estado: "bloqueada" }),
      reserva({ id: "real", estado: "confirmada" }),
    ]);
    expect(items.map((i) => i.id)).toEqual(["real"]);
  });

  it("respeta el límite", () => {
    const reservas = Array.from({ length: 10 }, (_, i) =>
      reserva({ id: `r${i}`, created_at: `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z` }),
    );
    expect(actividadReciente(reservas, 3)).toHaveLength(3);
    expect(actividadReciente(reservas, 3).map((i) => i.id)).toEqual(["r9", "r8", "r7"]);
  });

  it("mapea nombre, monto y estado tal cual", () => {
    const [item] = actividadReciente([
      reserva({ id: "x", nombre: "Ana Pérez", monto_total: 55000, estado: "pendiente" }),
    ]);
    expect(item).toMatchObject({ id: "x", nombre: "Ana Pérez", monto: 55000, estado: "pendiente" });
  });

  it("la auditoría trae cuándo se reservó, el adelanto y lo pendiente", () => {
    const [item] = actividadReciente([
      reserva({
        fecha: "2026-09-12",
        created_at: "2026-08-02T15:00:00Z",
        monto_total: 100000,
        deposito_monto: 25000,
        deposito_validado: true,
      }),
    ]);
    expect(item).toMatchObject({
      creadoEn: "2026-08-02T15:00:00Z",
      fechaEvento: "2026-09-12",
      adelanto: 25000,
      pendiente: 75000,
    });
  });

  it("un adelanto sin validar todavía no cuenta como recibido", () => {
    const [item] = actividadReciente([
      reserva({ monto_total: 100000, deposito_monto: 25000, deposito_validado: false }),
    ]);
    expect(item.adelanto).toBe(0);
    // La deuda igual lo descuenta: el cliente ya lo transfirió.
    expect(item.pendiente).toBe(75000);
  });

  it("la nota viaja limpia, y vacía queda en null", () => {
    const [conNota] = actividadReciente([reserva({ notas: "  Llega a las 3  " })]);
    expect(conNota.nota).toBe("Llega a las 3");
    const [sinNota] = actividadReciente([reserva({ notas: "   " })]);
    expect(sinNota.nota).toBeNull();
  });

  it("trae la traza de quién reservó y cómo pagó", () => {
    const [item] = actividadReciente([
      reserva({
        correo: "ana@correo.com",
        whatsapp: "8888-8888",
        cedula: "1-1111-1111",
        metodo_pago: "sinpe",
        origen: "web",
        invitados: 40,
        tipo_evento: "Cumpleaños",
        deposito_pagado_en: "2026-08-02T16:00:00Z",
        saldo_pagado_en: "2026-09-12T22:00:00Z",
        codigo_descuento: "VERANO",
        descuento_monto: 5000,
        deposito_comprobante_url: "comprobantes/ana.jpg",
      }),
    ]);
    expect(item).toMatchObject({
      correo: "ana@correo.com",
      whatsapp: "8888-8888",
      cedula: "1-1111-1111",
      metodoPago: "sinpe",
      origen: "web",
      invitados: 40,
      tipoEvento: "Cumpleaños",
      depositoPagadoEn: "2026-08-02T16:00:00Z",
      saldoPagadoEn: "2026-09-12T22:00:00Z",
      codigoDescuento: "VERANO",
      descuentoMonto: 5000,
      comprobanteUrl: "comprobantes/ana.jpg",
    });
  });

  it("las columnas que puede no tener la base quedan en null, no en undefined", () => {
    const [item] = actividadReciente([reserva({})]);
    expect(item.depositoPagadoEn).toBeNull();
    expect(item.saldoPagadoEn).toBeNull();
    expect(item.codigoDescuento).toBeNull();
    expect(item.adelantoDevuelto).toBe(false);
  });

  it("manda lo cobrado de verdad sobre la cotización", () => {
    const [item] = actividadReciente([
      reserva({ monto_total: 100000, monto_cobrado_final: 90000 }),
    ]);
    expect(item.monto).toBe(90000);
  });

  it("el horario sale legible: el bloque del lugar o la hora de la cita", () => {
    const [bloque] = actividadReciente([reserva({ horario_bloque: "8 a.m. a 4 p.m." })]);
    expect(bloque.horario).toBe("8 a.m. a 4 p.m.");
    const [cita] = actividadReciente([
      reserva({ horario_bloque: null, hora_inicio: "15:30:00", duracion_horas: 2 }),
    ]);
    expect(cita.horario).toBe("3:30 p.m. · 2 h");
    const [sinHorario] = actividadReciente([reserva({ horario_bloque: null })]);
    expect(sinHorario.horario).toBeNull();
  });
});
