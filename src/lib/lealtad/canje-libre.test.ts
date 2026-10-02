import { describe, expect, it } from "vitest";
import {
  ayudaCashbackLibre,
  beneficioDeFoorkie,
  canjeLibreDe,
  leerMontoLibre,
  motivoCanjeLibre,
  motivoDelCanjeLibre,
  referenciaCanjeLibre,
  textosCashbackLibre,
  TOPE_CANJE_LIBRE,
} from "./canje-libre";
import { validarBeneficio, type ConfigBeneficio } from "./tipos-tarjeta";

/**
 * El cashback que se usa en el monto que el cliente quiera (0253). Lo que
 * se fija acá: quién tiene canje libre (solo con la marca en el
 * beneficio), el mínimo, el monto que se acepta y lo que dice el pase.
 */

const cashback = (extra: Partial<Extract<ConfigBeneficio, { tipo: "cashback" }>> = {}): ConfigBeneficio => ({
  tipo: "cashback",
  porcentaje: 5,
  compraMinima: 0,
  topePorCompra: null,
  ...extra,
});

describe("canjeLibreDe — ¿esta tarjeta usa el cashback en monto libre?", () => {
  it("solo un cashback con canjeLibre: true", () => {
    expect(canjeLibreDe(cashback({ canjeLibre: true }))).toEqual({ minimo: null });
    expect(canjeLibreDe(cashback())).toBeNull();
    expect(canjeLibreDe(cashback({ canjeLibre: false }))).toBeNull();
    expect(canjeLibreDe(null)).toBeNull();
    expect(
      canjeLibreDe({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 0, repetible: true }),
    ).toBeNull();
  });

  it("el mínimo: un entero mayor que 1; ₡1, decimales o basura = sin mínimo", () => {
    expect(canjeLibreDe(cashback({ canjeLibre: true, minimoCanje: 1000 }))).toEqual({ minimo: 1000 });
    expect(canjeLibreDe(cashback({ canjeLibre: true, minimoCanje: 1 }))).toEqual({ minimo: null });
    expect(canjeLibreDe(cashback({ canjeLibre: true, minimoCanje: null }))).toEqual({ minimo: null });
    expect(canjeLibreDe(cashback({ canjeLibre: true, minimoCanje: 999.5 }))).toEqual({ minimo: null });
    expect(canjeLibreDe(cashback({ canjeLibre: true, minimoCanje: TOPE_CANJE_LIBRE + 1 }))).toEqual({ minimo: null });
  });
});

describe("validarBeneficio — los dos campos nuevos del cashback", () => {
  it("son opcionales: una tarjeta guardada antes sigue siendo válida", () => {
    expect(validarBeneficio(cashback())).toBeNull();
    expect(validarBeneficio(cashback({ canjeLibre: true, minimoCanje: 500 }))).toBeNull();
    expect(validarBeneficio(cashback({ canjeLibre: true, minimoCanje: null }))).toBeNull();
  });

  it("el mínimo va en colones enteros de ₡1 a ₡10.000.000", () => {
    expect(validarBeneficio(cashback({ minimoCanje: 0 }))).toMatch(/mínimo para usar el saldo/);
    expect(validarBeneficio(cashback({ minimoCanje: 12.5 }))).toMatch(/colones enteros/);
    expect(validarBeneficio(cashback({ minimoCanje: 10_000_001 }))).toMatch(/10\.000\.000/);
  });

  it("canjeLibre es un booleano", () => {
    expect(validarBeneficio({ ...cashback(), canjeLibre: "sí" } as unknown as ConfigBeneficio)).toMatch(/true o false/);
  });
});

