import { describe, expect, it, vi } from "vitest";

/**
 * ¿El cliente tiene el pase en el teléfono? (19 oct 2026), para la ficha
 * de `clientes/detalle`. Lo que se fija: qué fila cuenta por plataforma
 * (la activa, si no la más nueva), cómo se decide «instalado» en Apple
 * (registros de teléfonos) y en Google (lo que contestó Google), que una
 * falla de la base deja `null` sin lanzar y que nunca sale el serial ni
 * nada del teléfono. `clientes/route.test.ts` lo prueba de punta a punta
 * con la puerta firmada.
 */

// El lector recibe la consulta a Google inyectada: el módulo real no hace falta.
vi.mock("@/lib/wallet/google", () => ({ paseGoogleGuardado: vi.fn(async () => null) }));

import {
  armarPasesDelCliente,
  elegirPasesPorPlataforma,
  filaDePase,
  pasesDelCliente,
  type FilaDePase,
} from "./foorkie-pases";

const MIEMBRO = "33333333-3333-4333-8333-333333333333";

let n = 0;
function pase(extra: Partial<FilaDePase> & Pick<FilaDePase, "plataforma">): FilaDePase {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    serial: `serial-${n}`,
    activo: true,
    created_at: "2026-09-01T10:00:00+00:00",
    ultima_descarga_en: null,
    objeto_externo: null,
    ...extra,
  };
}

describe("filaDePase: una fila cruda de pases_wallet", () => {
  it("lee lo necesario y descarta lo que no sirve", () => {
    expect(
      filaDePase({
        id: "p1",
        miembro_id: MIEMBRO,
        plataforma: "apple",
        serial_number: "abc",
        auth_token: "secreto",
        activo: false,
        created_at: "2026-09-01T10:00:00+00:00",
        ultima_descarga_en: "2026-09-05T10:00:00+00:00",
        objeto_externo: null,
      }),
    ).toEqual({
      id: "p1",
      plataforma: "apple",
      serial: "abc",
      activo: false,
      created_at: "2026-09-01T10:00:00+00:00",
      ultima_descarga_en: "2026-09-05T10:00:00+00:00",
      objeto_externo: null,
    });
    expect(filaDePase({ id: "p1", plataforma: "android", serial_number: "abc", created_at: "2026-09-01T10:00:00Z" })).toBeNull();
    expect(filaDePase({ id: "p1", plataforma: "apple", created_at: "2026-09-01T10:00:00Z" })).toBeNull();
    expect(filaDePase(null)).toBeNull();
  });

  it("en una base sin la 0138 ni la 0151 (sin `activo` ni `ultima_descarga_en`), la fila cuenta como activa", () => {
    expect(filaDePase({ id: "p1", plataforma: "google", serial_number: "g", created_at: "2026-09-01T10:00:00Z" })).toMatchObject({
      activo: true,
      ultima_descarga_en: null,
      objeto_externo: null,
    });
  });
});

describe("elegirPasesPorPlataforma: una por plataforma", () => {
  it("manda la activa aunque haya una heredada más nueva", () => {
    const vieja = pase({ plataforma: "apple", created_at: "2026-08-01T10:00:00Z" });
    const heredada = pase({ plataforma: "apple", activo: false, created_at: "2026-10-01T10:00:00Z" });
    expect(elegirPasesPorPlataforma([heredada, vieja])).toEqual([vieja]);
  });

  it("sin activa, la más nueva", () => {
    const una = pase({ plataforma: "google", activo: false, created_at: "2026-08-01T10:00:00Z" });
    const otra = pase({ plataforma: "google", activo: false, created_at: "2026-09-01T10:00:00Z" });
    expect(elegirPasesPorPlataforma([una, otra])).toEqual([otra]);
  });

  it("Apple primero, después Google; sin filas, nada", () => {
    const g = pase({ plataforma: "google" });
    const a = pase({ plataforma: "apple" });
    expect(elegirPasesPorPlataforma([g, a]).map((f) => f.plataforma)).toEqual(["apple", "google"]);
    expect(elegirPasesPorPlataforma([])).toEqual([]);
  });
});

