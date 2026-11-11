import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * POST /api/plataforma/foorkie/caja/usar — un uso de una tarjeta de SOCIO
 * desde la caja de Foorkie (11 nov 2026: las tarjetas de equipo de
 * «Tostado Café Bistró», 10 % de descuento en cada compra).
 *
 * El núcleo (`acreditarPorMiembroCore` y `canjearCore`) es de mentira y
 * anota con qué se lo llama: lo que se prueba es QUÉ decide la ruta —el
 * tipo, la pausa y la vigencia ANTES de escribir; los dos pasos con sus
 * llaves de idempotencia; un reintento que no cuenta otro uso— y lo que
 * le contesta a Foorkie. La firma, el vínculo (también el de una tarjeta
 * EXTRA, por la vista de Foorkie) y la lectura de la tarjeta son los de
 * verdad, sobre una base de mentira.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};

function consulta(tabla: string) {
  const filtros: [string, string, unknown][] = [];
  let unico = false;
  let contar = false;
  let limite: number | null = null;
  const b: Record<string, unknown> = {
    select: (_c?: string, o?: { count?: string; head?: boolean }) => {
      contar = !!o?.count;
      return b;
    },
    order: () => b,
    eq: (col: string, v: unknown) => {
      filtros.push(["eq", col, v]);
      return b;
    },
    in: (col: string, v: unknown[]) => {
      filtros.push(["in", col, v]);
      return b;
    },
    limit: (n: number) => {
      limite = n;
      return b;
    },
    maybeSingle: () => {
      unico = true;
      return b;
    },
    then: (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          const filas = (tablas[tabla] ?? []).filter((f) =>
            filtros.every(([op, col, v]) => (op === "eq" ? f[col] === v : (v as unknown[]).includes(f[col]))),
          );
          if (contar) return { data: null, count: filas.length, error: null };
          const cortadas = limite === null ? filas : filas.slice(0, limite);
          return { data: unico ? (cortadas[0] ?? null) : cortadas, error: null };
        })
        .then(ok, mal),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => consulta(t) }) }));

vi.mock("@/lib/lealtad/identidades-db", () => ({
  identidadesDeMiembros: async () => new Map([[MIEMBRO, { nombre: "Ana Pérez", correo: "ana@ejemplo.com" }]]),
  miembrosConIdentidad: async () => [],
}));

/** Los dos pasos del núcleo, de mentira: anotan su llave y simulan el índice único del canje. */
let llavesCanjeadas = new Set<string>();
let acreditacionesVistas = new Set<string>();
let rechazoDelCanje: { codigo: string; motivo: string } | null = null;
vi.mock("@/lib/lealtad/operar-core", () => ({
  acreditarPorMiembroCore: vi.fn(async (e: { referencia: string; miembroId: string; programaId?: string }) => {
    const ya = acreditacionesVistas.has(e.referencia);
    acreditacionesVistas.add(e.referencia);
    return { ok: true, cliente: "Ana", puntos: ya ? 0 : 1, saldo: 1, yaEstaba: ya, miembroId: e.miembroId, programaId: "x", tipo: "membresia" };
  }),
  canjearCore: vi.fn(async (e: { referencia: string }) => {
    if (rechazoDelCanje) return { ok: false, ...rechazoDelCanje };
    if (llavesCanjeadas.has(e.referencia)) return { ok: false, codigo: "ya-canjeado", motivo: "Ese canje ya se había hecho." };
    llavesCanjeadas.add(e.referencia);
    (tablas.transacciones_puntos ??= []).push({ miembro_id: MIEMBRO, tipo: "canjeado" });
    return { ok: true, saldo: 0, recompensa: "Beneficio de socio Equipo 1", sku: null, instrucciones: null };
  }),
}));

import { acreditarPorMiembroCore, canjearCore } from "@/lib/lealtad/operar-core";
import { POST } from "./route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PUNTOS = "22222222-2222-4222-8222-222222222222";
const EQUIPO_1 = "33333333-3333-4333-8333-333333333333";
const MIEMBRO = "44444444-4444-4444-8444-444444444444";
const INTENTO = "55555555-5555-4555-8555-555555555555";
const PREMIO = "66666666-6666-4666-8666-666666666666";

