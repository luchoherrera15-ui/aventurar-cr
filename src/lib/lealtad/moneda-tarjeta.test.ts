import { describe, expect, it } from "vitest";
import { formatearCRC } from "../dinero";
import {
  aMoneda,
  aUnidades,
  beneficioEnMoneda,
  formatearMonto,
  leerMontoDeAfuera,
  MONEDA_DE_SIEMPRE,
  MONEDAS_TARJETA,
  monedaDeTarjeta,
  monedaParaCrear,
  tieneMonedaGuardada,
} from "./moneda-tarjeta";
import { beneficioDeFoorkie, motivoDelCanjeLibre, textosCashbackLibre } from "./canje-libre";
import { acumulacionDe, recompensaInicial } from "./mostrador";
import { validarBeneficio, type ConfigBeneficio } from "./tipos-tarjeta";

const USD = { codigo: "USD", escala: 100 } as const;
const COP = { codigo: "COP", escala: 1 } as const;

describe("monedaDeTarjeta — lo que ya existía no cambia", () => {
  it("una tarjeta sin moneda es colones con escala 1", () => {
    expect(monedaDeTarjeta({ tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null })).toEqual(MONEDA_DE_SIEMPRE);
    expect(monedaDeTarjeta(null)).toEqual(MONEDA_DE_SIEMPRE);
    expect(monedaDeTarjeta("no es json")).toEqual(MONEDA_DE_SIEMPRE);
  });

  it("solo el cashback lleva moneda: unos sellos con `moneda` siguen siendo de siempre", () => {
    expect(monedaDeTarjeta({ tipo: "sellos", moneda: "USD", escala: 100 })).toEqual(MONEDA_DE_SIEMPRE);
  });

  it("lee la moneda y la escala guardadas (también del jsonb en texto)", () => {
    expect(monedaDeTarjeta({ tipo: "cashback", porcentaje: 5, moneda: "USD", escala: 100 })).toEqual(USD);
    expect(monedaDeTarjeta(JSON.stringify({ tipo: "cashback", porcentaje: 5, moneda: "COP", escala: 1 }))).toEqual(COP);
  });

  it("la escala guardada manda; si falta o está rota, la de la tabla", () => {
    expect(monedaDeTarjeta({ tipo: "cashback", moneda: "USD" })).toEqual(USD);
    expect(monedaDeTarjeta({ tipo: "cashback", moneda: "USD", escala: 7 })).toEqual(USD);
    expect(monedaDeTarjeta({ tipo: "cashback", moneda: "XYZ", escala: 100 })).toEqual(MONEDA_DE_SIEMPRE);
  });

  it("tieneMonedaGuardada distingue las nuevas de las de antes", () => {
    expect(tieneMonedaGuardada({ tipo: "cashback", porcentaje: 5 })).toBe(false);
    expect(tieneMonedaGuardada({ tipo: "cashback", moneda: "CRC", escala: 1 })).toBe(true);
    expect(tieneMonedaGuardada({ tipo: "sellos", moneda: "USD" })).toBe(false);
  });
});

describe("la tabla es el espejo de Foorkie", () => {
  it("decimales 0 o 2, y la escala de crear sale de ahí", () => {
    for (const [codigo, info] of Object.entries(MONEDAS_TARJETA)) {
      expect([0, 2]).toContain(info.decimales);
      expect(monedaParaCrear(codigo)?.escala).toBe(info.decimales === 2 ? 100 : 1);
    }
    expect(monedaParaCrear("usd")).toEqual(USD);
    expect(monedaParaCrear("XYZ")).toBeNull();
    expect(monedaParaCrear(null)).toBeNull();
  });
});