describe("armarPasesDelCliente: el estado de cada pase", () => {
  it("Apple con teléfonos registrados: instalado, desde el registro más viejo y cuántos", () => {
    const a = pase({ plataforma: "apple", serial: "s-ana", created_at: "2026-09-01T10:00:00+00:00", ultima_descarga_en: "2026-10-10T08:00:00+00:00" });
    const r = armarPasesDelCliente({
      filas: [a],
      registros: [
        { serial: "s-ana", created_at: "2026-09-03T12:00:00+00:00" },
        { serial: "s-ana", created_at: "2026-09-02T09:00:00+00:00" },
        { serial: "otro-serial", created_at: "2026-08-01T09:00:00+00:00" },
      ],
      googleGuardado: null,
    });
    expect(r).toEqual([
      {
        plataforma: "apple",
        estado: "instalado",
        pedido: "2026-09-01T10:00:00.000Z",
        desde: "2026-09-02T09:00:00.000Z",
        dispositivos: 2,
        ultima_vez: "2026-10-10T08:00:00.000Z",
      },
    ]);
  });

  it("Apple sin ningún teléfono: no_instalado (se emitió pero no está en ningún lado)", () => {
    const a = pase({ plataforma: "apple", serial: "s-1" });
    expect(armarPasesDelCliente({ filas: [a], registros: [], googleGuardado: null })).toEqual([
      { plataforma: "apple", estado: "no_instalado", pedido: "2026-09-01T10:00:00.000Z", desde: null, dispositivos: 0, ultima_vez: null },
    ]);
  });

  it("Google según lo que contestó Google: true, false o no se sabe", () => {
    const g = pase({ plataforma: "google" });
    const estado = (googleGuardado: boolean | null) => armarPasesDelCliente({ filas: [g], registros: [], googleGuardado })[0];
    expect(estado(true)).toEqual({ plataforma: "google", estado: "instalado", pedido: "2026-09-01T10:00:00.000Z", desde: null, dispositivos: null, ultima_vez: null });
    expect(estado(false).estado).toBe("no_instalado");
    expect(estado(null).estado).toBe("sin_confirmar");
  });

  it("cuenta solo la fila elegida: un teléfono del pase heredado no hace instalado al activo", () => {
    const activo = pase({ plataforma: "apple", serial: "s-activo" });
    const heredado = pase({ plataforma: "apple", serial: "s-heredado", activo: false, created_at: "2026-10-01T10:00:00Z" });
    const r = armarPasesDelCliente({ filas: [activo, heredado], registros: [{ serial: "s-heredado", created_at: "2026-10-02T10:00:00Z" }], googleGuardado: null });
    expect(r).toEqual([expect.objectContaining({ estado: "no_instalado", dispositivos: 0 })]);
  });

  it("nunca sale el serial ni nada del teléfono", () => {
    const a = pase({ plataforma: "apple", serial: "SERIAL-SECRETO" });
    const g = pase({ plataforma: "google", serial: "SERIAL-G", objeto_externo: "issuer.miembro_x" });
    const r = armarPasesDelCliente({ filas: [a, g], registros: [{ serial: "SERIAL-SECRETO", created_at: "2026-09-02T10:00:00Z" }], googleGuardado: true });
    expect(JSON.stringify(r)).not.toMatch(/SERIAL|issuer\.miembro|0000-4000/);
    for (const p of r) expect(Object.keys(p).sort()).toEqual(["desde", "dispositivos", "estado", "pedido", "plataforma", "ultima_vez"]);
  });
});

/** Una base de mentira: cada tabla devuelve sus filas filtradas por `eq`, o un error. */
function base(tablas: Record<string, Record<string, unknown>[]>, fallan: string[] = []) {
  const pedidos: { tabla: string; filtros: unknown[][] }[] = [];
  return {
    pedidos,
    db: {
      from(tabla: string) {
        const filtros: unknown[][] = [];
        pedidos.push({ tabla, filtros });
        const q: Record<string, unknown> = {};
        for (const m of ["select", "eq", "limit"]) {
          q[m] = (...args: unknown[]) => {
            filtros.push([m, ...args]);
            return q;
          };
        }
        q.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
          Promise.resolve()
            .then(() => {
              if (fallan.includes(tabla)) return { data: null, error: { message: "se cayó" } };
              let filas = tablas[tabla] ?? [];
              for (const [m, col, val] of filtros as [string, string, unknown][]) {
                if (m === "eq") filas = filas.filter((f) => f[col] === val);
              }
              return { data: filas, error: null };
            })
            .then(ok, mal);
        return q;
      },
    } as never,
  };
}