describe("lo que llega de la caja", () => {
  it("el monto: colones enteros de 1 a 10.000.000", () => {
    expect(leerMontoLibre(2500)).toBe(2500);
    expect(leerMontoLibre(1)).toBe(1);
    expect(leerMontoLibre(TOPE_CANJE_LIBRE)).toBe(TOPE_CANJE_LIBRE);
    expect(leerMontoLibre(0)).toBeNull();
    expect(leerMontoLibre(-5)).toBeNull();
    expect(leerMontoLibre(1500.5)).toBeNull();
    expect(leerMontoLibre("2500")).toBeNull();
    expect(leerMontoLibre(TOPE_CANJE_LIBRE + 1)).toBeNull();
    expect(leerMontoLibre(Number.NaN)).toBeNull();
  });

  it("la referencia: el prefijo `canje:` que la caja ya reconoce, una por intento", () => {
    expect(referenciaCanjeLibre("m-1", "i-1")).toBe("canje:m-1:cashback:i-1");
    expect(referenciaCanjeLibre("m-1", "i-2")).not.toBe(referenciaCanjeLibre("m-1", "i-1"));
  });

  it("el motivo del ledger dice quién operó, sin pasarse de 200", () => {
    expect(motivoCanjeLibre(null)).toBe("Canje: Cashback usado");
    expect(motivoCanjeLibre("Caja Foorkie · Ana")).toBe("Canje: Cashback usado (Caja Foorkie · Ana)");
    expect(motivoCanjeLibre("  Caja   Foorkie  ")).toBe("Canje: Cashback usado (Caja Foorkie)");
    expect(motivoCanjeLibre("x".repeat(500)).length).toBeLessThanOrEqual(200);
  });
});

describe("motivoDelCanjeLibre — el rechazo en palabras", () => {
  it("saldo insuficiente y mínimo, con el número enfrente", () => {
    expect(motivoDelCanjeLibre({ codigo: "saldo_insuficiente", saldo: 2350 })).toBe(
      `No le alcanza: tiene ₡${(2350).toLocaleString("es-CR")} de cashback.`,
    );
    expect(motivoDelCanjeLibre({ codigo: "debajo_del_minimo", minimo: 1000 })).toContain(`₡${(1000).toLocaleString("es-CR")}`);
    expect(motivoDelCanjeLibre({ codigo: "saldo_insuficiente" })).toMatch(/No le alcanza/);
  });

  it("un identificador desconocido no se lee en voz alta; una frase sí pasa", () => {
    expect(motivoDelCanjeLibre({ codigo: "rechazado", motivo: "tope-raro" })).toBe("No se pudo usar el cashback.");
    expect(motivoDelCanjeLibre({ codigo: "programa_no_opera", motivo: "El programa está en estado pausado y no canjea." })).toBe(
      "El programa está en estado pausado y no canjea.",
    );
    expect(motivoDelCanjeLibre({ codigo: "canje_no_libre" })).toMatch(/no usa el cashback/);
  });
});

describe("el pase de una tarjeta de cashback libre", () => {
  const n = (x: number) => `₡${x.toLocaleString("es-CR")}`;

  it("sin «CANJEÁ POR»: «Usalo cuando quieras»", () => {
    expect(textosCashbackLibre(2350, { minimo: null })).toEqual({
      detalle: { label: "TU CASHBACK", value: "Usalo cuando quieras" },
      regalia: null,
    });
  });

  it("sin saldo todavía: que se suma con cada compra", () => {
    expect(textosCashbackLibre(0, { minimo: null }).detalle.value).toBe("Se suma con cada compra");
  });

  it("con mínimo: cuánto le falta, y el mínimo en el renglón chico", () => {
    expect(textosCashbackLibre(350, { minimo: 1000 })).toEqual({
      detalle: { label: "TU CASHBACK", value: `Te faltan ${n(650)} para usarlo` },
      regalia: { label: "SE USA DESDE", value: n(1000) },
    });
    expect(textosCashbackLibre(1000, { minimo: 1000 }).detalle.value).toBe("Usalo cuando quieras");
  });

  it("el dorso cuenta cómo se usa", () => {
    expect(ayudaCashbackLibre({ minimo: null })).toMatch(/lo usás cuando quieras/);
    expect(ayudaCashbackLibre({ minimo: 500 })).toContain(`Se usa desde ${n(500)}.`);
  });
});

describe("beneficioDeFoorkie — el cashback que nace en Foorkie nace libre", () => {
  it("cashback → canjeLibre: true; lo demás, tal cual", () => {
    expect(beneficioDeFoorkie({ tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null })).toEqual({
      tipo: "cashback",
      porcentaje: 5,
      compraMinima: 0,
      topePorCompra: null,
      canjeLibre: true,
    });
    const sellos = { tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 0, repetible: true };
    expect(beneficioDeFoorkie(sellos)).toBe(sellos);
    expect(beneficioDeFoorkie(null)).toBeNull();
    expect(beneficioDeFoorkie("cashback")).toBe("cashback");
  });
});
