import { describe, expect, it } from "vitest";
import { formatearCRC } from "../dinero";
import {
  TRAMO_CASHBACK,
  acumulacionDe,
  leerMontoColones,
  pideMontoElTipo,
  recompensaInicial,
  textosDelTipo,
  traducirErrorDeBase,
  traducirMotivo,
} from "./mostrador";
import { TIPOS_TARJETA_ID, configPorDefecto, type ConfigBeneficio } from "./tipos-tarjeta";

/**
 * Cada caso de acá es algo que hoy le pasa a alguien de pie en un
 * mostrador: un empleado leyendo «ya-canjeado» delante del cliente, o
 * un cupón que no se puede usar porque la tarjeta nació sin recompensa.
 */

describe("traducirMotivo", () => {
  it("cambia los códigos de la base por una frase que se puede leer en voz alta", () => {
    expect(traducirMotivo("ya-canjeado", "respaldo")).toContain("ya se entregó");
    expect(traducirMotivo("ya-canjeado", "respaldo")).not.toContain("ya-canjeado");
    expect(traducirMotivo("ya-otorgado", "respaldo")).toContain("menos de un minuto");
  });

  it("deja pasar las frases que la base ya escribió para una persona", () => {
    const frase = "La compra mínima para acumular es ₡2.000.";
    expect(traducirMotivo(frase, "respaldo")).toBe(frase);
  });

  it("esconde un código que nadie tradujo en vez de mostrarlo crudo", () => {
    // El día que la base agregue un motivo nuevo, el mostrador no puede
    // enseñar el identificador.
    expect(traducirMotivo("tope_diario_excedido", "No se pudo.")).toBe("No se pudo.");
    expect(traducirMotivo("saldo-insuficiente", "No se pudo.")).toBe("No se pudo.");
  });

  it("cae al respaldo cuando no vino motivo", () => {
    expect(traducirMotivo(null, "No se pudo.")).toBe("No se pudo.");
    expect(traducirMotivo("   ", "No se pudo.")).toBe("No se pudo.");
  });
});

describe("traducirErrorDeBase", () => {
  it("deja pasar NUESTROS mensajes (los raise de las 0146/0148, en español)", () => {
    const nuestro =
      "Tu programa está en pausa porque el paquete de Lealtad no está al día. Renovalo desde el panel, en Plan.";
    expect(traducirErrorDeBase({ code: "42501", message: nuestro }, "dar el sello")).toBe(nuestro);
  });

  it("NUNCA le enseña un error de Postgres al empleado", () => {
    const crudo =
      'duplicate key value violates unique constraint "transacciones_puntos_referencia_unica"';
    const salida = traducirErrorDeBase({ code: "23505", message: crudo }, "dar el sello");
    expect(salida).not.toContain("constraint");
    expect(salida).not.toContain("duplicate");
    expect(salida).toContain("dar el sello");
  });

  it("reconoce la migración que falta y dice cuál es", () => {
    expect(
      traducirErrorDeBase(
        { code: "PGRST202", message: "Could not find the function public.acreditar_lealtad" },
        "dar el sello",
      ),
    ).toContain("0125");
  });
});

describe("leerMontoColones — los decimales ya no se tiran callado", () => {
  it("un monto entero pasa", () => {
    expect(leerMontoColones("4500")).toEqual({ ok: true, monto: 4500 });
    expect(leerMontoColones("  4500  ")).toEqual({ ok: true, monto: 4500 });
  });

  it("vacío es «visita sin monto», no un error", () => {
    expect(leerMontoColones("")).toEqual({ ok: true, monto: null });
    expect(leerMontoColones("   ")).toEqual({ ok: true, monto: null });
  });

  it("AVISA de los céntimos en vez de convertir la compra en visita", () => {
    // Esto es el bug: `Number.isInteger(1500.5)` es false, el monto se
    // volvía null y el cliente perdía los puntos de su compra sin que
    // nada lo dijera.
    const r = leerMontoColones("1500.50");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toContain("1501");
      expect(r.motivo).toContain("1500.50");
    }
  });

  it("entiende la coma decimal, que es la de acá", () => {
    const r = leerMontoColones("1500,50");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("céntimos");
  });

  it("rechaza lo que no es número, lo negativo y lo absurdo", () => {
    expect(leerMontoColones("abc").ok).toBe(false);
    expect(leerMontoColones("-100").ok).toBe(false);
    expect(leerMontoColones("99000000").ok).toBe(false);
  });
});

describe("textosDelTipo", () => {
  it("no le dice «sello» a lo que no lleva sellos", () => {
    expect(textosDelTipo("cupon").titulo("Marta")).not.toMatch(/sello/i);
    expect(textosDelTipo("evento").titulo("Marta")).not.toMatch(/sello/i);
    expect(textosDelTipo("sellos").titulo("Marta")).toMatch(/sello/i);
  });

  it("esconde el contador en las tarjetas que no acumulan", () => {
    expect(textosDelTipo("sellos").muestraSaldo).toBe(true);
    expect(textosDelTipo("puntos").muestraSaldo).toBe(true);
    expect(textosDelTipo("cupon").muestraSaldo).toBe(false);
    expect(textosDelTipo("membresia").muestraSaldo).toBe(false);
  });

  it("cada tipo tiene sus verbos y ninguno queda vacío", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      const t = textosDelTipo(tipo);
      expect(t.verboCanje.trim()).not.toBe("");
      expect(t.verboSumar.trim()).not.toBe("");
      expect(t.titulo("Marta")).toContain("Marta");
      expect(t.repetido("Marta")).toContain("Marta");
    }
  });
});

