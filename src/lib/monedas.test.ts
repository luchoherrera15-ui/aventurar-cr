import { describe, expect, it } from "vitest";
import {
  banderaDe,
  ejemploTelefono,
  fmtMoneda,
  MONEDA,
  MONEDAS,
  monedaDe,
  monedaDelPais,
  nombreDeMoneda,
  numeroInternacional,
  PAIS,
  PAISES,
  paisDe,
  pasoDePrecio,
  redondearMonto,
} from "./monedas";

describe("el catálogo de países y monedas", () => {
  it("cada país tiene una moneda del catálogo", () => {
    for (const p of PAISES) expect(MONEDAS).toContain(PAIS[p].moneda);
  });
  it("cada moneda tiene símbolo, decimales y locale", () => {
    for (const m of MONEDAS) {
      expect(MONEDA[m].simbolo.length).toBeGreaterThan(0);
      expect([0, 2]).toContain(MONEDA[m].decimales);
      expect(MONEDA[m].locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });
  it("la bandera sale del código", () => {
    expect(banderaDe("CR")).toBe("🇨🇷");
    expect(banderaDe("MX")).toBe("🇲🇽");
  });
  it("los parsers caen a Costa Rica y colones", () => {
    expect(paisDe("XX")).toBe("CR");
    expect(paisDe(null)).toBe("CR");
    expect(paisDe("MX")).toBe("MX");
    expect(monedaDe("EUR")).toBe("CRC");
    expect(monedaDe("MXN")).toBe("MXN");
    expect(monedaDelPais("EC")).toBe("USD");
  });
});

describe("fmtMoneda", () => {
  it("colones: igual que fmtColones de siempre (es-CR agrupa con espacio fino)", () => {
    const plano = (s: string) => s.replace(/[  ]/g, " ");
    expect(plano(fmtMoneda(8900, "CRC"))).toBe("₡8 900");
    expect(plano(fmtMoneda(24200.4, "CRC"))).toBe("₡24 200");
    expect(plano(fmtMoneda(500, "CRC"))).toBe("₡500");
  });
  it("pesos mexicanos con centavos y coma de miles", () => {
    expect(fmtMoneda(120.5, "MXN")).toBe("$120.50");
    expect(fmtMoneda(1200, "MXN")).toBe("$1,200.00");
  });
  it("pesos colombianos y chilenos sin decimales, con punto de miles", () => {
    expect(fmtMoneda(15000, "COP")).toBe("$15.000");
    expect(fmtMoneda(15000, "CLP")).toBe("$15.000");
  });
  it("soles y reales llevan espacio", () => {
    expect(fmtMoneda(25, "PEN")).toBe("S/ 25.00");
    expect(fmtMoneda(1200.5, "BRL")).toBe("R$ 1.200,50");
  });
  it("el signo negativo va delante del símbolo", () => {
    expect(fmtMoneda(-500, "CRC")).toBe("-₡500");
  });
  it("redondea a los decimales de la moneda", () => {
    expect(redondearMonto(10.005, "MXN")).toBe(10.01);
    expect(redondearMonto(10.6, "CRC")).toBe(11);
    expect(pasoDePrecio("CRC")).toBe(1);
    expect(pasoDePrecio("USD")).toBe(0.01);
  });
  it("el nombre para una frase", () => {
    expect(nombreDeMoneda("MXN", "es")).toBe("peso mexicano (MXN)");
    expect(nombreDeMoneda("MXN", "en")).toBe("Mexican peso (MXN)");
    expect(nombreDeMoneda("MXN", "fr")).toBe("MXN");
  });
});

describe("numeroInternacional", () => {
  it("Costa Rica: ocho dígitos reciben el 506", () => {
    expect(numeroInternacional("8888-7777", "CR")).toBe("50688887777");
    expect(numeroInternacional("+506 8888 7777", "CR")).toBe("50688887777");
  });
  it("México: diez dígitos reciben el 52", () => {
    expect(numeroInternacional("55 1234 5678", "MX")).toBe("525512345678");
  });
  it("Argentina: el celular lleva 549", () => {
    expect(numeroInternacional("11 2345 6789", "AR")).toBe("5491123456789");
    expect(numeroInternacional("54 11 2345 6789", "AR")).toBe("5491123456789");
  });
  it("Panamá acepta siete y ocho dígitos", () => {
    expect(numeroInternacional("6123 4567", "PA")).toBe("50761234567");
  });
  it("vacío sigue vacío", () => {
    expect(numeroInternacional("", "CL")).toBe("");
  });
  it("el ejemplo tiene el largo local", () => {
    expect(ejemploTelefono("CR")).toHaveLength(8);
    expect(ejemploTelefono("MX")).toHaveLength(10);
  });
});
