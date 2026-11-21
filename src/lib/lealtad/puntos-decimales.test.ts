import { describe, expect, it } from "vitest";
import {
  aMoneda,
  aUnidades,
  beneficioEnMoneda,
  esPuntosConDecimales,
  formatearPuntos,
  MONEDA_DE_SIEMPRE,
  monedaDeTarjeta,
  tieneMonedaGuardada,
} from "./moneda-tarjeta";
import { acumulacionDe } from "./mostrador";
import { validarBeneficio, type ConfigBeneficio } from "./tipos-tarjeta";
import { textoPorVencerEnElPase } from "./vencimiento-sellos";
import { contextoDeEjemplo, renderizar } from "./impulsos/mensaje";
import type { ContextoCliente } from "./impulsos/tipos";
import { camposSegunModo } from "@/lib/wallet/tarjeta";

/**
 * ════════════════════════════════════════════════════════════════════
 *  PUNTOS CON DECIMALES (21 nov 2026) — etapa 1: lo que el motor sabe hacer
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño de Tostado: «necesitamos poder poner decimales» (4.75
 * puntos por una compra de $4.75). Una tarjeta de puntos que guarda `moneda`
 * y `escala: 100` cuenta CENTÉSIMOS de punto en el ledger, los premios y las
 * columnas de reglas, igual que el cashback cuenta centavos.
 *
 * Lo que más importa de este archivo es el reverso: una tarjeta de puntos que
 * YA existe (sin `escala`) tiene que seguir leyéndose, escribiéndose y
 * mostrándose igual, carácter por carácter.
 */

const USD = { codigo: "USD", escala: 100 } as const;

/** Los puntos de Tostado hoy: enteros, sin moneda ni escala. */
const ENTEROS = { tipo: "puntos", nombre: "puntos", porMoneda: 1, porVisita: 0, inicial: 0, minimoCanje: 1, maximo: null } as const;
/** Los mismos puntos, ya con decimales: lo que ahí es 1 punto, acá son 100 centésimos. */
const DECIMALES = { ...ENTEROS, moneda: "USD", escala: 100, minimoCanje: 100 } as const;

describe("monedaDeTarjeta — los puntos enteros de siempre no cambian", () => {
  it("unos puntos sin moneda ni escala son de siempre", () => {
    expect(monedaDeTarjeta(ENTEROS)).toEqual(MONEDA_DE_SIEMPRE);
    expect(tieneMonedaGuardada(ENTEROS)).toBe(false);
    expect(esPuntosConDecimales(ENTEROS)).toBe(false);
  });

  it("unos puntos con moneda pero SIN escala no se leen ×100 (a diferencia del cashback, la escala no se deduce de la tabla)", () => {
    const conMoneda = { ...ENTEROS, moneda: "USD" };
    expect(monedaDeTarjeta(conMoneda)).toEqual(MONEDA_DE_SIEMPRE);
    expect(tieneMonedaGuardada(conMoneda)).toBe(false);
    expect(esPuntosConDecimales(conMoneda)).toBe(false);
    // …mientras que un cashback sin escala sigue deduciéndola de la tabla.
    expect(monedaDeTarjeta({ tipo: "cashback", moneda: "USD" })).toEqual(USD);
  });

  it("escala 1 guardada: puntos enteros que recuerdan su moneda", () => {
    const b = { ...ENTEROS, moneda: "CRC", escala: 1 };
    expect(monedaDeTarjeta(b)).toEqual({ codigo: "CRC", escala: 1 });
    expect(tieneMonedaGuardada(b)).toBe(true);
    expect(esPuntosConDecimales(b)).toBe(false);
  });

  it("los demás tipos siguen sin llevar moneda", () => {
    expect(monedaDeTarjeta({ tipo: "sellos", moneda: "USD", escala: 100 })).toEqual(MONEDA_DE_SIEMPRE);
    expect(esPuntosConDecimales({ tipo: "cashback", moneda: "USD", escala: 100 })).toBe(false);
  });
});

