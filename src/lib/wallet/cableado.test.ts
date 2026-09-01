import { describe, expect, it } from "vitest";
import { construirPassJson, tarjetaDesdeFila, type MetaRecompensa } from "./tarjeta";
import { construirObjeto } from "./google";
import {
  leerBeneficio,
  TIPOS_TARJETA_ID,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";

/**
 * EL CABLEADO, que es justo lo que no se probaba.
 *
 * `tarjeta.test.ts` prueba la función PURA: le entrega el beneficio ya
 * armado y comprueba que el texto sale bien. Pasaba en verde mientras
 * el bug estaba vivo, porque el bug no estaba en la función sino en el
 * camino hasta ella: la fila de `programa_lealtad` traía la columna
 * `beneficio` (por el `select *`) y el casteo escrito a mano de
 * generar.ts la tiraba a la basura. En el teléfono del cliente un cupón
 * del 30% salía como «CUPÓN / Beneficio» y una membresía Gold como
 * «MEMBRESÍA / Socio»: las ramas de degradación, con el dato bueno
 * perdido dos funciones antes.
 *
 * Por eso acá se arranca de la FILA CRUDA, tal como la devuelve
 * Supabase, y se comprueba el TEXTO que termina en el pase. Si alguien
 * vuelve a cortar el cable en el medio, esto se pone rojo.
 */

/** Beneficios como los guardaría un negocio de verdad, no ceros. */
const BENEFICIOS: Record<TipoTarjeta, ConfigBeneficio> = {
  sellos: { tipo: "sellos", requeridos: 10, recompensa: "Un café gratis", inicial: 0, repetible: true },
  puntos: {
    tipo: "puntos",
    nombre: "estrellas",
    porMoneda: 0.01,
    porVisita: 1,
    inicial: 0,
    minimoCanje: 100,
    maximo: null,
  },
  cupon: {
    tipo: "cupon",
    beneficio: { forma: "porcentaje", valor: 30 },
    compraMinima: 0,
    descuentoMaximo: null,
    usosPorCliente: 1,
  },
  descuento: {
    tipo: "descuento",
    beneficio: { forma: "monto", valor: 5000 },
    compraMinima: 15000,
    descuentoMaximo: null,
    usosPorCliente: 3,
  },
  membresia: {
    tipo: "membresia",
    nivel: "Gold",
    beneficios: ["10% siempre", "Prioridad de horario"],
    vigenciaMeses: 12,
    renovacionAutomatica: false,
  },
  giftcard: { tipo: "giftcard", valor: 25000, moneda: "CRC", canjeParcial: true, transferible: true },
  evento: {
    tipo: "evento",
    fecha: "2026-09-01",
    hora: "19:00",
    ubicacion: "Rancho Las Torres",
    capacidad: 120,
  },
  cashback: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null },
};

/**
 * Una fila de `programa_lealtad` como la entrega `select *`: el jsonb
 * ya viene parseado, y sobran columnas que la tarjeta no mira.
 */
function fila(tipo: TipoTarjeta, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    rancho_id: "22222222-2222-2222-2222-222222222222",
    activo: true,
    estado: "publicado",
    nombre: "Tarjeta de Pura Matcha",
    modo: tipo,
    beneficio: BENEFICIOS[tipo],
    pase_color_fondo: "#2F4230",
    pase_color_sello: "#D9E8C4",
    pase_logo_url: null,
    puntos_por_visita: 1,
    puntos_por_colon: 0,
    ...extra,
  };
}

/** El mismo camino que hace generar.ts: fila → datos → pass.json. */
function passDeLaFila(
  f: Record<string, unknown>,
  opciones: { saldo?: number; meta?: MetaRecompensa } = {},
) {
  const { config, beneficio } = tarjetaDesdeFila(f);
  return construirPassJson({
    negocioNombre: "Pura Matcha",
    saldo: opciones.saldo ?? 5,
    meta: opciones.meta ?? null,
    config,
    beneficio,
    serialNumber: "PM-0001",
    passTypeIdentifier: "pass.lat.bookea.afiliacion",
    teamIdentifier: "425GBKXN83",
  });
}

