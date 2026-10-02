import { describe, expect, it, vi } from "vitest";
import { armarClienteDeLaCaja, leerPedidoCanjear } from "./foorkie-caja";
import { construirPassJson, type DatosTarjeta } from "@/lib/wallet/tarjeta";

/**
 * La caja de Foorkie con el cashback de canje libre (0253): lo que la
 * caja lee del pedido y lo que le devuelve del cliente.
 */

vi.mock("@/lib/lealtad/identidades-db", () => ({
  miembrosConIdentidad: async () => [],
  identidadesDeMiembros: async () => new Map(),
}));

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const INTENTO = "44444444-4444-4444-8444-444444444444";
const RECOMPENSA = "55555555-5555-4555-8555-555555555555";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

describe("leerPedidoCanjear — un premio O un monto", () => {
  it("el monto del cashback, con quién operó", () => {
    expect(leerPedidoCanjear({ ...vinculo, miembro_id: MIEMBRO, monto: 2500, intento_id: INTENTO, operador: " Ana " })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO, monto: 2500, intentoId: INTENTO, operador: "Ana" },
    });
  });

  it("el premio, como siempre (sin campos nuevos)", () => {
    expect(leerPedidoCanjear({ ...vinculo, miembro_id: MIEMBRO, recompensa_id: RECOMPENSA, intento_id: INTENTO })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO, recompensaId: RECOMPENSA, intentoId: INTENTO },
    });
  });

  it("los dos a la vez, un monto raro o sin intento: no", () => {
    expect(leerPedidoCanjear({ ...vinculo, miembro_id: MIEMBRO, recompensa_id: RECOMPENSA, monto: 1000, intento_id: INTENTO })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...vinculo, miembro_id: MIEMBRO, monto: 0, intento_id: INTENTO })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...vinculo, miembro_id: MIEMBRO, monto: 99.9, intento_id: INTENTO })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...vinculo, miembro_id: MIEMBRO, monto: "1000", intento_id: INTENTO })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...vinculo, miembro_id: MIEMBRO, monto: 1000 })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...vinculo, monto: 1000, intento_id: INTENTO })).toMatchObject({ ok: false });
  });
});

describe("armarClienteDeLaCaja — el cashback libre y lo que suma una compra", () => {
  const filaCashback = {
    id: PROGRAMA,
    rancho_id: RANCHO,
    modo: "cashback",
    estado: "activo",
    activo: true,
    compra_minima: 2000,
    max_por_transaccion: 300,
    beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 2000, topePorCompra: 300, canjeLibre: true, minimoCanje: 1000 },
  };

  it("canje_libre con su mínimo, y la compra mínima y el tope que aplica el motor", () => {
    const c = armarClienteDeLaCaja({
      miembroId: MIEMBRO,
      estadoMiembro: "activa",
      quien: { nombre: "Ana", correo: null },
      fila: filaCashback,
      negocio: "Donde George",
      saldo: 2350,
      recompensas: [{ id: RECOMPENSA, nombre: "₡1 000 de tu cashback", costo_puntos: 1000 }],
    });
    expect(c.canje_libre).toEqual({ minimo: 1000 });
    expect(c.acumulacion).toEqual({ compra_minima: 2000, tope_por_compra: 300 });
    // El pase dice «Usalo cuando quieras», no «Canjeá por ₡1 000».
    expect(c.textos.detalle).toEqual({ label: "TU CASHBACK", value: "Usalo cuando quieras" });
    expect(JSON.stringify(c.textos)).not.toMatch(/CANJEÁ POR/);
  });

  it("sin canje libre (las de Bookea), null: la caja canjea premios como siempre", () => {
    const c = armarClienteDeLaCaja({
      miembroId: MIEMBRO,
      estadoMiembro: "activa",
      quien: { nombre: "Ana", correo: null },
      fila: { ...filaCashback, compra_minima: null, max_por_transaccion: null, beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null } },
      negocio: "Pura Matcha",
      saldo: 2350,
      recompensas: [{ id: RECOMPENSA, nombre: "₡1 000 de tu cashback", costo_puntos: 1000 }],
    });
    expect(c.canje_libre).toBeNull();
    expect(c.acumulacion).toEqual({ compra_minima: null, tope_por_compra: null });
    expect(c.textos.regalia).toEqual({ label: "CANJEÁ POR", value: "₡1 000 de tu cashback" });
  });

  it("una tarjeta de sellos nunca tiene canje libre", () => {
    const c = armarClienteDeLaCaja({
      miembroId: MIEMBRO,
      estadoMiembro: "activa",
      quien: { nombre: "Ana", correo: null },
      fila: { id: PROGRAMA, rancho_id: RANCHO, modo: "sellos", estado: "activo", activo: true, beneficio: { tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 0, repetible: true, canjeLibre: true } },
      negocio: "X",
      saldo: 3,
      recompensas: [{ id: RECOMPENSA, nombre: "Café", costo_puntos: 10 }],
    });
    expect(c.canje_libre).toBeNull();
  });
});

describe("el pase de Apple de un cashback libre", () => {
  const base: DatosTarjeta = {
    negocioNombre: "Donde George",
    saldo: 350,
    meta: { nombre: "₡1 000 de tu cashback", costo_puntos: 1000 },
    config: { modo: "cashback", pase_color_fondo: "#1B2A6B", pase_color_sello: "#FCB700", pase_logo_url: null },
    beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, canjeLibre: true, minimoCanje: 1000 },
    serialNumber: "S-1",
    passTypeIdentifier: "pass.x",
    teamIdentifier: "T",
  };

  it("frente: saldo + cuánto le falta para usarlo + desde cuánto; dorso: cómo se usa", () => {
    const pase = construirPassJson(base) as {
      storeCard: {
        headerFields: { value: string }[];
        secondaryFields: { label: string; value: string }[];
        auxiliaryFields: { label: string; value: string }[];
        backFields: { key: string; value: string }[];
      };
    };
    const n = (x: number) => `₡${x.toLocaleString("es-CR")}`;
    expect(pase.storeCard.headerFields[0].value).toBe(n(350));
    expect(pase.storeCard.secondaryFields[0]).toMatchObject({ label: "TU CASHBACK", value: `Te faltan ${n(650)} para usarlo` });
    expect(pase.storeCard.auxiliaryFields).toEqual([{ key: "regalia", label: "SE USA DESDE", value: n(1000) }]);
    expect(pase.storeCard.backFields.find((f) => f.key === "como")?.value).toMatch(/lo usás cuando quieras/);
  });
});