const filaApple = { id: "pa", miembro_id: MIEMBRO, plataforma: "apple", serial_number: "s-apple", auth_token: "tok", activo: true, created_at: "2026-09-01T10:00:00+00:00" };
const filaGoogle = { id: "pg", miembro_id: MIEMBRO, plataforma: "google", serial_number: "s-google", auth_token: "tok", activo: true, created_at: "2026-09-04T10:00:00+00:00", objeto_externo: "issuer.miembro_viejo" };

describe("pasesDelCliente: el lector", () => {
  it("lee los pases del miembro, los teléfonos del serial de Apple y le pregunta a Google por el objeto guardado", async () => {
    const { db, pedidos } = base({
      pases_wallet: [filaApple, filaGoogle, { ...filaApple, id: "otro", miembro_id: "otro-miembro", serial_number: "s-otro" }],
      registros_dispositivo: [{ serial_number: "s-apple", created_at: "2026-09-01T11:00:00+00:00", push_token: "push", device_library_id: "dev" }],
    });
    const google = vi.fn(async () => true);
    const r = await pasesDelCliente(db, MIEMBRO, google);
    expect(r).toEqual([
      { plataforma: "apple", estado: "instalado", pedido: "2026-09-01T10:00:00.000Z", desde: "2026-09-01T11:00:00.000Z", dispositivos: 1, ultima_vez: null },
      { plataforma: "google", estado: "instalado", pedido: "2026-09-04T10:00:00.000Z", desde: null, dispositivos: null, ultima_vez: null },
    ]);
    expect(google).toHaveBeenCalledWith(MIEMBRO, "issuer.miembro_viejo");
    expect(pedidos.find((p) => p.tabla === "registros_dispositivo")?.filtros).toContainEqual(["eq", "serial_number", "s-apple"]);
    expect(JSON.stringify(r)).not.toMatch(/push|dev|tok|s-apple/);
  });

  it("sin pases: [] y ni se pregunta a Google ni a los teléfonos", async () => {
    const { db, pedidos } = base({ pases_wallet: [] });
    const google = vi.fn(async () => true);
    expect(await pasesDelCliente(db, MIEMBRO, google)).toEqual([]);
    expect(google).not.toHaveBeenCalled();
    expect(pedidos.map((p) => p.tabla)).toEqual(["pases_wallet"]);
  });

  it("solo Google: no lee registros_dispositivo", async () => {
    const { db, pedidos } = base({ pases_wallet: [filaGoogle] });
    expect(await pasesDelCliente(db, MIEMBRO, async () => false)).toEqual([expect.objectContaining({ plataforma: "google", estado: "no_instalado" })]);
    expect(pedidos.map((p) => p.tabla)).toEqual(["pases_wallet"]);
  });

  it("si falla pases_wallet o registros_dispositivo: null, sin lanzar", async () => {
    expect(await pasesDelCliente(base({ pases_wallet: [filaApple] }, ["pases_wallet"]).db, MIEMBRO, async () => true)).toBeNull();
    expect(await pasesDelCliente(base({ pases_wallet: [filaApple] }, ["registros_dispositivo"]).db, MIEMBRO, async () => true)).toBeNull();
  });

  it("si la consulta a Google lanza, Google queda sin_confirmar y Apple sigue", async () => {
    const { db } = base({ pases_wallet: [filaApple, filaGoogle], registros_dispositivo: [] });
    const r = await pasesDelCliente(db, MIEMBRO, async () => {
      throw new Error("Google se cayó");
    });
    expect(r?.map((p) => [p.plataforma, p.estado])).toEqual([
      ["apple", "no_instalado"],
      ["google", "sin_confirmar"],
    ]);
  });

  it("si la base misma lanza: null", async () => {
    const db = {
      from() {
        throw new Error("sin conexión");
      },
    } as never;
    expect(await pasesDelCliente(db, MIEMBRO, async () => true)).toBeNull();
  });
});
