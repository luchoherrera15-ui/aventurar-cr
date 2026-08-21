import { describe, expect, it } from "vitest";
import {
  TOPE_PRECIO,
  leerPrecioColones,
  motivoNombreInvalido,
  normalizarNombreProducto,
  precioValido,
  topProductosVendidos,
  type VentaDeProducto,
} from "./productos";

/**
 * El catálogo decide DOS cosas que se ven en la caja y en el reporte:
 * qué precio se propone al cobrar y qué producto encabeza las ventas.
 * Las dos son plata, así que lo que más se prueba acá es lo que NO se
 * acepta y lo que NO se muestra.
 */

describe("leerPrecioColones", () => {
  it("lee un precio en colones enteros", () => {
    expect(leerPrecioColones("2500")).toEqual({ ok: true, precio: 2500 });
    expect(leerPrecioColones("  4500  ")).toEqual({ ok: true, precio: 4500 });
  });

  it("un precio VACÍO es un error, no un «sin monto»", () => {
    // A diferencia del monto de una compra (que sí puede no estar), un
    // producto sin precio no sirve para lo único que el catálogo hace.
    const r = leerPrecioColones("");
    expect(r.ok).toBe(false);
  });

  it("cero y negativos se rechazan con el porqué", () => {
    const cero = leerPrecioColones("0");
    expect(cero.ok).toBe(false);
    if (!cero.ok) expect(cero.motivo).toContain("mayor que ₡0");
    expect(leerPrecioColones("-100").ok).toBe(false);
  });

  it("los céntimos se rechazan diciendo qué escribir en su lugar", () => {
    const r = leerPrecioColones("2500.50");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("2501");
  });

  it("la coma decimal de acá se entiende igual que el punto", () => {
    const r = leerPrecioColones("2500,50");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("colones enteros");
  });

  it("respeta el techo del CHECK de la 0198", () => {
    expect(leerPrecioColones(String(TOPE_PRECIO)).ok).toBe(true);
    expect(leerPrecioColones(String(TOPE_PRECIO + 1)).ok).toBe(false);
  });

  it("lo que no es número se rechaza", () => {
    expect(leerPrecioColones("dos mil").ok).toBe(false);
  });
});

describe("precioValido", () => {
  it("solo enteros mayores que cero y dentro del techo", () => {
    expect(precioValido(1)).toBe(true);
    expect(precioValido(TOPE_PRECIO)).toBe(true);
    expect(precioValido(0)).toBe(false);
    expect(precioValido(-1)).toBe(false);
    expect(precioValido(2500.5)).toBe(false);
    expect(precioValido(TOPE_PRECIO + 1)).toBe(false);
    expect(precioValido(Number.NaN)).toBe(false);
  });
});

describe("el nombre del producto", () => {
  it("colapsa los espacios y recorta", () => {
    expect(normalizarNombreProducto("  Capuchino   grande  ")).toBe("Capuchino grande");
  });

  it("vacío no es nombre", () => {
    expect(motivoNombreInvalido("   ")).not.toBeNull();
  });

  it("respeta el tope de 80 del CHECK de la 0198", () => {
    expect(motivoNombreInvalido("x".repeat(80))).toBeNull();
    expect(motivoNombreInvalido("x".repeat(81))).not.toBeNull();
  });
});

describe("topProductosVendidos", () => {
  function venta(producto: string | null, monto: number | null): VentaDeProducto {
    return { producto, monto };
  }

  it("suma la plata y las ventas de cada producto", () => {
    const top = topProductosVendidos([
      venta("Capuchino", 2500),
      venta("Capuchino", 2500),
      venta("Croissant", 1800),
    ]);
    expect(top).toEqual([
      { nombre: "Capuchino", ventas: 2, total: 5000 },
      { nombre: "Croissant", ventas: 1, total: 1800 },
    ]);
  });

  it("«Capuchino» y «capuchino» son el mismo café", () => {
    const top = topProductosVendidos([venta("Capuchino", 2500), venta("capuchino", 2500)]);
    expect(top).toHaveLength(1);
    expect(top[0].ventas).toBe(2);
    // El nombre visible es el de la venta más reciente, que es la
    // primera de la lista (el panel las trae de la más nueva).
    expect(top[0].nombre).toBe("Capuchino");
  });

  it("las ventas SIN producto no inventan un renglón", () => {
    const top = topProductosVendidos([venta(null, 4500), venta("   ", 3000)]);
    expect(top).toEqual([]);
  });

  it("una venta con producto pero sin monto cuenta la venta y no la plata", () => {
    const top = topProductosVendidos([venta("Café del día", null)]);
    expect(top).toEqual([{ nombre: "Café del día", ventas: 1, total: 0 }]);
  });

  it("ordena por plata y no por cantidad de ventas", () => {
    const top = topProductosVendidos([
      venta("Galleta", 500),
      venta("Galleta", 500),
      venta("Galleta", 500),
      venta("Torta entera", 12000),
    ]);
    expect(top.map((p) => p.nombre)).toEqual(["Torta entera", "Galleta"]);
  });

  it("corta en cinco por defecto", () => {
    const ventas = ["a", "b", "c", "d", "e", "f", "g"].map((n, i) => venta(n, (7 - i) * 1000));
    expect(topProductosVendidos(ventas)).toHaveLength(5);
    expect(topProductosVendidos(ventas, 3)).toHaveLength(3);
  });

  it("sin ventas, lista vacía — nunca un ranking de nada", () => {
    expect(topProductosVendidos([])).toEqual([]);
  });
});
