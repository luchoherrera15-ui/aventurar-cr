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
    // Obligatorio desde el arreglo del cableado: un programa sin la
    // config de la 0135 lo manda en null, pero lo manda.
    beneficio: null,
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

/**
 * LOS CINCO TIPOS DE LA 0135.
 *
 * Antes de esto, un programa de tipo 'cupon' caía en la rama genérica
 * y el pase decía «PUNTOS 0» en el teléfono del cliente: la tarjeta
 * mostraba algo que no tenía nada que ver con lo que el negocio
 * prometió. Eso es lo que se protege acá.
 */
describe("los tipos de la 0135", () => {
  it("un cupón muestra el beneficio, no un saldo", () => {
    const c = camposSegunModo(
      datos({
        config: { modo: "cupon", pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
        beneficio: {
          tipo: "cupon",
          beneficio: { forma: "porcentaje", valor: 30 },
          compraMinima: 0,
          descuentoMaximo: null,
          usosPorCliente: 1,
        },
      }),
    );
    expect(c.encabezado.value).toBe("30% OFF");
    expect(c.encabezado.label).toBe("CUPÓN");
    // Lo que NO debe pasar nunca:
    expect(c.encabezado.label).not.toBe("PUNTOS");
    expect(c.regalia).toBeNull();
  });

  it("un descuento por monto y uno de producto gratis se leen bien", () => {
    const conBeneficio = (forma: "monto" | "gratis") =>
      camposSegunModo(
        datos({
          config: { modo: "descuento", pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
          beneficio: {
            tipo: "descuento",
            beneficio:
              forma === "monto"
                ? { forma: "monto", valor: 5000 }
                : { forma: "gratis", que: "Postre" },
            compraMinima: 0,
            descuentoMaximo: null,
            usosPorCliente: 1,
          },
        }),
      ).encabezado.value;
    // es-CR separa los miles con espacio DURO (U+00A0): comparar
    // contra un espacio normal falla aunque el número esté bien.
    expect(conBeneficio("monto")).toContain((5000).toLocaleString("es-CR"));
    expect(conBeneficio("gratis")).toBe("Postre gratis");
  });

  it("una membresía muestra el nivel y sus beneficios", () => {
    const c = camposSegunModo(
      datos({
        config: { modo: "membresia", pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
        beneficio: {
          tipo: "membresia",
          nivel: "Gold",
          beneficios: ["10% siempre", "Prioridad de horario"],
          vigenciaMeses: 12,
          renovacionAutomatica: false,
        },
      }),
    );
    expect(c.encabezado.value).toBe("Gold");
    expect(c.detalle.value).toContain("10% siempre");
  });

  it("una gift card muestra el saldo que QUEDA, con su moneda", () => {
    const c = camposSegunModo(
      datos({
        saldo: 7500,
        config: { modo: "giftcard", pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
        beneficio: { tipo: "giftcard", valor: 10000, moneda: "CRC", canjeParcial: true, transferible: true },
      }),
    );
    expect(c.encabezado.value).toContain((7500).toLocaleString("es-CR"));
    expect(c.encabezado.value.startsWith("₡")).toBe(true);
  });

  it("un evento muestra cuándo y dónde", () => {
    const c = camposSegunModo(
      datos({
        config: { modo: "evento", pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
        beneficio: {
          tipo: "evento",
          fecha: "2026-09-01",
          hora: "19:00",
          ubicacion: "Rancho Las Torres",
          capacidad: 100,
        },
      }),
    );
    expect(c.encabezado.value).toContain("2026-09-01");
    expect(c.encabezado.value).toContain("19:00");
    expect(c.detalle.value).toBe("Rancho Las Torres");
  });

  it("sin la config del beneficio NO queda en blanco: se degrada", () => {
    // Un programa guardado antes de la 0135 no tiene `beneficio`. El
    // pase se sigue emitiendo con algo razonable en vez de romperse.
    for (const modo of ["cupon", "membresia", "giftcard", "evento"] as const) {
      const c = camposSegunModo(
        datos({
          beneficio: null,
          config: { modo, pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
        }),
      );
      expect(c.encabezado.value.trim()).not.toBe("");
      expect(c.detalle.value.trim()).not.toBe("");
    }
  });

  it("el pase completo se arma para los ocho tipos, sin excepción", () => {
    for (const modo of [
      "sellos", "puntos", "cashback", "cupon",
      "descuento", "membresia", "giftcard", "evento",
    ] as const) {
      const pass = construirPassJson(
        datos({
          config: { modo, pase_color_fondo: "#062653", pase_color_sello: "#FF6A00", pase_logo_url: null },
        }),
      );
      const tarjeta = pass.storeCard as { headerFields: { value: string }[] };
      expect(tarjeta.headerFields[0].value.trim()).not.toBe("");
      expect(pass.serialNumber).toBe("PM-0001");
    }
  });
});

describe("el mensaje promocional (0152)", () => {
  type Reverso = { key: string; label: string; value: string; changeMessage?: string };

  function backFields(pass: Record<string, unknown>): Reverso[] {
    return (pass.storeCard as { backFields: Reverso[] }).backFields;
  }

  it("sin mensaje, el pase sale exactamente igual que siempre — sin el campo", () => {
    const pass = construirPassJson(datos());
    expect(backFields(pass).some((f) => f.key === "promo")).toBe(false);
  });

  it("con mensaje, agrega el campo del reverso con changeMessage", () => {
    const pass = construirPassJson(datos({ mensajePromocional: "MIÉRCOLES MATCHAS 2X1" }));
    const promo = backFields(pass).find((f) => f.key === "promo");
    expect(promo).toBeDefined();
    expect(promo?.value).toBe("MIÉRCOLES MATCHAS 2X1");
    // Sin changeMessage, Apple no muestra ningún aviso en pantalla
    // bloqueada — es la mitad del punto de este campo.
    expect(promo?.changeMessage).toBe("%@");
  });

  it("un mensaje en blanco es lo mismo que no mandar ninguno", () => {
    const pass = construirPassJson(datos({ mensajePromocional: "   " }));
    expect(backFields(pass).some((f) => f.key === "promo")).toBe(false);
  });

  it("no le pisa ningún campo que ya existía — bookea y como siguen ahí", () => {
    const pass = construirPassJson(datos({ mensajePromocional: "2X1 los miércoles" }));
    const claves = backFields(pass).map((f) => f.key);
    expect(claves).toEqual(expect.arrayContaining(["como", "bookea", "promo"]));
  });
});