describe("acumulacionDe — lo que la tarjeta acredita de verdad", () => {
  it("CASHBACK devuelve el porcentaje, no 1 por visita — esto era plata", () => {
    const a = acumulacionDe({
      tipo: "cashback",
      porcentaje: 5,
      compraMinima: 2000,
      topePorCompra: null,
    });
    expect(a.porColon).toBeCloseTo(0.05, 10);
    expect(a.porVisita).toBe(0);
    expect(a.compraMinima).toBe(2000);
    // La fórmula del RPC: puntos_por_visita + floor(porColon × monto).
    expect(a.porVisita + Math.floor(a.porColon * 10_000)).toBe(500);
  });

  it("la GIFT CARD carga un colón por colón, no 1 por visita", () => {
    const a = acumulacionDe({ tipo: "giftcard", valor: 10000, moneda: "CRC", canjeParcial: true, transferible: true });
    expect(a.porColon).toBe(1);
    expect(a.porVisita).toBe(0);
    expect(a.porVisita + Math.floor(a.porColon * 10_000)).toBe(10_000);
  });

  it("PUNTOS respeta lo que el dueño configuró", () => {
    const a = acumulacionDe({
      tipo: "puntos",
      nombre: "estrellas",
      porMoneda: 0.001,
      porVisita: 2,
      inicial: 0,
      minimoCanje: 10,
      maximo: null,
    });
    expect(a.porVisita).toBe(2);
    expect(a.porColon).toBe(0.001);
  });

  it("sellos y las cuatro de presentación dan UNO por visita", () => {
    for (const tipo of ["sellos", "cupon", "descuento", "membresia", "evento"] as const) {
      const base = configPorDefecto(tipo);
      const config: ConfigBeneficio =
        base.tipo === "sellos"
          ? { ...base, recompensa: "Un café" }
          : base.tipo === "membresia"
            ? { ...base, nivel: "Oro", beneficios: ["x"] }
            : base.tipo === "evento"
              ? { ...base, fecha: "2026-09-01", hora: "19:00", ubicacion: "Ahí" }
              : base;
      const a = acumulacionDe(config);
      expect(a.porVisita, tipo).toBe(1);
      expect(a.porColon, tipo).toBe(0);
    }
  });

  it("ningún tipo queda sin acumular nada (el RPC rechazaría la operación)", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      const a = acumulacionDe(usableParaTipo(tipo));
      expect(a.porVisita > 0 || a.porColon > 0, tipo).toBe(true);
      expect(a.porVisita).toBeGreaterThanOrEqual(0);
      expect(a.porColon).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("pideMontoElTipo", () => {
  it("solo donde el monto cambia lo que se acredita", () => {
    expect(pideMontoElTipo("puntos")).toBe(true);
    expect(pideMontoElTipo("cashback")).toBe(true);
    expect(pideMontoElTipo("giftcard")).toBe(true);
    // El escáner preguntaba `modo !== "sellos"`, o sea que le pedía el
    // monto a un cupón, a una entrada y a un carnet de socio.
    expect(pideMontoElTipo("sellos")).toBe(false);
    expect(pideMontoElTipo("cupon")).toBe(false);
    expect(pideMontoElTipo("descuento")).toBe(false);
    expect(pideMontoElTipo("membresia")).toBe(false);
    expect(pideMontoElTipo("evento")).toBe(false);
  });
});

/** La config por defecto del creador, con lo obligatorio llenado. */
function usableParaTipo(tipo: (typeof TIPOS_TARJETA_ID)[number]): ConfigBeneficio {
  const base = configPorDefecto(tipo);
  switch (base.tipo) {
    case "sellos":
      return { ...base, recompensa: "Un café gratis" };
    case "membresia":
      return { ...base, nivel: "Oro", beneficios: ["10% siempre", "Café de cortesía"] };
    case "giftcard":
      return { ...base, valor: 10000 };
    case "evento":
      return { ...base, fecha: "2026-09-01", hora: "19:00", ubicacion: "Teatro Nacional" };
    default:
      return base;
  }
}

describe("recompensaInicial — LOS OCHO TIPOS TIENEN QUÉ CANJEAR", () => {
  const usable = usableParaTipo;

  it("ninguno de los ocho se queda sin recompensa — este era EL bug", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      const r = recompensaInicial(usable(tipo));
      expect(r, `${tipo} nació sin recompensa canjeable`).not.toBeNull();
    }
  });

  it("el costo siempre es un entero ≥ 1 (lo exige el CHECK de la 0060)", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      const r = recompensaInicial(usable(tipo))!;
      expect(Number.isInteger(r.costo)).toBe(true);
      expect(r.costo).toBeGreaterThan(0);
    }
  });

  it("respeta los topes de los CHECK de la 0125", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      const r = recompensaInicial(usable(tipo))!;
      expect(r.nombre.length).toBeLessThanOrEqual(120);
      expect(r.nombre.trim().length).toBeGreaterThan(0);
      expect(r.instrucciones.length).toBeLessThanOrEqual(500);
      if (r.stockTotal !== null) expect(r.stockTotal).toBeGreaterThanOrEqual(1);
      if (r.limitePorCliente !== null) expect(r.limitePorCliente).toBeGreaterThanOrEqual(1);
      // `valor` solo tiene sentido en los descuentos, y con su rango.
      if (r.tipo === "descuento_porcentaje") {
        expect(r.valor).not.toBeNull();
        expect(r.valor!).toBeGreaterThan(0);
        expect(r.valor!).toBeLessThanOrEqual(100);
      }
      if (r.tipo === "descuento_fijo") {
        expect(r.valor).not.toBeNull();
        expect(r.valor!).toBeGreaterThan(0);
        expect(r.valor!).toBeLessThanOrEqual(10_000_000);
      }
      if (r.tipo !== "descuento_porcentaje" && r.tipo !== "descuento_fijo") {
        expect(r.valor).toBeNull();
      }
    }
  });

  it("las de presentación cuestan 1: el derecho de uso entra y se consume", () => {
    for (const tipo of ["cupon", "descuento", "membresia", "evento"] as const) {
      expect(recompensaInicial(usable(tipo))!.costo).toBe(1);
    }
  });

  it("las acumulativas cuestan lo que la tarjeta promete", () => {
    expect(recompensaInicial(usable("sellos"))!.costo).toBe(10);
    expect(recompensaInicial(usable("puntos"))!.costo).toBe(1);
    expect(recompensaInicial(usable("giftcard"))!.costo).toBe(10000);
    expect(recompensaInicial(usable("cashback"))!.costo).toBe(TRAMO_CASHBACK);
  });

  it("una tarjeta de sellos NO repetible solo se canjea una vez", () => {
    const repetible = recompensaInicial({
      tipo: "sellos",
      requeridos: 10,
      recompensa: "Un café",
      inicial: 0,
      repetible: true,
    })!;
    const unaVuelta = recompensaInicial({
      tipo: "sellos",
      requeridos: 10,
      recompensa: "Un café",
      inicial: 0,
      repetible: false,
    })!;
    expect(repetible.limitePorCliente).toBeNull();
    expect(unaVuelta.limitePorCliente).toBe(1);
  });

  it("el cupón hereda `usosPorCliente`, que antes no lo miraba nadie", () => {
    const r = recompensaInicial({
      tipo: "cupon",
      beneficio: { forma: "porcentaje", valor: 20 },
      compraMinima: 5000,
      descuentoMaximo: 3000,
      usosPorCliente: 3,
    })!;
    expect(r.limitePorCliente).toBe(3);
    expect(r.nombre).toBe("20% de descuento");
    // Los montos van con el MISMO formato de colón del resto del sitio.
    expect(r.instrucciones).toContain(formatearCRC(5000));
    expect(r.instrucciones).toContain(formatearCRC(3000));
  });

  it("la capacidad del evento se convierte en stock: no entra nadie de más", () => {
    const r = recompensaInicial({
      tipo: "evento",
      fecha: "2026-09-01",
      hora: "19:00",
      ubicacion: "Teatro Nacional",
      capacidad: 120,
    })!;
    expect(r.stockTotal).toBe(120);
    expect(r.limitePorCliente).toBe(1);
    expect(r.instrucciones).toContain("Teatro Nacional");
  });

  it("la membresía lleva sus beneficios adentro: el empleado los lee ahí", () => {
    const r = recompensaInicial({
      tipo: "membresia",
      nivel: "Oro",
      beneficios: ["10% siempre", "Café de cortesía"],
      vigenciaMeses: 12,
      renovacionAutomatica: false,
    })!;
    expect(r.instrucciones).toContain("10% siempre");
    expect(r.instrucciones).toContain("Café de cortesía");
    expect(r.vigenciaMeses).toBe(12);
  });

  it("un descuento de monto enorme no rompe el CHECK: cae a producto", () => {
    const r = recompensaInicial({
      tipo: "descuento",
      beneficio: { forma: "monto", valor: 99_000_000 },
      compraMinima: 0,
      descuentoMaximo: null,
      usosPorCliente: 1,
    })!;
    expect(r.tipo).toBe("producto");
    expect(r.valor).toBeNull();
  });

  it("sin nombre de premio no hay recompensa que sembrar", () => {
    expect(
      recompensaInicial({
        tipo: "sellos",
        requeridos: 10,
        recompensa: "   ",
        inicial: 0,
        repetible: true,
      }),
    ).toBeNull();
    expect(
      recompensaInicial({
        tipo: "membresia",
        nivel: "",
        beneficios: ["algo"],
        vigenciaMeses: 12,
        renovacionAutomatica: false,
      }),
    ).toBeNull();
  });
});