const SOCIO = { tipo: "membresia", nivel: "Equipo 1", beneficios: ["10 % de descuento"], porcentaje: 10, vigenciaMeses: 12, renovacionAutomatica: true };

async function usar(datos: Record<string, unknown>) {
  const texto = JSON.stringify(datos);
  const t = Date.now();
  const v1 = createHmac("sha256", SECRETO).update(`${t}.${texto}`).digest("hex");
  const r = await POST(
    new Request("https://www.bookea.lat/api/plataforma/foorkie/caja/usar", {
      method: "POST",
      headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
      body: texto,
    }),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

const pedido = (extra: Record<string, unknown> = {}) => ({
  rancho_id: RANCHO,
  programa_id: EQUIPO_1,
  miembro_id: MIEMBRO,
  intento_id: INTENTO,
  operador: "Ana · Fact. 001-45 · $8.50",
  ...extra,
});

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.mocked(acreditarPorMiembroCore).mockClear();
  vi.mocked(canjearCore).mockClear();
  llavesCanjeadas = new Set();
  acreditacionesVistas = new Set();
  rechazoDelCanje = null;
  const local = { id: "local-tostado", slug: "tostado", activo: true, estado_publicacion: "aprobado", created_at: "2026-11-11T00:00:00Z", lealtad_por_foorkie: true };
  tablas = {
    // La principal en la columna de siempre; la de socio, solo en la vista de Foorkie.
    foorkie_restaurantes: [{ ...local, bookea_rancho_id: RANCHO, bookea_programa_id: PUNTOS }],
    foorkie_lealtad_vinculos: [
      { ...local, bookea_rancho_id: RANCHO, bookea_programa_id: EQUIPO_1, principal: false, tarjeta_slug: "equipo-1", tarjeta_nombre: "Equipo 1", requiere_codigo: true },
    ],
    ranchos: [{ id: RANCHO, owner_id: "dueno-tostado", nombre: "Tostado Café Bistró" }],
    programa_lealtad: [
      { id: PUNTOS, rancho_id: RANCHO, nombre: "Puntos", modo: "puntos", estado: "activo", activo: true, beneficio: { tipo: "puntos", nombre: "puntos", porMoneda: 1, porVisita: 0, inicial: 0, minimoCanje: 1, maximo: null } },
      { id: EQUIPO_1, rancho_id: RANCHO, nombre: "Equipo 1", modo: "membresia", estado: "activo", activo: true, beneficio: SOCIO },
    ],
    recompensas: [{ id: PREMIO, programa_id: EQUIPO_1, nombre: "Beneficio de socio Equipo 1", costo_puntos: 1, activo: true, vigencia_hasta: null }],
    miembros: [
      { id: MIEMBRO, programa_id: EQUIPO_1, persona_id: "p-1", cliente_id: null, estado: "activa" },
      { id: MIEMBRO, programa_id: PUNTOS, persona_id: "p-1", cliente_id: null, estado: "activa" },
    ],
    transacciones_puntos: [],
  };
});

describe("caja/usar: un uso de la tarjeta de socio", () => {
  it("registra el derecho de uso y su canje, con las llaves del intento, y contesta el beneficio", async () => {
    const r = await usar(pedido());
    expect(r).toEqual({
      status: 200,
      cuerpo: {
        ok: true,
        ya_estaba: false,
        beneficio: { nombre: "Equipo 1", porcentaje: 10, texto: "10 % de descuento" },
        usos_total: 1,
        cliente: "Ana",
      },
    });
    expect(vi.mocked(acreditarPorMiembroCore).mock.calls[0][0]).toMatchObject({
      ranchoId: RANCHO,
      monto: null,
      miembroId: MIEMBRO,
      referencia: `mostrador:${MIEMBRO}:${INTENTO}`,
      via: "mostrador",
      // La factura y el monto quedan en el historial, en el producto del movimiento.
      producto: "Caja Foorkie · Ana · Fact. 001-45 · $8.50",
      quien: { usuarioId: "dueno-tostado" },
    });
    expect(vi.mocked(canjearCore).mock.calls[0][0]).toMatchObject({
      recompensaId: PREMIO,
      referencia: `canje:${MIEMBRO}:${PREMIO}:${INTENTO}`,
    });
  });

  it("el mismo intento otra vez: `ya_estaba`, no cuenta otro uso", async () => {
    await usar(pedido());
    const r = await usar(pedido());
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, ya_estaba: true, usos_total: 1 } });
  });

  it("si el canje se había cortado, el reintento lo completa (y ese uso sí cuenta)", async () => {
    rechazoDelCanje = { codigo: "error_base", motivo: "No pudimos entregar el premio." };
    expect(await usar(pedido())).toMatchObject({ status: 200, cuerpo: { ok: false, codigo: "error_base" } });
    rechazoDelCanje = null;
    expect(await usar(pedido())).toMatchObject({ status: 200, cuerpo: { ok: true, ya_estaba: false, usos_total: 1 } });
  });

  it("dos usos distintos (dos compras): dos usos", async () => {
    await usar(pedido());
    const r = await usar(pedido({ intento_id: "77777777-7777-4777-8777-777777777777" }));
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, ya_estaba: false, usos_total: 2 } });
  });
});

