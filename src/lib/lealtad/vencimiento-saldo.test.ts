import { describe, expect, it } from "vitest";
import { atenderMiembro, vencerSellosDelDia, type AccionesVencimiento, type Admin } from "./vencer-sellos";
import {
  mesesGuardables,
  motivoDeCorte,
  reglaDeFila,
  SIN_REGLA,
  textoPorVencerEnElPase,
  tipoConVencimiento,
} from "./vencimiento-sellos";
import { contenidoDelObjeto } from "@/lib/wallet/google";
import { camposSegunModo, construirPassJson, type DatosTarjeta } from "@/lib/wallet/tarjeta";

/**
 * EL SALDO DE CASHBACK Y LOS PUNTOS TAMBIÉN VENCEN — solo en las tarjetas
 * de Foorkie (0253).
 *
 * Lo que se fija: que sin la marca de Foorkie TODO sigue como la 0180 (un
 * cashback no vence aunque alguien escriba la columna a mano), que con la
 * marca vence con el mismo reloj, la misma llave y el mismo aviso —que va
 * al pase y no por correo—, y que el pase dice qué vence.
 */

const cashbackConRegla = { id: "p-cb", rancho_id: "r-1", modo: "cashback", sellos_vencen_meses: 3, sellos_vencen_desde: "2025-01-01T00:00:00.000Z" };

describe("¿a quién se le puede vencer el saldo?", () => {
  it("sellos siempre; cashback y puntos solo con la marca de Foorkie; gift card nunca", () => {
    expect(tipoConVencimiento("sellos")).toBe(true);
    expect(tipoConVencimiento("cashback")).toBe(false);
    expect(tipoConVencimiento("puntos")).toBe(false);
    expect(tipoConVencimiento("cashback", { saldoTambien: true })).toBe(true);
    expect(tipoConVencimiento("puntos", { saldoTambien: true })).toBe(true);
    expect(tipoConVencimiento("giftcard", { saldoTambien: true })).toBe(false);
    expect(tipoConVencimiento("cupon", { saldoTambien: true })).toBe(false);
  });

  it("la columna escrita a mano en un cashback de Bookea NO vence nada", () => {
    expect(reglaDeFila(cashbackConRegla)).toEqual(SIN_REGLA);
    expect(reglaDeFila(cashbackConRegla, { saldoTambien: true })).toEqual({ meses: 3, desde: "2025-01-01T00:00:00.000Z" });
  });

  it("lo que se puede guardar: con la marca, también cashback y puntos", () => {
    expect(mesesGuardables("cashback", 6)).toBeNull();
    expect(mesesGuardables("cashback", 6, { saldoTambien: true })).toBe(6);
    expect(mesesGuardables("puntos", 99, { saldoTambien: true })).toBe(60);
    expect(mesesGuardables("giftcard", 6, { saldoTambien: true })).toBeNull();
  });
});