describe("conversión entre la moneda y el ledger", () => {
  it("dólares ↔ centavos, sin errores de coma flotante", () => {
    expect(aUnidades(15.5, USD)).toBe(1550);
    expect(aUnidades(1.005, USD)).toBe(101);
    expect(aUnidades(0.1 + 0.2, USD)).toBe(30);
    expect(aMoneda(77, USD)).toBe(0.77);
    expect(aMoneda(1550, USD)).toBe(15.5);
  });

  it("con escala 1 es la identidad (y redondea un decimal suelto)", () => {
    expect(aUnidades(4500, MONEDA_DE_SIEMPRE)).toBe(4500);
    expect(aUnidades(4500.4, MONEDA_DE_SIEMPRE)).toBe(4500);
    expect(aMoneda(1250, MONEDA_DE_SIEMPRE)).toBe(1250);
  });

  it("un monto de afuera: número finito, no negativo, bajo el techo de la base", () => {
    expect(leerMontoDeAfuera(2.5, USD, 1)).toBe(250);
    expect(leerMontoDeAfuera(0, USD, 1)).toBeNull();
    expect(leerMontoDeAfuera(-1, USD)).toBeNull();
    expect(leerMontoDeAfuera("5", USD)).toBeNull();
    expect(leerMontoDeAfuera(100_000, USD)).toBe(10_000_000);
    expect(leerMontoDeAfuera(100_000.01, USD)).toBeNull();
  });
});

describe("formatearMonto", () => {
  it("colones: exactamente `formatearCRC`, como siempre", () => {
    for (const n of [0, 1, 650, 1250, 1_000_000]) expect(formatearMonto(n, MONEDA_DE_SIEMPRE)).toBe(formatearCRC(n));
  });

  it("dólares con dos decimales y coma de miles, como `formatPrecio` de Foorkie", () => {
    expect(formatearMonto(77, USD)).toBe("$0.77");
    expect(formatearMonto(125_000, USD)).toBe("$1,250.00");
    expect(formatearMonto(1000, { codigo: "EUR", escala: 100 })).toBe("€10.00");
    expect(formatearMonto(1250, { codigo: "PEN", escala: 100 })).toBe("S/12.50");
  });

  it("monedas sin decimales: entero con su símbolo", () => {
    expect(formatearMonto(12_500, COP)).toBe("$12,500");
    expect(formatearMonto(3000, { codigo: "PYG", escala: 1 })).toBe("₲3,000");
  });
});

describe("el cashback de una tarjeta en dólares, de punta a punta", () => {
  const nace = beneficioDeFoorkie(
    { tipo: "cashback", porcentaje: 5, compraMinima: 2.5, topePorCompra: null, minimoCanje: 5 },
    USD,
  ) as Extract<ConfigBeneficio, { tipo: "cashback" }>;

  it("el alta guarda la moneda y pasa los montos a centavos", () => {
    expect(nace).toMatchObject({ tipo: "cashback", canjeLibre: true, moneda: "USD", escala: 100, compraMinima: 250, minimoCanje: 500 });
    expect(validarBeneficio(nace)).toBeNull();
  });

  it("el motor acredita centavos: 5 % de $15.50 son 77 centavos", () => {
    const a = acumulacionDe(nace);
    expect(Math.floor(a.porColon * aUnidades(15.5, USD))).toBe(77);
    expect(a.compraMinima).toBe(250);
  });

  it("el pase y la caja lo escriben en dólares", () => {
    const t = textosCashbackLibre(250, { minimo: 500 }, USD);
    expect(t.detalle.value).toBe("Te faltan $2.50 para usarlo");
    expect(t.regalia?.value).toBe("$5.00");
    expect(motivoDelCanjeLibre({ codigo: "saldo_insuficiente", saldo: 77 }, USD)).toBe("No le alcanza: tiene $0.77 de cashback.");
  });

  it("hacia Foorkie el beneficio sale en dólares; uno de colones, el mismo objeto", () => {
    expect(beneficioEnMoneda(nace)).toMatchObject({ compraMinima: 2.5, minimoCanje: 5 });
    const deSiempre = { tipo: "cashback", porcentaje: 5, compraMinima: 2000, topePorCompra: null };
    expect(beneficioEnMoneda(deSiempre)).toBe(deSiempre);
  });

  it("el premio de ejemplo son las mismas 1 000 unidades: $10.00 en dólares, ₡1 000 en colones", () => {
    expect(recompensaInicial(nace)?.nombre).toBe("$10.00 de tu cashback");
    expect(recompensaInicial({ tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null })?.nombre).toBe(
      `${formatearCRC(1000)} de tu cashback`,
    );
  });

  it("una moneda que no cuadra con su escala no se guarda", () => {
    expect(validarBeneficio({ ...nace, escala: 1 })).toMatch(/escala/);
    expect(validarBeneficio({ ...nace, moneda: "XYZ" })).toMatch(/moneda/);
    expect(validarBeneficio({ tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, escala: 100 })).toMatch(/colones/);
  });
});