describe("caja/usar: lo que se decide ANTES de escribir", () => {
  it("una tarjeta de puntos no se usa: 400 tipo", async () => {
    const r = await usar(pedido({ programa_id: PUNTOS }));
    expect(r).toMatchObject({ status: 400, cuerpo: { ok: false, codigo: "tipo" } });
    expect(acreditarPorMiembroCore).not.toHaveBeenCalled();
    expect(canjearCore).not.toHaveBeenCalled();
  });

  it("en pausa (la tarjeta o el cliente): 409 pausada", async () => {
    tablas.miembros[0].estado = "pausada";
    expect(await usar(pedido())).toMatchObject({ status: 409, cuerpo: { codigo: "pausada" } });
    tablas.miembros[0].estado = "activa";
    tablas.programa_lealtad[1].estado = "pausado";
    tablas.programa_lealtad[1].activo = false;
    expect(await usar(pedido())).toMatchObject({ status: 409, cuerpo: { codigo: "pausada" } });
    expect(acreditarPorMiembroCore).not.toHaveBeenCalled();
  });

  it("el beneficio vencido: 409 vencida, sin dejar un derecho de uso colgando", async () => {
    tablas.recompensas[0].vigencia_hasta = "2020-01-01";
    expect(await usar(pedido())).toMatchObject({ status: 409, cuerpo: { codigo: "vencida" } });
    expect(acreditarPorMiembroCore).not.toHaveBeenCalled();
  });

  it("sin premio activo: 409 sin_beneficio", async () => {
    tablas.recompensas = [];
    expect(await usar(pedido())).toMatchObject({ status: 409, cuerpo: { codigo: "sin_beneficio" } });
    expect(acreditarPorMiembroCore).not.toHaveBeenCalled();
  });

  it("un cliente que no tiene esta tarjeta: miembro_ajeno", async () => {
    tablas.miembros = tablas.miembros.filter((m) => m.programa_id !== EQUIPO_1);
    expect(await usar(pedido())).toMatchObject({ status: 200, cuerpo: { ok: false, codigo: "miembro_ajeno" } });
  });

  it("una tarjeta que Foorkie no tiene (ni principal ni extra): 403 no_vinculado", async () => {
    tablas.foorkie_lealtad_vinculos = [];
    expect(await usar(pedido())).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
  });

  it("los datos: sin intento ni cliente, 400", async () => {
    expect(await usar(pedido({ intento_id: "x" }))).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    expect(await usar(pedido({ miembro_id: undefined }))).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
  });
});

describe("caja/usar: una de descuento también se usa", () => {
  it("el porcentaje sale del beneficio y el nombre del premio", async () => {
    tablas.programa_lealtad[1].modo = "descuento";
    tablas.programa_lealtad[1].beneficio = { tipo: "descuento", beneficio: { forma: "porcentaje", valor: 10 }, compraMinima: 0, descuentoMaximo: null, usosPorCliente: 10000 };
    tablas.recompensas[0].nombre = "10% de descuento";
    const r = await usar(pedido());
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, beneficio: { nombre: "10% de descuento", porcentaje: 10, texto: "10% de descuento" } } });
  });
});