/** El mismo camino que hace google.ts: fila → datos → LoyaltyObject. */
function objetoDeLaFila(
  f: Record<string, unknown>,
  opciones: { saldo?: number; meta?: MetaRecompensa } = {},
) {
  const { config, beneficio } = tarjetaDesdeFila(f);
  return construirObjeto({
    issuerId: "3388000000023187944",
    ranchoId: "22222222-2222-2222-2222-222222222222",
    miembroId: "33333333-3333-3333-3333-333333333333",
    nombreNegocio: "Pura Matcha",
    nombreCliente: "Luis",
    serial: "PM-0001",
    saldo: opciones.saldo ?? 5,
    config,
    meta: opciones.meta ?? null,
    beneficio,
  });
}

/** El campo grande de arriba, sin la `key` que Apple pide para nada. */
function encabezado(pass: Record<string, unknown>): { label: string; value: string } {
  const tarjeta = pass.storeCard as { headerFields: { label: string; value: string }[] };
  const { label, value } = tarjeta.headerFields[0];
  return { label, value };
}

function detalle(pass: Record<string, unknown>): { label: string; value: string } {
  const tarjeta = pass.storeCard as { secondaryFields: { label: string; value: string }[] };
  const { label, value } = tarjeta.secondaryFields[0];
  return { label, value };
}

const MIL5 = (5000).toLocaleString("es-CR");
const MIL25 = (25000).toLocaleString("es-CR");

// ── Apple ────────────────────────────────────────────────────────────

describe("de la fila de programa_lealtad al pass.json", () => {
  it("sellos: el progreso contra la recompensa", () => {
    const p = passDeLaFila(fila("sellos"), {
      saldo: 5,
      meta: { nombre: "Un café gratis", costo_puntos: 10 },
    });
    expect(encabezado(p)).toEqual({ label: "SELLOS", value: "5/10" });
  });

  it("puntos: el saldo pelado", () => {
    const p = passDeLaFila(fila("puntos"), { saldo: 240 });
    expect(encabezado(p)).toEqual({ label: "PUNTOS", value: "240" });
  });

  it("cashback: el saldo en colones", () => {
    const p = passDeLaFila(fila("cashback"), { saldo: 3400 });
    expect(encabezado(p).label).toBe("SALDO");
    expect(encabezado(p).value.startsWith("₡")).toBe(true);
  });

  it("cupón: el 30% del negocio, no la palabra «Beneficio»", () => {
    const p = passDeLaFila(fila("cupon"));
    expect(encabezado(p)).toEqual({ label: "CUPÓN", value: "30% OFF" });
    // Lo que salía antes, con el beneficio perdido en el camino:
    expect(encabezado(p).value).not.toBe("Beneficio");
  });

  it("descuento: el monto que el negocio configuró", () => {
    const p = passDeLaFila(fila("descuento"));
    expect(encabezado(p).label).toBe("DESCUENTO");
    expect(encabezado(p).value).toContain(MIL5);
    expect(encabezado(p).value).not.toBe("Beneficio");
  });

  it("membresía: el nivel y los beneficios, no «Socio»", () => {
    const p = passDeLaFila(fila("membresia"));
    expect(encabezado(p)).toEqual({ label: "MEMBRESÍA", value: "Gold" });
    expect(encabezado(p).value).not.toBe("Socio");
    expect(detalle(p).value).toContain("Prioridad de horario");
  });

  it("gift card: el saldo que queda, con su moneda", () => {
    const p = passDeLaFila(fila("giftcard"), { saldo: 25000 });
    expect(encabezado(p).label).toBe("SALDO");
    expect(encabezado(p).value).toBe(`₡${MIL25}`);
  });

  it("evento: cuándo y dónde, no «Por confirmar»", () => {
    const p = passDeLaFila(fila("evento"));
    expect(encabezado(p).label).toBe("ENTRADA");
    expect(encabezado(p).value).toContain("2026-09-01");
    expect(encabezado(p).value).toContain("19:00");
    expect(encabezado(p).value).not.toBe("Por confirmar");
    expect(detalle(p).value).toBe("Rancho Las Torres");
  });

  it("el dorso tampoco miente: cuenta lo que ES la tarjeta", () => {
    const dorso = (tipo: TipoTarjeta) => {
      const p = passDeLaFila(fila(tipo));
      const tarjeta = p.storeCard as { backFields: { value: string }[] };
      return tarjeta.backFields[0].value;
    };
    // El texto genérico habla de «sumar puntos y canjearlos»: en un
    // cupón de un solo uso o en una entrada eso es falso.
    expect(dorso("cupon")).toContain("30% OFF");
    expect(dorso("membresia")).toContain("Gold");
    expect(dorso("evento")).toContain("Rancho Las Torres");
    expect(dorso("giftcard")).toContain(MIL25);
    for (const tipo of ["cupon", "membresia", "evento", "giftcard"] as const) {
      expect(dorso(tipo)).not.toContain("sumar puntos");
    }
  });

  it("los ocho tipos salen con texto propio, ninguno cae en el genérico", () => {
    const etiquetas = TIPOS_TARJETA_ID.map((tipo) => encabezado(passDeLaFila(fila(tipo))).label);
    // Si un tipo nuevo se olvida, su etiqueta cae en «PUNTOS» y esto lo
    // delata: el ÚNICO que puede decir «PUNTOS» es 'puntos'.
    //
    // Antes eran dos, y el segundo era un bug con forma de excepción:
    // una tarjeta de SELLOS sin fila en `recompensas` se caía a la rama
    // genérica y el cliente veía «PUNTOS 0» en el teléfono. Desde el
    // 1 sep 2026 la meta se saca del `beneficio` cuando la tabla vieja
    // no dice nada, así que ya no hay ningún caso legítimo.
    expect(etiquetas.filter((e) => e === "PUNTOS")).toHaveLength(1);
    for (const e of etiquetas) expect(e.trim()).not.toBe("");
  });

  it("una tarjeta de sellos SIN fila en recompensas sigue siendo de sellos", () => {
    // El caso de los programas sembrados: `beneficio` dice «10 sellos,
    // café gratis» y `recompensas` está vacía. El pase tiene que leer
    // el beneficio, no rendirse y mostrar puntos.
    // `meta` sin pasar = null, que es exactamente el caso.
    const p = passDeLaFila(fila("sellos"));
    expect(encabezado(p).label).toBe("SELLOS");
    expect(encabezado(p).value).toContain("/");
    expect(encabezado(p).label).not.toBe("PUNTOS");
  });
});