describe("lo que queda escrito y lo que se le dice al cliente", () => {
  it("el motivo del ledger: el de sellos, byte por byte; el de cashback y puntos dice qué venció", () => {
    expect(motivoDeCorte(3)).toBe("Sellos reiniciados: pasaron 3 meses sin visitas");
    expect(motivoDeCorte(1, "sellos")).toBe("Sellos reiniciados: pasó 1 mes sin visitas");
    expect(motivoDeCorte(3, "cashback")).toBe("Cashback vencido: pasaron 3 meses sin usar la tarjeta");
    expect(motivoDeCorte(1, "puntos")).toBe("Puntos vencidos: pasó 1 mes sin usar la tarjeta");
  });

  it("el aviso al pase: corto (entra en el pase), con el monto y la fecha", () => {
    const cb = textoPorVencerEnElPase({ tipo: "cashback", saldo: 2350, venceEl: "2026-12-17" });
    expect(cb).toBe(`Tus ₡${(2350).toLocaleString("es-CR")} de cashback vencen el 17 de diciembre de 2026. Usalos o volvé antes y no los perdés.`);
    // «setiembre», como se escribe en Costa Rica (`fechaLargaCR`).
    expect(textoPorVencerEnElPase({ tipo: "sellos", saldo: 1, venceEl: "2026-09-30" })).toBe(
      "Tu sello vence el 30 de setiembre de 2026. Volvé antes y no lo perdés.",
    );
    expect(textoPorVencerEnElPase({ tipo: "sellos", saldo: 7, venceEl: "2026-09-30" })).toBe(
      "Tus 7 sellos vencen el 30 de setiembre de 2026. Volvé antes y no los perdés.",
    );
    for (const tipo of ["cashback", "puntos", "sellos"] as const) {
      expect(textoPorVencerEnElPase({ tipo, saldo: 9_999_999, venceEl: "2026-09-30" }).length).toBeLessThanOrEqual(120);
    }
  });

  it("el pase de Apple: «Tu cashback vence» en el reverso, con la frase de cashback", () => {
    const datos: DatosTarjeta = {
      negocioNombre: "Donde George",
      saldo: 2350,
      meta: null,
      config: { modo: "cashback", pase_color_fondo: "#1B2A6B", pase_color_sello: "#FCB700", pase_logo_url: null },
      beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, canjeLibre: true },
      serialNumber: "S-1",
      passTypeIdentifier: "pass.x",
      teamIdentifier: "T",
      sellosVencenEl: "2026-12-17",
    };
    const pase = construirPassJson(datos) as { storeCard: { backFields: { key: string; label: string; value: string }[] } };
    const vence = pase.storeCard.backFields.find((f) => f.key === "vence");
    expect(vence?.label).toBe("Tu cashback vence");
    expect(vence?.value).toMatch(/si no usás tu tarjeta antes\. Cada compra o canje renueva el plazo/);
  });

  it("el pase de Google: el mismo título y la misma frase", () => {
    const objeto = contenidoDelObjeto({
      negocioNombre: "Donde George",
      saldo: 2350,
      config: { modo: "cashback", pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
      meta: { nombre: "₡1 000 de tu cashback", costo_puntos: 1000 },
      beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, canjeLibre: true },
      sellosVencenEl: "2026-12-17",
    });
    const vence = objeto.textModulesData?.find((m) => m.id === "vence");
    expect(vence?.header).toBe("Tu cashback vence");
    // Y sin el módulo del tramo: el cashback libre no tiene «₡1 000 de tu cashback» que alcanzar.
    expect(objeto.textModulesData?.some((m) => m.id === "meta")).toBe(false);
    expect(objeto.textModulesData?.find((m) => m.id === "beneficio")).toEqual({
      id: "beneficio",
      header: "Tu cashback",
      body: "Usalo cuando quieras",
    });
  });

  it("una tarjeta de cashback de Bookea sigue diciendo «CANJEÁ POR» (byte por byte)", () => {
    const c = camposSegunModo({
      negocioNombre: "Pura Matcha",
      saldo: 2350,
      meta: { nombre: "₡1 000 de tu cashback", costo_puntos: 1000 },
      config: { modo: "cashback", pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
      beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null },
    });
    expect(c.detalle).toEqual({ label: "ACUMULADO", value: "Se descuenta en tu próxima compra" });
    expect(c.regalia).toEqual({ label: "CANJEÁ POR", value: "₡1 000 de tu cashback" });
  });
});

// ── El barrido ───────────────────────────────────────────────────────

function espia(): { acciones: AccionesVencimiento; avisos: unknown[]; reinicios: { motivo: string; sellos: number; referencia: string }[] } {
  const avisos: unknown[] = [];
  const reinicios: { motivo: string; sellos: number; referencia: string }[] = [];
  return {
    avisos,
    reinicios,
    acciones: {
      async registrarReinicio(a) {
        reinicios.push({ motivo: a.motivo, sellos: a.sellos, referencia: a.referencia });
        return { ok: true };
      },
      async marcarPase() {
        return true;
      },
      async avisarPase() {},
      async reclamarAviso() {
        return true;
      },
      async enviarAviso(a) {
        avisos.push(a);
      },
    },
  };
}

const regla = { meses: 3, desde: "2025-01-01T00:00:00.000Z" };

