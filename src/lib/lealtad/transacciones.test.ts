import { describe, expect, it } from "vitest";
import {
  faltaLaTablaDeTransacciones,
  recortarProducto,
  resumenImpacto,
  type FilaDeCompra,
} from "./transacciones";

/**
 * El impacto comercial se muestra en la cara del dueño: cada número de
 * acá es una promesa. Por eso lo que más se prueba es lo que NO se
 * muestra — el crecimiento sin dos períodos, el ticket sin montos —
 * porque una métrica inventada es peor que un cero honesto.
 */

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse("2026-08-20T12:00:00Z");

function compra(dias: number, monto: number | null, miembro = "m1", sellos = 1): FilaDeCompra {
  return {
    miembroId: miembro,
    monto,
    sellosOtorgados: sellos,
    createdAt: new Date(AHORA - dias * DIA).toISOString(),
  };
}

describe("resumenImpacto", () => {
  it("suma las ventas y cuenta las compras, con y sin monto", () => {
    const r = resumenImpacto([compra(1, 4500), compra(2, 9000, "m2"), compra(3, null, "m3")], AHORA);
    expect(r.ventas).toBe(13500);
    expect(r.compras).toBe(3);
    expect(r.comprasConMonto).toBe(2);
  });

  it("el ticket promedio divide SOLO entre las compras con monto", () => {
    const r = resumenImpacto([compra(1, 4500), compra(2, 9000, "m2"), compra(3, null, "m3")], AHORA);
    expect(r.ticketPromedio).toBe(6750);
  });

  it("sin compras con monto no hay ticket — null, nunca un cero falso", () => {
    expect(resumenImpacto([compra(1, null)], AHORA).ticketPromedio).toBeNull();
    expect(resumenImpacto([], AHORA).ticketPromedio).toBeNull();
  });

  it("recurrente es quien registró 2 o más compras", () => {
    const r = resumenImpacto(
      [compra(1, 4500, "ana"), compra(5, 4500, "ana"), compra(2, 9000, "beto")],
      AHORA,
    );
    expect(r.recurrentes).toBe(1);
  });

  it("los sellos emitidos son la suma de lo que cada compra otorgó", () => {
    const r = resumenImpacto([compra(1, 9000, "m1", 2), compra(2, 22500, "m2", 5)], AHORA);
    expect(r.sellosEmitidos).toBe(7);
  });

  it("el crecimiento SOLO existe con ventas en LOS DOS períodos de 30 días", () => {
    // Solo período reciente: nada que comparar.
    expect(resumenImpacto([compra(5, 9000)], AHORA).crecimientoVentasPct).toBeNull();
    // Solo período anterior: tampoco.
    expect(resumenImpacto([compra(45, 9000)], AHORA).crecimientoVentasPct).toBeNull();
    // Los dos: ahora sí, y con el signo correcto.
    expect(
      resumenImpacto([compra(5, 12000), compra(45, 10000)], AHORA).crecimientoVentasPct,
    ).toBe(20);
    expect(
      resumenImpacto([compra(5, 5000), compra(45, 10000)], AHORA).crecimientoVentasPct,
    ).toBe(-50);
  });

  it("la tabla vacía da ceros honestos, no errores", () => {
    const r = resumenImpacto([], AHORA);
    expect(r).toEqual({
      ventas: 0,
      compras: 0,
      comprasConMonto: 0,
      ticketPromedio: null,
      recurrentes: 0,
      sellosEmitidos: 0,
      crecimientoVentasPct: null,
    });
  });
});

describe("faltaLaTablaDeTransacciones — degradar sin romper el mostrador", () => {
  it("reconoce la tabla ausente por código y por mensaje", () => {
    expect(faltaLaTablaDeTransacciones({ code: "42P01", message: "x" })).toBe(true);
    expect(faltaLaTablaDeTransacciones({ code: "PGRST205", message: "x" })).toBe(true);
    expect(
      faltaLaTablaDeTransacciones({
        message: 'relation "lealtad_transacciones" does not exist',
      }),
    ).toBe(true);
    expect(
      faltaLaTablaDeTransacciones({
        message: "Could not find the table 'public.lealtad_transacciones' in the schema cache",
      }),
    ).toBe(true);
  });

  it("NO confunde otros errores con la migración ausente", () => {
    expect(faltaLaTablaDeTransacciones({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(
      faltaLaTablaDeTransacciones({ message: 'relation "citas" does not exist' }),
    ).toBe(false);
  });
});

describe("recortarProducto", () => {
  it("limpia espacios y devuelve null cuando no hay nada", () => {
    expect(recortarProducto("  Matcha   latte  ")).toBe("Matcha latte");
    expect(recortarProducto("   ")).toBeNull();
    expect(recortarProducto(null)).toBeNull();
    expect(recortarProducto(undefined)).toBeNull();
  });

  it("respeta el tope de 120 del CHECK de la 0197", () => {
    const largo = recortarProducto("x".repeat(200));
    expect(largo).not.toBeNull();
    expect((largo as string).length).toBeLessThanOrEqual(120);
    expect(largo).toContain("…");
  });
});