// ── Google ───────────────────────────────────────────────────────────

describe("de la fila de programa_lealtad al LoyaltyObject", () => {
  it("sellos y puntos siguen diciendo lo de siempre", () => {
    const s = objetoDeLaFila(fila("sellos"), {
      saldo: 5,
      meta: { nombre: "Un café gratis", costo_puntos: 10 },
    });
    expect(s.loyaltyPoints).toEqual({ label: "Sellos", balance: { int: 5 } });
    expect(s.textModulesData?.[0].body).toContain("5 de 10");

    const p = objetoDeLaFila(fila("puntos"), { saldo: 240 });
    expect(p.loyaltyPoints).toEqual({ label: "Puntos", balance: { int: 240 } });
  });

  it("cashback muestra saldo, no «Puntos»", () => {
    const c = objetoDeLaFila(fila("cashback"), { saldo: 3400 });
    expect(c.loyaltyPoints).toEqual({ label: "Saldo", balance: { int: 3400 } });
  });

  it("cupón: la etiqueta es del catálogo y el valor es el beneficio", () => {
    const o = objetoDeLaFila(fila("cupon"));
    expect(o.loyaltyPoints.label).toBe("Cupón");
    expect(o.loyaltyPoints.balance).toEqual({ string: "30% OFF" });
    expect(o.textModulesData?.[0].body).toBe("Presentá esta tarjeta al pagar");
  });

  it("descuento: el monto configurado", () => {
    const o = objetoDeLaFila(fila("descuento"));
    expect(o.loyaltyPoints.label).toBe("Descuento");
    expect(JSON.stringify(o.loyaltyPoints.balance)).toContain(MIL5);
  });

  it("membresía: el nivel y los beneficios", () => {
    const o = objetoDeLaFila(fila("membresia"));
    expect(o.loyaltyPoints.label).toBe("Membresía");
    expect(o.loyaltyPoints.balance).toEqual({ string: "Gold" });
    expect(o.textModulesData?.[0].body).toContain("Prioridad de horario");
  });

  it("gift card: el saldo que queda", () => {
    const o = objetoDeLaFila(fila("giftcard"), { saldo: 25000 });
    expect(o.loyaltyPoints).toEqual({ label: "Saldo", balance: { int: 25000 } });
    expect(o.textModulesData?.[0].body).toContain("saldo");
  });

  it("evento: la fecha y el lugar", () => {
    const o = objetoDeLaFila(fila("evento"));
    expect(o.loyaltyPoints.label).toBe("Entrada");
    expect(JSON.stringify(o.loyaltyPoints.balance)).toContain("2026-09-01");
    expect(o.textModulesData?.[0].body).toBe("Rancho Las Torres");
  });

  it("ningún tipo del catálogo cae en la etiqueta de otro", () => {
    // El ternario viejo conocía TRES tipos y los otros cinco caían en
    // «Puntos»: cinco tarjetas distintas, la misma palabra equivocada.
    const etiquetas = TIPOS_TARJETA_ID.map((tipo) => objetoDeLaFila(fila(tipo)).loyaltyPoints.label);
    expect(etiquetas.filter((e) => e === "Puntos")).toHaveLength(1);
    expect(new Set(etiquetas).size).toBeGreaterThanOrEqual(6);
  });

  it("el iPhone y el Android dicen lo MISMO", () => {
    for (const tipo of ["cupon", "descuento", "membresia", "giftcard", "evento"] as const) {
      const p = passDeLaFila(fila(tipo));
      const o = objetoDeLaFila(fila(tipo));
      expect(o.textModulesData?.[0].body).toBe(detalle(p).value);
    }
  });
});

