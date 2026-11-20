import { describe, expect, it } from "vitest";
import { leerPedidoCanjear } from "./foorkie-caja";
import {
  MAX_POR_RENGLON_CANJE,
  MAX_RENGLONES_CANJE,
  MAX_UNIDADES_CANJE,
  referenciaCanjeVarios,
  revisarPremios,
} from "@/lib/lealtad/canje-varios";

/**
 * Canjear VARIOS premios a la vez (0257): lo que la caja lee del pedido y
 * los topes. Un premio y un monto no cambian (`foorkie-caja-libre.test.ts`).
 */

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const INTENTO = "44444444-4444-4444-8444-444444444444";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };
const base = { ...vinculo, miembro_id: MIEMBRO, intento_id: INTENTO };

/** Un uuid distinto por número. */
const uuid = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const renglon = (n: number, cantidad = 1) => ({ recompensa_id: uuid(n), cantidad });

describe("leerPedidoCanjear — varios premios", () => {
  it("la lista, con el premio en minúscula y la cantidad", () => {
    expect(
      leerPedidoCanjear({ ...base, premios: [{ recompensa_id: uuid(1).toUpperCase(), cantidad: 4 }, renglon(2, 1)] }),
    ).toEqual({
      ok: true,
      valor: {
        ranchoId: RANCHO,
        programaId: PROGRAMA,
        miembroId: MIEMBRO,
        intentoId: INTENTO,
        premios: [
          { recompensaId: uuid(1), cantidad: 4 },
          { recompensaId: uuid(2), cantidad: 1 },
        ],
      },
    });
  });

  it("los topes: 10 renglones, 20 por renglón y 30 en total entran justos", () => {
    const diez = Array.from({ length: MAX_RENGLONES_CANJE }, (_, i) => renglon(i + 1, 3));
    expect(leerPedidoCanjear({ ...base, premios: diez })).toMatchObject({ ok: true });
    expect(leerPedidoCanjear({ ...base, premios: [renglon(1, MAX_POR_RENGLON_CANJE), renglon(2, 10)] })).toMatchObject({ ok: true });
    expect(MAX_UNIDADES_CANJE).toBe(30);
  });

  it("un renglón repetido: 400, no se suma a escondidas", () => {
    const r = leerPedidoCanjear({ ...base, premios: [renglon(1, 2), renglon(1, 1)] });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.motivo).toMatch(/repetido/);
    // El mismo uuid escrito en mayúscula es el mismo premio.
    expect(leerPedidoCanjear({ ...base, premios: [renglon(1), { recompensa_id: uuid(1).toUpperCase(), cantidad: 1 }] })).toMatchObject({ ok: false });
  });

  it("lista vacía, de más renglones, de más unidades o con una cantidad rara: no", () => {
    expect(leerPedidoCanjear({ ...base, premios: [] })).toMatchObject({ ok: false });
    const once = Array.from({ length: MAX_RENGLONES_CANJE + 1 }, (_, i) => renglon(i + 1));
    expect(leerPedidoCanjear({ ...base, premios: once })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, premios: [renglon(1, MAX_POR_RENGLON_CANJE + 1)] })).toMatchObject({ ok: false });
    // 3 × 11 = 33 unidades: cada renglón cabe, el total no.
    const treinta3 = [renglon(1, 11), renglon(2, 11), renglon(3, 11)];
    const total = leerPedidoCanjear({ ...base, premios: treinta3 });
    expect(total).toMatchObject({ ok: false });
    expect(total.ok === false && total.motivo).toMatch(/30 unidades/);
    for (const cantidad of [0, -1, 1.5, "2", null, Number.NaN, undefined]) {
      expect(leerPedidoCanjear({ ...base, premios: [{ recompensa_id: uuid(1), cantidad }] })).toMatchObject({ ok: false });
    }
  });

  it("renglones que no son { recompensa_id, cantidad }, o premios que no es una lista: no", () => {
    expect(leerPedidoCanjear({ ...base, premios: "x" })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, premios: {} })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, premios: [null] })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, premios: [[]] })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, premios: [{ cantidad: 1 }] })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, premios: [{ recompensa_id: "no-es-uuid", cantidad: 1 }] })).toMatchObject({ ok: false });
  });

  it("premios, recompensa_id y monto son excluyentes (exactamente uno)", () => {
    const uno = [renglon(1)];
    expect(leerPedidoCanjear({ ...base, premios: uno, recompensa_id: uuid(2) })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, premios: uno, monto: 1000 })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, premios: uno, recompensa_id: uuid(2), monto: 1000 })).toMatchObject({ ok: false });
    // Los dos modos de siempre siguen entrando por su camino.
    expect(leerPedidoCanjear({ ...base, recompensa_id: uuid(2) })).toMatchObject({ ok: true, valor: { recompensaId: uuid(2) } });
    expect(leerPedidoCanjear({ ...base, monto: 1000 })).toMatchObject({ ok: true, valor: { monto: 1000 } });
    // `premios: null` es «no vino».
    expect(leerPedidoCanjear({ ...base, premios: null, recompensa_id: uuid(2) })).toMatchObject({ ok: true });
  });

  it("sin cliente o sin intento: no", () => {
    expect(leerPedidoCanjear({ ...vinculo, intento_id: INTENTO, premios: [renglon(1)] })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...vinculo, miembro_id: MIEMBRO, premios: [renglon(1)] })).toMatchObject({ ok: false });
  });
});

describe("revisarPremios y la llave del canje de varios", () => {
  it("vale lo que cabe; si no, dice por qué", () => {
    expect(revisarPremios([{ recompensaId: uuid(1), cantidad: 4 }])).toBeNull();
    expect(revisarPremios([])).toMatch(/1 a 10/);
    expect(revisarPremios([{ recompensaId: uuid(1), cantidad: 0 }])).toMatch(/1 a 20/);
    expect(revisarPremios([{ recompensaId: uuid(1), cantidad: 1 }, { recompensaId: uuid(1), cantidad: 1 }])).toMatch(/repetido/);
  });

  it("la base es canje:<miembro>:<intento> y no se confunde con la de un premio suelto", () => {
    const base = referenciaCanjeVarios(MIEMBRO, INTENTO);
    expect(base).toBe(`canje:${MIEMBRO}:${INTENTO}`);
    // La unidad 12 del intento: `…:12`; un premio suelto termina en un uuid.
    expect(`${base}:12`).toMatch(/:[0-9]+$/);
    expect(`canje:${MIEMBRO}:${uuid(1)}:${INTENTO}`).not.toMatch(/:[0-9]+$/);
    // 6 + 36 + 1 + 36 + ":" + hasta 4 dígitos: de sobra bajo los 100 de la base.
    expect(`${base}:1000`.length).toBeLessThanOrEqual(100);
  });
});