describe("atenderMiembro con un cashback de Foorkie", () => {
  it("el aviso lleva el tipo y que es de Foorkie (va al pase)", async () => {
    const { acciones, avisos } = espia();
    const res = await atenderMiembro({
      miembro: { id: "m-1", saldo: 2350, ultimoMovimiento: "2026-01-10T15:00:00.000Z", saldoCache: null },
      regla,
      hoy: "2026-04-01",
      zona: "America/Costa_Rica",
      acciones,
      tipo: "cashback",
      deFoorkie: true,
    });
    expect(res).toBe("avisado");
    expect(avisos).toEqual([{ miembroId: "m-1", venceEl: "2026-04-10", saldo: 2350, tipo: "cashback", deFoorkie: true }]);
  });

  it("una tarjeta de Bookea: el aviso de siempre, campo por campo", async () => {
    const { acciones, avisos } = espia();
    await atenderMiembro({
      miembro: { id: "m-1", saldo: 5, ultimoMovimiento: "2026-01-10T15:00:00.000Z", saldoCache: null },
      regla,
      hoy: "2026-04-01",
      zona: "America/Costa_Rica",
      acciones,
    });
    expect(avisos).toEqual([{ miembroId: "m-1", venceEl: "2026-04-10", saldo: 5 }]);
  });

  it("vencido: todo el cashback, con su motivo y la misma llave de siempre", async () => {
    const { acciones, reinicios } = espia();
    const res = await atenderMiembro({
      miembro: { id: "m-1", saldo: 2350, ultimoMovimiento: "2026-01-10T15:00:00.000Z", saldoCache: 2350 },
      regla,
      hoy: "2026-04-10",
      zona: "America/Costa_Rica",
      acciones,
      tipo: "cashback",
      deFoorkie: true,
    });
    expect(res).toBe("reiniciado");
    expect(reinicios).toEqual([{ motivo: "Cashback vencido: pasaron 3 meses sin usar la tarjeta", sellos: 2350, referencia: "venc:2026-04-10" }]);
  });
});

/** Una base de mentira para la corrida entera (solo lee). */
function baseDeLectura(tablas: Record<string, Record<string, unknown>[]>): Admin {
  const db = {
    from(tabla: string) {
      const eqs: [string, unknown][] = [];
      const ins: [string, unknown[]][] = [];
      const b = {
        select: () => b,
        eq: (c: string, v: unknown) => {
          eqs.push([c, v]);
          return b;
        },
        in: (c: string, vs: unknown[]) => {
          ins.push([c, vs]);
          return b;
        },
        then: (ok: (r: unknown) => unknown) =>
          Promise.resolve({
            data: (tablas[tabla] ?? []).filter((f) => eqs.every(([c, v]) => f[c] === v) && ins.every(([c, vs]) => vs.includes(f[c]))),
            error: null,
          }).then(ok),
      };
      return b;
    },
  };
  return db as unknown as Admin;
}

describe("vencerSellosDelDia — la corrida", () => {
  const tablas = {
    programa_lealtad: [cashbackConRegla],
    ranchos: [{ id: "r-1", zona_horaria: "America/Costa_Rica" }],
    miembros: [{ id: "m-1", programa_id: "p-cb" }],
    transacciones_puntos: [{ miembro_id: "m-1", puntos: 2350, created_at: "2026-01-10T15:00:00.000Z" }],
    pases_wallet: [],
  };

  it("un cashback con la columna escrita pero SIN la marca de Foorkie: no se mira", async () => {
    const { acciones, reinicios, avisos } = espia();
    const r = await vencerSellosDelDia({
      db: baseDeLectura(tablas),
      ahora: new Date("2026-04-10T18:00:00.000Z"),
      acciones,
      deFoorkie: async () => new Set(),
    });
    expect(r.programas).toBe(0);
    expect(reinicios).toEqual([]);
    expect(avisos).toEqual([]);
  });

  it("con la marca de Foorkie: vence, con el motivo de cashback", async () => {
    const { acciones, reinicios } = espia();
    const preguntadas: unknown[] = [];
    const r = await vencerSellosDelDia({
      db: baseDeLectura(tablas),
      ahora: new Date("2026-04-10T18:00:00.000Z"),
      acciones,
      deFoorkie: async (_db, tarjetas) => {
        preguntadas.push(...tarjetas);
        return new Set(["p-cb"]);
      },
    });
    expect(preguntadas).toEqual([{ id: "p-cb", rancho_id: "r-1" }]);
    expect(r).toMatchObject({ programas: 1, mirados: 1, reiniciados: 1 });
    expect(reinicios[0]).toMatchObject({ motivo: "Cashback vencido: pasaron 3 meses sin usar la tarjeta", sellos: 2350 });
  });

  it("si saber cuáles son de Foorkie falla, ninguna vence su saldo (nadie pierde plata por eso)", async () => {
    const { acciones, reinicios } = espia();
    const r = await vencerSellosDelDia({
      db: baseDeLectura({ ...tablas }),
      ahora: new Date("2026-04-10T18:00:00.000Z"),
      acciones,
      // La de verdad, contra una base sin la tabla de Foorkie: contesta vacío.
    });
    expect(r.programas).toBe(0);
    expect(reinicios).toEqual([]);
  });
});