// ── Lo que la base puede devolver de verdad ──────────────────────────

describe("leer el beneficio tolerando lo que haya en la base", () => {
  it("la 0135 sin correr: la fila llega SIN la columna y el pase igual sale", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      const sinColumna = fila(tipo);
      delete sinColumna.beneficio;
      const p = passDeLaFila(sinColumna);
      expect(encabezado(p).value.trim()).not.toBe("");
      expect(detalle(p).value.trim()).not.toBe("");
      expect(objetoDeLaFila(sinColumna).loyaltyPoints.label.trim()).not.toBe("");
    }
  });

  it("aunque se degrade, la tarjeta NO se hace pasar por otra", () => {
    // Sin beneficio un cupón sigue siendo un cupón: lo que se pierde es
    // el «30% OFF», no la identidad de la tarjeta.
    const p = passDeLaFila(fila("cupon", { beneficio: null }));
    expect(encabezado(p).label).toBe("CUPÓN");
    expect(encabezado(p).value).toBe("Beneficio");
  });

  it("el jsonb que llega como TEXTO también se lee", () => {
    const p = passDeLaFila(fila("cupon", { beneficio: JSON.stringify(BENEFICIOS.cupon) }));
    expect(encabezado(p).value).toBe("30% OFF");
  });

  it("una config que no corresponde al tipo se descarta en vez de mentir", () => {
    // Guardar la config de una gift card en una tarjeta de cupón haría
    // que el pase prometa algo que el canje no cumple.
    const p = passDeLaFila(fila("cupon", { beneficio: BENEFICIOS.giftcard }));
    expect(encabezado(p).label).toBe("CUPÓN");
    expect(encabezado(p).value).toBe("Beneficio");
  });

  it("basura en el jsonb no tumba la emisión del pase", () => {
    const basuras: unknown[] = [null, 42, "no soy json", "{roto", [], {}, { tipo: "loquesea" }];
    for (const basura of basuras) {
      expect(() => passDeLaFila(fila("cupon", { beneficio: basura }))).not.toThrow();
      expect(() => objetoDeLaFila(fila("evento", { beneficio: basura }))).not.toThrow();
    }
  });

  it("un modo que el código no conoce se degrada a puntos, no rompe", () => {
    const p = passDeLaFila(fila("puntos", { modo: "promo_de_viernes", beneficio: null }), {
      saldo: 7,
    });
    expect(encabezado(p)).toEqual({ label: "PUNTOS", value: "7" });
  });

  it("leerBeneficio devuelve null en vez de lanzar, siempre", () => {
    expect(leerBeneficio(undefined, "cupon")).toBeNull();
    expect(leerBeneficio(null, "cupon")).toBeNull();
    expect(leerBeneficio({ tipo: "cupon" }, "cupon")).toBeNull(); // sin la forma del beneficio
    expect(leerBeneficio(BENEFICIOS.cupon, "cupon")).toEqual(BENEFICIOS.cupon);
    // cupón y descuento son UNA sola forma en el tipo: la config de uno
    // sirve para el otro y no hay nada que descartar.
    expect(leerBeneficio(BENEFICIOS.cupon, "descuento")).toEqual(BENEFICIOS.cupon);
  });
});
