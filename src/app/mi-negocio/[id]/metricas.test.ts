import { describe, expect, it } from "vitest";
import { actividadReciente } from "./metricas";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";

function reserva(overrides: Partial<Reserva>): Reserva {
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
});
