import { describe, expect, it } from "vitest";
import {
  aRgbCss,
  camposSegunModo,
  construirPassJson,
  coloresDe,
  metaDeSellos,
  type DatosTarjeta,
} from "./tarjeta";

/**
 * Lo que se prueba acá es la decisión de PRESENTACIÓN: los tres modos
 * guardan el mismo dato (un saldo de puntos) y solo cambia cómo se
 * lee. Un 5 puede ser "5 sellos", "₡5" o "5 puntos".
 */

function datos(extra: Partial<DatosTarjeta> = {}): DatosTarjeta {
  return {
    negocioNombre: "Pura Matcha",
    saldo: 5,
    meta: { nombre: "Tu bebida favorita gratis", costo_puntos: 10 },
    config: {
      modo: "sellos",
      pase_color_fondo: "#2F4230",
      pase_color_sello: "#D9E8C4",
      pase_logo_url: null,
    },
    serialNumber: "PM-0001",
    passTypeIdentifier: "pass.lat.bookea.afiliacion",
    teamIdentifier: "425GBKXN83",
    ...extra,
  };
}

describe("colores", () => {
  it("convierte hex a rgb, que es lo que pide pass.json", () => {
    expect(aRgbCss("#2F4230")).toBe("rgb(47, 66, 48)");
    expect(aRgbCss("#000000")).toBe("rgb(0, 0, 0)");
    expect(aRgbCss("#FFFFFF")).toBe("rgb(255, 255, 255)");
  });

  it("cae al navy de Bookea si el negocio no eligió", () => {
    const c = coloresDe({ modo: null, pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null });
    expect(c).toEqual({ fondo: "#002472", sello: "#F39200" });
  });
});

describe("metaDeSellos", () => {
  it("sale de la recompensa, no de una columna propia", () => {
    expect(metaDeSellos({ nombre: "x", costo_puntos: 10 })).toBe(10);
  });

  it("sin recompensa no hay meta", () => {
    expect(metaDeSellos(null)).toBeNull();
  });
});

describe("modo sellos", () => {
  it("muestra progreso y cuántos faltan", () => {
    const c = camposSegunModo(datos({ saldo: 5 }));
    expect(c.encabezado).toEqual({ label: "SELLOS", value: "5/10" });
    expect(c.detalle.value).toBe("Te faltan 5 sellos");
    expect(c.regalia?.value).toBe("Tu bebida favorita gratis");
  });

  it("concuerda en singular cuando falta uno solo", () => {
    expect(camposSegunModo(datos({ saldo: 9 })).detalle.value).toBe("Te falta 1 sello");
  });

  it("al completarla cambia el mensaje en vez de decir 'te faltan 0'", () => {
    const c = camposSegunModo(datos({ saldo: 10 }));
    expect(c.encabezado.value).toBe("10/10");
    expect(c.detalle.label).toBe("¡YA LA GANASTE!");
  });

  it("pasarse de la meta no muestra 11/10 ni un negativo", () => {
    const c = camposSegunModo(datos({ saldo: 14 }));
    expect(c.encabezado.value).toBe("10/10");
    expect(c.detalle.label).toBe("¡YA LA GANASTE!");
  });

  it("sin recompensa configurada cae a puntos en vez de inventar un total", () => {
    const c = camposSegunModo(datos({ meta: null }));
    expect(c.encabezado).toEqual({ label: "PUNTOS", value: "5" });
  });
});

describe("modo cashback", () => {
  it("muestra el saldo en colones con separador local", () => {
    const c = camposSegunModo(
      datos({ saldo: 3400, config: { ...datos().config, modo: "cashback" } }),
    );
    expect(c.encabezado.label).toBe("SALDO");
    expect(c.encabezado.value).toContain("3");
    expect(c.encabezado.value.startsWith("₡")).toBe(true);
  });
});

describe("modo puntos", () => {
  it("muestra el saldo pelado", () => {
    const c = camposSegunModo(
      datos({ saldo: 340, meta: null, config: { ...datos().config, modo: "puntos" } }),
    );
    expect(c.encabezado).toEqual({ label: "PUNTOS", value: "340" });
  });

  it("modo null se comporta como puntos", () => {
    const c = camposSegunModo(
      datos({ saldo: 12, meta: null, config: { ...datos().config, modo: null } }),
    );
    expect(c.encabezado.label).toBe("PUNTOS");
  });
});

describe("construirPassJson", () => {
  it("arma un storeCard con los identificadores correctos", () => {
    const p = construirPassJson(datos()) as Record<string, unknown>;
    expect(p.formatVersion).toBe(1);
    expect(p.passTypeIdentifier).toBe("pass.lat.bookea.afiliacion");
    expect(p.teamIdentifier).toBe("425GBKXN83");
    expect(p.organizationName).toBe("Pura Matcha");
    expect(p.storeCard).toBeDefined();
  });

  it("NO lleva primaryFields: se montarían sobre los sellos", () => {
    const p = construirPassJson(datos()) as { storeCard: Record<string, unknown> };
    expect(p.storeCard.primaryFields).toBeUndefined();
    expect(p.storeCard.headerFields).toHaveLength(1);
  });

  it("la firma de Bookea va bajo el QR, no encima de la marca del negocio", () => {
    const p = construirPassJson(datos()) as { barcodes: { altText: string }[] };
    expect(p.barcodes[0].altText).toBe("Powered by Bookea.lat");
  });

  it("usa los colores del negocio", () => {
    const p = construirPassJson(datos()) as Record<string, string>;
    expect(p.backgroundColor).toBe("rgb(47, 66, 48)");
    expect(p.labelColor).toBe("rgb(217, 232, 196)");
  });

  it("sin ubicación no declara locations", () => {
    expect(construirPassJson(datos()).locations).toBeUndefined();
  });

  it("con ubicación habilita el aviso por cercanía, que Apple hace nativo", () => {
    const p = construirPassJson(
      datos({ ubicacion: { latitud: 9.93, longitud: -84.08 } }),
    ) as { locations: { latitude: number; relevantText: string }[] };
    expect(p.locations).toHaveLength(1);
    expect(p.locations[0].latitude).toBe(9.93);
    expect(p.locations[0].relevantText).toContain("Pura Matcha");
  });

  it("el texto de ayuda cambia con el modo", () => {
    const sellos = construirPassJson(datos()) as { storeCard: { backFields: { value: string }[] } };
    expect(sellos.storeCard.backFields[0].value).toContain("10 sellos");

    const cash = construirPassJson(
      datos({ config: { ...datos().config, modo: "cashback" } }),
    ) as { storeCard: { backFields: { value: string }[] } };
    expect(cash.storeCard.backFields[0].value).toContain("saldo");
  });
});