describe("unos puntos con decimales", () => {
  it("se leen con su moneda y su escala (también del jsonb en texto)", () => {
    expect(monedaDeTarjeta(DECIMALES)).toEqual(USD);
    expect(monedaDeTarjeta(JSON.stringify(DECIMALES))).toEqual(USD);
    expect(tieneMonedaGuardada(DECIMALES)).toBe(true);
    expect(esPuntosConDecimales(DECIMALES)).toBe(true);
    expect(esPuntosConDecimales(JSON.stringify(DECIMALES))).toBe(true);
  });

  it("formatearPuntos: sin ceros de sobra y con coma de miles", () => {
    expect(formatearPuntos(475, USD)).toBe("4.75");
    expect(formatearPuntos(450, USD)).toBe("4.5");
    expect(formatearPuntos(500, USD)).toBe("5");
    expect(formatearPuntos(5, USD)).toBe("0.05");
    expect(formatearPuntos(0, USD)).toBe("0");
    expect(formatearPuntos(123_450, USD)).toBe("1,234.5");
    expect(formatearPuntos(-475, USD)).toBe("-4.75");
    // Enteros de siempre: el número tal cual.
    expect(formatearPuntos(475, MONEDA_DE_SIEMPRE)).toBe("475");
  });

  it("una compra de $4.75 a 1 punto por dólar da 4.75 puntos (el caso de Laura)", () => {
    // La compra entra en centavos y la tasa se aplica a esos centavos: 475 × 1 = 475 centésimos.
    const a = acumulacionDe(DECIMALES as ConfigBeneficio);
    const unidades = Math.floor(a.porColon * aUnidades(4.75, USD));
    expect(unidades).toBe(475);
    expect(aMoneda(unidades, USD)).toBe(4.75);
    // Y una compra con más centavos: $8.50 → 8.5 puntos; $0.99 → 0.99, redondeando hacia abajo lo que no cabe.
    expect(aMoneda(Math.floor(a.porColon * aUnidades(8.5, USD)), USD)).toBe(8.5);
    expect(aMoneda(Math.floor(0.5 * aUnidades(4.75, USD)), USD)).toBe(2.37); // 0.5 punto por dólar: 2.375 → 2.37
  });

  it("hacia Foorkie el beneficio sale en puntos; unos puntos enteros, el mismo objeto", () => {
    const b = { ...DECIMALES, porVisita: 50, inicial: 100, maximo: 100_000 };
    expect(beneficioEnMoneda(b)).toMatchObject({ porVisita: 0.5, inicial: 1, minimoCanje: 1, maximo: 1000, porMoneda: 1 });
    expect(beneficioEnMoneda(ENTEROS)).toBe(ENTEROS);
  });

  it("la validación acepta moneda y escala que cuadran y rechaza las que no", () => {
    expect(validarBeneficio(DECIMALES as ConfigBeneficio)).toBeNull();
    expect(validarBeneficio(ENTEROS as ConfigBeneficio)).toBeNull();
    expect(validarBeneficio({ ...ENTEROS, moneda: "USD" } as ConfigBeneficio)).toMatch(/moneda y escala/);
    expect(validarBeneficio({ ...ENTEROS, escala: 100 } as ConfigBeneficio)).toMatch(/moneda y escala/);
    expect(validarBeneficio({ ...DECIMALES, moneda: "XYZ" } as ConfigBeneficio)).toMatch(/moneda/);
    expect(validarBeneficio({ ...DECIMALES, escala: 7 } as ConfigBeneficio)).toMatch(/escala/);
    // Una moneda sin centavos no lleva puntos con decimales.
    expect(validarBeneficio({ ...DECIMALES, moneda: "CRC" } as ConfigBeneficio)).toMatch(/no usa decimales/);
    expect(validarBeneficio({ ...ENTEROS, moneda: "CRC", escala: 1 } as ConfigBeneficio)).toBeNull();
  });
});

describe("el pase del Wallet", () => {
  const config = { modo: "puntos" as const, pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null };

  it("dice «4.75», no los 475 centésimos, y lo que falta para el premio también", () => {
    const c = camposSegunModo({
      negocioNombre: "Tostado",
      saldo: 475,
      meta: { nombre: "Café gratis", costo_puntos: 1000 },
      config,
      beneficio: DECIMALES,
    });
    expect(c.encabezado).toEqual({ label: "PUNTOS", value: "4.75" });
    expect(c.detalle).toEqual({ label: "PARA TU PRÓXIMA REGALÍA", value: "Te faltan 5.25" });
    expect(c.regalia).toEqual({ label: "CANJEÁ POR", value: "Café gratis" });
  });

  it("sin premio, el saldo con decimales y el renglón de siempre", () => {
    const c = camposSegunModo({ negocioNombre: "Tostado", saldo: 1250, meta: null, config, beneficio: DECIMALES });
    expect(c.encabezado).toEqual({ label: "PUNTOS", value: "12.5" });
    expect(c.detalle).toEqual({ label: "ACUMULADOS", value: "Seguí sumando en cada visita" });
    expect(c.regalia).toBeNull();
  });

  it("unos puntos enteros de siempre salen byte por byte como antes", () => {
    const c = camposSegunModo({ negocioNombre: "Tostado", saldo: 475, meta: { nombre: "Café gratis", costo_puntos: 1000 }, config, beneficio: ENTEROS });
    expect(c.encabezado).toEqual({ label: "PUNTOS", value: "475" });
    expect(c.detalle).toEqual({ label: "PARA TU PRÓXIMA REGALÍA", value: "Te faltan 525" });
  });
});

describe("los mensajes automáticos y el aviso de vencimiento", () => {
  const conDecimales = (extra: Partial<ContextoCliente> = {}): ContextoCliente => ({
    ...contextoDeEjemplo("puntos", "Tostado", "Tarjeta de puntos"),
    // El contexto trae el saldo ya en puntos (aMoneda) y la moneda de la tarjeta.
    saldo: 4.75,
    meta: 10,
    moneda: USD,
    ...extra,
  });

  it("el saldo, la meta y lo que falta se escriben con decimales", () => {
    const ctx = conDecimales();
    expect(renderizar("Tienes {{puntos_disponibles}}", ctx).texto).toBe("Tienes 4.75");
    expect(renderizar("La meta es {{meta_puntos}}", ctx).texto).toBe("La meta es 10");
    expect(renderizar("Te faltan {{puntos_faltantes}}", ctx).texto).toBe("Te faltan 5.25");
  });

  it("unos puntos enteros de siempre: el mismo número redondeado de antes", () => {
    const ctx = contextoDeEjemplo("puntos", "Tostado", "Tarjeta de puntos");
    expect(renderizar("Tienes {{puntos_disponibles}}", ctx).texto).toBe("Tienes 180");
  });

  it("el aviso de vencimiento escribe los puntos con decimales", () => {
    const texto = textoPorVencerEnElPase({ tipo: "puntos", saldo: 475, venceEl: "2027-03-17", moneda: USD });
    expect(texto).toMatch(/^Tus 4\.75 puntos vencen el /);
    // Enteros: el texto de siempre.
    expect(textoPorVencerEnElPase({ tipo: "puntos", saldo: 475, venceEl: "2027-03-17" })).toMatch(/^Tus 475 puntos vencen el /);
    expect(textoPorVencerEnElPase({ tipo: "puntos", saldo: 1, venceEl: "2027-03-17" })).toMatch(/^Tu punto vence el /);
  });
});
