import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Los lectores de clientes del panel de Foorkie (2 oct 2026: «ver quién es
 * el que más sellos lleva, quién ha canjeado y cuántas veces»): las cuentas
 * de cada cliente sobre el ledger, los órdenes, los totales y el detalle de
 * un cliente con sus movimientos. Solo leen. `foorkie-panel.test.ts` tiene
 * la lista de siempre (sin `orden`).
 */

vi.mock("@/lib/lealtad/identidades-db", () => ({
  miembrosConIdentidad: vi.fn(async () => []),
  identidadesDeMiembros: vi.fn(async (_db: unknown, miembros: { id: string }[]) =>
    new Map(miembros.map((m) => [m.id, IDENTIDADES[m.id] ?? { nombre: null, correo: null, telefono: null }])),
  ),
}));
vi.mock("@/lib/lealtad/plan-del-negocio", () => ({ planDelNegocio: vi.fn(async () => "arranque") }));
vi.mock("@/lib/wallet/mensaje-promocional", () => ({ enviarMensajePromocional: vi.fn() }));
vi.mock("@/lib/wallet/aviso-de-pausa", () => ({ plataformasConfiguradas: vi.fn(() => ["apple", "google"]) }));
vi.mock("@/lib/wallet/aviso-de-diseno", () => ({ avisarCambioDeDiseno: vi.fn() }));
vi.mock("@/lib/wallet/google", () => ({ refrescarClaseGoogle: vi.fn() }));

import { identidadesDeMiembros } from "@/lib/lealtad/identidades-db";
import type { FilaLedger } from "@/lib/plataforma/foorkie-caja";
import {
  agregadosPorMiembro,
  clientesDeLaTarjeta,
  cuentasDeLaTarjeta,
  detalleDelCliente,
  leerPedidoClientes,
  leerPedidoDetalleCliente,
  movimientoParaFoorkie,
  movimientosDelCliente,
  nombreDeQuienOpera,
  operadorDeLaCaja,
  ordenarMiembros,
  resumenDeClientes,
  type AgregadoDelMiembro,
  type MiembroDelPanel,
  type PedidoClientes,
} from "./foorkie-panel";

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const DUENO = "99999999-9999-4999-8999-999999999999";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

const IDENTIDADES: Record<string, { nombre: string | null; correo: string | null; telefono: string | null }> = {
  "m-ana": { nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: "+506 8888-7777" },
  "m-beto": { nombre: null, correo: "beto@correo.cr", telefono: "70112233" },
  "m-jose": { nombre: "José Hernández", correo: "jose@hotmail.com", telefono: null },
  "m-zoe": { nombre: "Zoe", correo: "zoe@x.cr", telefono: null },
};

const miembro = (id: string, created_at: string, estado: "activa" | "pausada" = "activa"): MiembroDelPanel => ({
  id,
  cliente_id: null,
  persona_id: `p-${id}`,
  estado,
  created_at,
});

const cuenta = (c: Partial<AgregadoDelMiembro>): AgregadoDelMiembro => ({
  saldo: 0,
  acumulado: 0,
  visitas: 0,
  canjes: 0,
  ultimoCanje: null,
  ultima: null,
  ...c,
});

// ── Una base de mentira que aplica los filtros (y sabe de `rpc`) ────

type Fila = Record<string, unknown>;
type Consulta = { tabla: string; filtros: unknown[][] };

function baseEnMemoria(tablas: Record<string, Fila[]>, opciones: { rpc?: (args: Record<string, unknown>) => { data?: Fila[]; error?: unknown } } = {}) {
  const consultas: Consulta[] = [];
  const armar = (tabla: string, origen: () => { data: Fila[] | null; error: unknown }) => {
    const c: Consulta = { tabla, filtros: [] };
    consultas.push(c);
    let unico = false;
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "lt", "order", "limit", "range"]) {
      b[m] = (...args: unknown[]) => {
        c.filtros.push([m, ...args]);
        return b;
      };
    }
    b.maybeSingle = () => {
      unico = true;
      return b;
    };
    b.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          const base = origen();
          if (base.error) return { data: null, error: base.error };
          let filas = [...(base.data ?? [])];
          for (const [m, col, val] of c.filtros as [string, string, unknown][]) {
            const valor = (f: Fila) => (col.includes(".") ? (f[col.split(".")[0]] as Fila | undefined)?.[col.split(".")[1]] : f[col]);
            if (m === "eq") filas = filas.filter((f) => valor(f) === val);
            if (m === "in") filas = filas.filter((f) => (val as unknown[]).includes(valor(f)));
            if (m === "lt") filas = filas.filter((f) => String(valor(f)) < String(val));
          }
          const orden = (c.filtros.filter((f) => f[0] === "order") as [string, string, { ascending?: boolean }?][]).reverse();
          for (const [, col, o] of orden) {
            const sube = o?.ascending !== false;
            filas.sort((a, z) => (String(a[col]) < String(z[col]) ? (sube ? -1 : 1) : String(a[col]) > String(z[col]) ? (sube ? 1 : -1) : 0));
          }
          const rango = c.filtros.find((f) => f[0] === "range") as [string, number, number] | undefined;
          if (rango) filas = filas.slice(rango[1], rango[2] + 1);
          const limite = c.filtros.find((f) => f[0] === "limit") as [string, number] | undefined;
          if (limite) filas = filas.slice(0, limite[1]);
          return { data: unico ? (filas[0] ?? null) : filas, error: null };
        })
        .then(ok, mal);
    return b;
  };
  const db = {
    from: (tabla: string) => armar(tabla, () => ({ data: tablas[tabla] ?? [], error: null })),
    rpc: (nombre: string, args: Record<string, unknown>) =>
      armar(`rpc:${nombre}`, () => {
        const r = opciones.rpc ? opciones.rpc(args) : { error: { code: "PGRST202", message: `Could not find the function public.${nombre}` } };
        return { data: r.data ?? null, error: r.error ?? null };
      }),
  };
  return { db: db as unknown as SupabaseClient, consultas };
}

const pedido = (p: Partial<PedidoClientes> = {}): PedidoClientes => ({
  ranchoId: RANCHO,
  programaId: PROGRAMA,
  buscar: null,
  limite: 50,
  antes: null,
  orden: "saldo",
  desde: 0,
  resumen: false,
  ...p,
});

// ════════════════════════════════════════════════════════════════════

describe("lo que manda Foorkie", () => {
  it("clientes: `orden`, `desde` y `resumen`", () => {
    expect(leerPedidoClientes({ ...vinculo, orden: "saldo", desde: 50, resumen: true })).toMatchObject({
      ok: true,
      valor: { orden: "saldo", desde: 50, resumen: true, antes: null },
    });
    for (const orden of ["nuevos", "saldo", "canjes", "visitas", "actividad", "antiguos", "nombre"]) {
      expect(leerPedidoClientes({ ...vinculo, orden })).toMatchObject({ ok: true, valor: { orden, desde: 0 } });
    }
    expect(leerPedidoClientes({ ...vinculo, orden: "dinero" })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, orden: 3 })).toMatchObject({ ok: false });
    // `desde` es solo con orden, entero y dentro del tope; `antes` no va con orden.
    expect(leerPedidoClientes({ ...vinculo, desde: 50 })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, orden: "saldo", desde: -1 })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, orden: "saldo", desde: 2.5 })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, orden: "saldo", desde: "50" })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, orden: "saldo", desde: 20_001 })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, orden: "saldo", antes: "2026-10-01T15:00:00Z" })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, resumen: "si" })).toMatchObject({ ok: false });
    // El pedido de siempre sigue igual (y puede pedir el resumen).
    expect(leerPedidoClientes({ ...vinculo, antes: "2026-10-01T15:00:00Z", resumen: true })).toMatchObject({
      ok: true,
      valor: { orden: null, antes: "2026-10-01T15:00:00Z", resumen: true },
    });
  });

  it("clientes/detalle: la tarjeta, el cliente (uuid) y la página", () => {
    expect(leerPedidoDetalleCliente({ ...vinculo, miembro_id: MIEMBRO.toUpperCase() })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO, limite: 50, antes: null },
    });
    expect(leerPedidoDetalleCliente({ ...vinculo, miembro_id: MIEMBRO, limite: 500, antes: "2026-10-01T15:00:00.000003+00:00" })).toMatchObject({
      ok: true,
      valor: { limite: 100, antes: "2026-10-01T15:00:00.000003+00:00" },
    });
    expect(leerPedidoDetalleCliente({ ...vinculo })).toMatchObject({ ok: false });
    expect(leerPedidoDetalleCliente({ ...vinculo, miembro_id: "ana" })).toMatchObject({ ok: false });
    expect(leerPedidoDetalleCliente({ ...vinculo, miembro_id: MIEMBRO, antes: "ayer" })).toMatchObject({ ok: false });
  });
});

describe("las cuentas de cada cliente, sobre el ledger", () => {
  const f = (id: string, tipo: string, puntos: number, created_at: string, extra: { miembro?: string; reversion_de?: string | null } = {}) => ({
    id,
    miembro_id: extra.miembro ?? "m-ana",
    tipo,
    puntos,
    reversion_de: extra.reversion_de ?? null,
    created_at,
  });

  it("acumulado y visitas: lo ganado que sigue en pie; un ajuste o un vencimiento no lo tocan", () => {
    const a = agregadosPorMiembro([
      f("g1", "ganado", 1, "2026-09-01T10:00:00+00:00"),
      f("g2", "ganado", 1, "2026-09-02T10:00:00+00:00"),
      f("g3", "ganado", 5, "2026-09-03T10:00:00+00:00"),
      // La compra de 5 se revirtió: no la ganó.
      f("r3", "ajuste", -5, "2026-09-03T11:00:00+00:00", { reversion_de: "g3" }),
      // Un regalo a mano suma al saldo, no a lo ganado; el vencimiento resta del saldo, no de lo ganado.
      f("a1", "ajuste", 2, "2026-09-04T10:00:00+00:00"),
      f("v1", "ajuste", -2, "2026-09-05T10:00:00+00:00"),
    ]).get("m-ana");
    expect(a).toEqual({ saldo: 2, acumulado: 2, visitas: 2, canjes: 0, ultimoCanje: null, ultima: "2026-09-03T10:00:00+00:00" });
  });

  it("canjes: los que siguen en pie; el último canje no cuenta uno revertido", () => {
    const a = agregadosPorMiembro([
      f("g1", "ganado", 10, "2026-09-01T10:00:00+00:00"),
      f("g2", "ganado", 10, "2026-09-02T10:00:00+00:00"),
      f("c1", "canjeado", -10, "2026-09-03T10:00:00+00:00"),
      f("c2", "canjeado", -10, "2026-09-20T10:00:00.000001+00:00"),
      // Revertir el canje devuelve los sellos y lo anula (0139).
      f("r2", "ajuste", 10, "2026-09-21T10:00:00+00:00", { reversion_de: "c2" }),
      f("g3", "ganado", 1, "2026-09-10T10:00:00+00:00", { miembro: "m-beto" }),
    ]);
    expect(a.get("m-ana")).toEqual({
      saldo: 10,
      acumulado: 20,
      visitas: 2,
      canjes: 1,
      ultimoCanje: "2026-09-03T10:00:00+00:00",
      // Vino igual el 20: la actividad cuenta el canje aunque después se revirtiera.
      ultima: "2026-09-20T10:00:00.000001+00:00",
    });
    expect(a.get("m-beto")).toMatchObject({ saldo: 1, visitas: 1, canjes: 0 });
  });

  it("las fechas se comparan con microsegundos y con cualquier zona", () => {
    const a = agregadosPorMiembro([
      f("g1", "ganado", 1, "2026-09-01T10:00:00.000002+00:00"),
      f("g2", "ganado", 1, "2026-09-01T10:00:00.000001+00:00"),
      f("g3", "ganado", 1, "2026-09-01T04:00:00-06:00"),
    ]).get("m-ana");
    expect(a?.ultima).toBe("2026-09-01T10:00:00.000002+00:00");
  });
});

describe("los órdenes de la lista", () => {
  const ana = miembro("m-ana", "2026-08-01T10:00:00+00:00");
  const beto = miembro("m-beto", "2026-09-01T10:00:00+00:00");
  const jose = miembro("m-jose", "2026-07-01T10:00:00+00:00");
  const zoe = miembro("m-zoe", "2026-09-15T10:00:00+00:00");
  const todos = [ana, beto, jose, zoe];
  const cuentas = new Map<string, AgregadoDelMiembro>([
    ["m-ana", cuenta({ saldo: 7, visitas: 17, canjes: 1, ultimoCanje: "2026-09-01T10:00:00+00:00", ultima: "2026-09-20T10:00:00+00:00" })],
    ["m-beto", cuenta({ saldo: 7, visitas: 7, canjes: 0, ultima: "2026-09-28T10:00:00+00:00" })],
    ["m-jose", cuenta({ saldo: 2, visitas: 22, canjes: 2, ultimoCanje: "2026-08-15T10:00:00+00:00", ultima: "2026-08-15T10:00:00+00:00" })],
  ]);
  const ids = (orden: Parameters<typeof ordenarMiembros>[2], identidades?: Map<string, { nombre: string | null }>) =>
    ordenarMiembros(todos, cuentas, orden, identidades).map((m) => m.id);

  it("más saldo: empate → el que vino más recientemente", () => {
    expect(ids("saldo")).toEqual(["m-beto", "m-ana", "m-jose", "m-zoe"]);
  });

  it("más canjes, más visitas", () => {
    expect(ids("canjes")).toEqual(["m-jose", "m-ana", "m-beto", "m-zoe"]);
    expect(ids("visitas")).toEqual(["m-jose", "m-ana", "m-beto", "m-zoe"]);
  });

  it("actividad: lo más reciente primero; quien nunca la usó, al final", () => {
    expect(ids("actividad")).toEqual(["m-beto", "m-ana", "m-jose", "m-zoe"]);
  });

  it("nuevos y antiguos, por la fecha de alta", () => {
    expect(ids("nuevos")).toEqual(["m-zoe", "m-beto", "m-ana", "m-jose"]);
    expect(ids("antiguos")).toEqual(["m-jose", "m-ana", "m-beto", "m-zoe"]);
  });

  it("por nombre, sin tildes; los que no dieron su nombre, al final", () => {
    const identidades = new Map(Object.entries(IDENTIDADES).map(([id, i]) => [id, { nombre: i.nombre }]));
    expect(ids("nombre", identidades)).toEqual(["m-ana", "m-jose", "m-zoe", "m-beto"]);
  });

  it("un empate total se desempata con el alta más nueva (siempre las mismas páginas)", () => {
    const iguales = [miembro("m-1", "2026-09-01T10:00:00+00:00"), miembro("m-2", "2026-09-02T10:00:00+00:00")];
    expect(ordenarMiembros(iguales, new Map(), "saldo").map((m) => m.id)).toEqual(["m-2", "m-1"]);
    expect(ordenarMiembros([...iguales].reverse(), new Map(), "canjes").map((m) => m.id)).toEqual(["m-2", "m-1"]);
  });
});

describe("el resumen de la tarjeta", () => {
  it("clientes, activos en 30 días, los que canjearon, los canjes y lo entregado", () => {
    const ahora = new Date("2026-10-02T12:00:00Z");
    const r = resumenDeClientes(
      [miembro("m-ana", "2026-08-01T10:00:00Z"), miembro("m-beto", "2026-08-01T10:00:00Z"), miembro("m-jose", "2026-08-01T10:00:00Z"), miembro("m-zoe", "2026-08-01T10:00:00Z")],
      new Map([
        ["m-ana", cuenta({ acumulado: 17, canjes: 1, ultima: "2026-09-02T12:00:00Z" })],
        // Justo 30 días: cuenta.
        ["m-beto", cuenta({ acumulado: 7, ultima: "2026-09-02T12:00:00+00:00" })],
        ["m-jose", cuenta({ acumulado: 22, canjes: 2, ultima: "2026-09-02T11:59:59Z" })],
        // Uno que ya no está en la tarjeta no se cuenta.
        ["m-viejo", cuenta({ acumulado: 100, canjes: 9, ultima: "2026-10-01T10:00:00Z" })],
      ]),
      ahora,
    );
    expect(r).toEqual({ clientes: 4, activos_30: 2, canjearon: 2, canjes: 3, acumulado: 46 });
  });
});

describe("cuentasDeLaTarjeta: la 0252 o, sin ella, el ledger por páginas", () => {
  it("con la función: una consulta, por páginas, ordenada", async () => {
    const { db, consultas } = baseEnMemoria(
      {},
      {
        rpc: (args) => {
          expect(args).toEqual({ p_programa_id: PROGRAMA });
          return {
            data: [
              { miembro_id: "m-ana", saldo: 7, acumulado: 17, visitas: 12, canjes: 1, ultimo_canje: "2026-09-02T10:00:00+00:00", ultima_actividad: "2026-09-20T10:00:00+00:00" },
              { miembro_id: "m-beto", saldo: "3", acumulado: 3, visitas: 3, canjes: 0, ultimo_canje: null, ultima_actividad: null },
            ],
          };
        },
      },
    );
    const c = await cuentasDeLaTarjeta(db, PROGRAMA);
    expect(c?.get("m-ana")).toEqual({ saldo: 7, acumulado: 17, visitas: 12, canjes: 1, ultimoCanje: "2026-09-02T10:00:00+00:00", ultima: "2026-09-20T10:00:00+00:00" });
    expect(c?.get("m-beto")).toMatchObject({ saldo: 3, ultima: null });
    expect(consultas.map((x) => x.tabla)).toEqual(["rpc:lealtad_resumen_por_miembro"]);
    expect(consultas[0].filtros).toContainEqual(["range", 0, 999]);
    expect(consultas[0].filtros).toContainEqual(["order", "miembro_id", { ascending: true }]);
  });

  it("sin la función (todavía no se corrió): la misma cuenta, leyendo el ledger de ESTA tarjeta", async () => {
    const { db, consultas } = baseEnMemoria({
      transacciones_puntos: [
        { id: "t1", miembro_id: "m-ana", puntos: 5, tipo: "ganado", reversion_de: null, created_at: "2026-09-01T10:00:00+00:00", miembros: { programa_id: PROGRAMA } },
        { id: "t2", miembro_id: "m-ana", puntos: -5, tipo: "canjeado", reversion_de: null, created_at: "2026-09-02T10:00:00+00:00", miembros: { programa_id: PROGRAMA } },
        { id: "t3", miembro_id: "m-otra", puntos: 9, tipo: "ganado", reversion_de: null, created_at: "2026-09-02T10:00:00+00:00", miembros: { programa_id: "otra" } },
      ],
    });
    const c = await cuentasDeLaTarjeta(db, PROGRAMA);
    expect(c?.get("m-ana")).toEqual({ saldo: 0, acumulado: 5, visitas: 1, canjes: 1, ultimoCanje: "2026-09-02T10:00:00+00:00", ultima: "2026-09-02T10:00:00+00:00" });
    expect(c?.has("m-otra")).toBe(false);
    const ledger = consultas.find((x) => x.tabla === "transacciones_puntos");
    expect(ledger?.filtros).toContainEqual(["eq", "miembros.programa_id", PROGRAMA]);
  });

  it("otro error de la base: null (nunca números inventados)", async () => {
    const { db } = baseEnMemoria({}, { rpc: () => ({ error: { code: "57014", message: "canceling statement due to statement timeout" } }) });
    expect(await cuentasDeLaTarjeta(db, PROGRAMA)).toBeNull();
  });
});

describe("clientesDeLaTarjeta con `orden`", () => {
  const tablas = () => ({
    miembros: [
      { ...miembro("m-ana", "2026-08-01T10:00:00+00:00"), programa_id: PROGRAMA },
      { ...miembro("m-beto", "2026-09-01T10:00:00+00:00", "pausada"), programa_id: PROGRAMA },
      { ...miembro("m-jose", "2026-07-01T10:00:00+00:00"), programa_id: PROGRAMA },
      { ...miembro("m-zoe", "2026-09-15T10:00:00+00:00"), programa_id: PROGRAMA },
      { id: "m-baja", cliente_id: null, persona_id: null, estado: "cancelada", created_at: "2026-09-20T10:00:00+00:00", programa_id: PROGRAMA },
    ],
  });
  const rpc = () => ({
    data: [
      { miembro_id: "m-ana", saldo: 7, acumulado: 17, visitas: 17, canjes: 1, ultimo_canje: "2026-09-01T10:00:00+00:00", ultima_actividad: "2026-09-20T10:00:00+00:00" },
      { miembro_id: "m-beto", saldo: 9, acumulado: 9, visitas: 9, canjes: 0, ultimo_canje: null, ultima_actividad: "2026-09-28T10:00:00+00:00" },
      { miembro_id: "m-jose", saldo: 2, acumulado: 42, visitas: 22, canjes: 4, ultimo_canje: "2026-08-15T10:00:00+00:00", ultima_actividad: "2026-08-15T10:00:00+00:00" },
    ],
  });

  beforeEach(() => {
    vi.mocked(identidadesDeMiembros).mockClear();
  });

  it("la página del orden pedido, con su posición, el cursor `siguiente_desde` y el resumen", async () => {
    const { db } = baseEnMemoria(tablas(), { rpc });
    const r = await clientesDeLaTarjeta(db, pedido({ orden: "saldo", limite: 2, resumen: true }), new Date("2026-10-02T12:00:00Z"));
    expect(r?.clientes.map((c) => [c.miembro_id, c.posicion, c.saldo])).toEqual([
      ["m-beto", 1, 9],
      ["m-ana", 2, 7],
    ]);
    expect(r).toMatchObject({ total: 4, siguiente: null, siguienteDesde: 2 });
    expect(r?.resumen).toEqual({ clientes: 4, activos_30: 2, canjearon: 2, canjes: 5, acumulado: 68 });
    expect(r?.clientes[1]).toMatchObject({ nombre: "Ana", correo: "a***@gmail.com", telefono: "****-7777", acumulado: 17, visitas: 17, canjes: 1 });
    // Sin buscar ni ordenar por nombre: solo se resuelve quién es la gente de la página.
    expect(vi.mocked(identidadesDeMiembros).mock.calls.flatMap((c) => c[1].map((m) => m.id))).toEqual(["m-beto", "m-ana"]);

    const sigue = await clientesDeLaTarjeta(db, pedido({ orden: "saldo", limite: 2, desde: 2 }));
    expect(sigue?.clientes.map((c) => [c.miembro_id, c.posicion])).toEqual([
      ["m-jose", 3],
      ["m-zoe", 4],
    ]);
    expect(sigue).toMatchObject({ siguienteDesde: null, resumen: null });
    // La que se dio de baja no es cliente: no sale ni se cuenta.
    expect(JSON.stringify([r, sigue])).not.toContain("m-baja");
  });

  it("buscando, cada uno conserva su lugar en la lista ENTERA", async () => {
    const { db } = baseEnMemoria(tablas(), { rpc });
    const r = await clientesDeLaTarjeta(db, pedido({ orden: "canjes", buscar: { por: "nombre", texto: "ana" }, resumen: true }));
    expect(r?.clientes.map((c) => [c.miembro_id, c.posicion])).toEqual([["m-ana", 2]]);
    expect(r?.total).toBe(1);
    // El resumen es de toda la tarjeta, aunque se busque.
    expect(r?.resumen?.clientes).toBe(4);
  });

  it("por nombre: se resuelve quién es cada uno de toda la tarjeta", async () => {
    const { db } = baseEnMemoria(tablas(), { rpc });
    const r = await clientesDeLaTarjeta(db, pedido({ orden: "nombre" }));
    expect(r?.clientes.map((c) => c.nombre)).toEqual(["Ana", "José", "Zoe", "Cliente"]);
  });

  it("sin la 0252 da exactamente lo mismo, leyendo el ledger", async () => {
    const ledger = [
      { id: "a1", miembro_id: "m-beto", puntos: 9, tipo: "ganado", reversion_de: null, created_at: "2026-09-28T10:00:00+00:00", miembros: { programa_id: PROGRAMA } },
      { id: "a2", miembro_id: "m-ana", puntos: 7, tipo: "ganado", reversion_de: null, created_at: "2026-09-20T10:00:00+00:00", miembros: { programa_id: PROGRAMA } },
    ];
    const { db } = baseEnMemoria({ ...tablas(), transacciones_puntos: ledger });
    const r = await clientesDeLaTarjeta(db, pedido({ orden: "saldo", limite: 2 }));
    expect(r?.clientes.map((c) => [c.miembro_id, c.saldo, c.posicion])).toEqual([
      ["m-beto", 9, 1],
      ["m-ana", 7, 2],
    ]);
  });

  it("si la base no contesta, null", async () => {
    const { db } = baseEnMemoria(tablas(), { rpc: () => ({ error: { code: "XX000", message: "caída" } }) });
    expect(await clientesDeLaTarjeta(db, pedido())).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════

describe("un cliente y sus movimientos", () => {
  const fila = (id: string, tipo: string, puntos: number, created_at: string, extra: Partial<FilaLedger> = {}): FilaLedger => ({
    id,
    miembro_id: MIEMBRO,
    tipo,
    puntos,
    motivo: null,
    referencia: null,
    reversion_de: null,
    usuario_id: null,
    llave_id: null,
    created_at,
    ...extra,
  });

  const filas: FilaLedger[] = [
    // Un pedido en línea entregado en Foorkie.
    fila("t1", "ganado", 1, "2026-09-01T10:00:00+00:00", { referencia: "foorkie:pedido-1", motivo: "Pedido en línea" }),
    // La caja de Foorkie, con quién operó en el concepto.
    fila("t2", "ganado", 1, "2026-09-02T10:00:00+00:00", { referencia: `mostrador:${MIEMBRO}:aaaa`, usuario_id: DUENO }),
    // El panel de Bookea, por alguien del equipo, con su venta por cercanía (sin referencia en común).
    fila("t3", "ganado", 2, "2026-09-03T10:00:00+00:00", { referencia: "panel:x", usuario_id: "u-maria", motivo: "Compra" }),
    // Un canje en la caja: lo opera el usuario del dueño (puede ser cualquiera del equipo en Foorkie).
    fila("t4", "canjeado", -3, "2026-09-04T10:00:00+00:00", {
      referencia: `canje:${MIEMBRO}:rc-1:11111111-2222-4333-8444-555555555555`,
      usuario_id: DUENO,
      motivo: "Canje: Café gratis",
    }),
    // Una compra por error, revertida.
    fila("t5", "ganado", 5, "2026-09-05T10:00:00+00:00", { referencia: "panel:y", usuario_id: "u-maria" }),
    fila("t6", "ajuste", -5, "2026-09-05T11:00:00+00:00", { reversion_de: "t5", usuario_id: "u-maria", motivo: "Me equivoqué de cliente" }),
    // El vencimiento de los sellos (0180).
    fila("t7", "ajuste", -1, "2026-09-30T03:00:00+00:00", { referencia: "venc:2026-09-30", motivo: "Tus sellos vencieron" }),
  ];
  const ventas = [
    { id: "v2", referencia: `mostrador:${MIEMBRO}:aaaa`, producto: "Caja Foorkie · Ana María", monto: 4500, registrado_por: DUENO, created_at: "2026-09-02T10:00:00+00:00" },
    { id: "v3", referencia: null, producto: "Matcha latte", monto: 3200, registrado_por: "u-maria", created_at: "2026-09-03T10:00:03+00:00" },
  ];
  const canjes = [{ id: "c4", transaccion_id: "t4", premio: "Un café gratis", entregado_por: DUENO, created_at: "2026-09-04T10:00:00+00:00" }];
  const equipo = new Map([
    ["u-maria", "María"],
    [DUENO, "Luis"],
  ]);

  it("cada movimiento dice qué fue, cuánto, cómo quedó el saldo y por dónde entró", () => {
    const m = movimientosDelCliente({ filas, ventas, canjes, equipo, duenoId: DUENO });
    expect(m.map((x) => [x.id, x.tipo, x.puntos, x.saldo, x.canal])).toEqual([
      ["t7", "vencimiento", -1, 0, "otro"],
      ["t6", "reverso", -5, 1, "panel"],
      ["t5", "acredito", 5, 6, "panel"],
      ["t4", "canjeo", -3, 1, "caja"],
      ["t3", "acredito", 2, 4, "panel"],
      ["t2", "acredito", 1, 2, "caja"],
      ["t1", "acredito", 1, 1, "pedido"],
    ]);
    const por = new Map(m.map((x) => [x.id, x]));
    expect(por.get("t5")?.revertido).toBe(true);
    expect(m.filter((x) => x.revertido).map((x) => x.id)).toEqual(["t5"]);
    // La venta por referencia (y su monto), y la del panel por cercanía.
    expect(por.get("t2")).toMatchObject({ monto: 4500, detalle: null, operador: "Ana" });
    expect(por.get("t3")).toMatchObject({ monto: 3200, detalle: "Matcha latte", operador: "María" });
    // El premio sale del canje; el motivo del ajuste, tal cual.
    expect(por.get("t4")).toMatchObject({ premio: "Un café gratis", detalle: null });
    expect(por.get("t6")).toMatchObject({ detalle: "Me equivoqué de cliente", operador: "María" });
    expect(por.get("t1")).toMatchObject({ detalle: "Pedido en línea", operador: null, monto: null });
  });

  it("quién atendió: nunca se nombra mal al dueño por una operación de la caja de Foorkie", () => {
    const m = movimientosDelCliente({ filas, ventas, canjes, equipo, duenoId: DUENO });
    // El canje de la caja corre con el usuario del dueño: pudo ser cualquiera de su equipo en Foorkie.
    expect(m.find((x) => x.id === "t4")?.operador).toBeNull();
    // Fuera de la caja (el panel de Bookea), el dueño sí es el dueño.
    const enElPanel = movimientosDelCliente({
      filas: [fila("p1", "canjeado", -3, "2026-09-04T10:00:00+00:00", { referencia: `canje:${MIEMBRO}:rc-1`, usuario_id: DUENO, motivo: "Canje: Café gratis" })],
      ventas: [],
      canjes: [],
      equipo,
      duenoId: DUENO,
    });
    expect(enElPanel[0]).toMatchObject({ canal: "panel", operador: "Luis", premio: "Café gratis" });
  });

  it("de quien atendió sale el nombre de pila, o el correo enmascarado", () => {
    expect(operadorDeLaCaja("Caja Foorkie · Ana María Solís")).toEqual({ operador: "Ana" });
    expect(operadorDeLaCaja("Caja Foorkie · luis@gmail.com")).toEqual({ operador: "l***@gmail.com" });
    expect(operadorDeLaCaja("Caja Foorkie")).toEqual({ operador: null });
    expect(operadorDeLaCaja("Matcha latte")).toBeNull();
    expect(operadorDeLaCaja(null)).toBeNull();
    expect(nombreDeQuienOpera("  ")).toBeNull();
    expect(nombreDeQuienOpera("88887777")).toBeNull();
  });

  it("lo que viaja a Foorkie no lleva la fecha cruda de la base", () => {
    const [m] = movimientosDelCliente({ filas: [filas[0]], ventas: [], canjes: [], equipo, duenoId: DUENO });
    expect(movimientoParaFoorkie(m)).toEqual({
      id: "t1",
      fecha: "2026-09-01T10:00:00.000Z",
      tipo: "acredito",
      puntos: 1,
      saldo: 1,
      canal: "pedido",
      detalle: "Pedido en línea",
      premio: null,
      monto: null,
      operador: null,
      revertido: false,
    });
  });

  describe("detalleDelCliente (contra la base)", () => {
    const tablas = (): Record<string, Fila[]> => ({
      miembros: [
        { id: MIEMBRO, programa_id: PROGRAMA, cliente_id: null, persona_id: "p-1", estado: "activa", created_at: "2026-08-01T10:00:00+00:00" },
        { id: "m-otra-tarjeta", programa_id: "otra", cliente_id: null, persona_id: null, estado: "activa", created_at: "2026-08-01T10:00:00+00:00" },
        { id: "m-baja", programa_id: PROGRAMA, cliente_id: null, persona_id: null, estado: "cancelada", created_at: "2026-08-01T10:00:00+00:00" },
      ],
      transacciones_puntos: filas.map((f) => ({ ...f })),
      lealtad_transacciones: ventas.map((v) => ({ ...v, rancho_id: RANCHO, miembro_id: MIEMBRO })),
      canjes: canjes.map((c) => ({ id: c.id, transaccion_id: c.transaccion_id, entregado_por: c.entregado_por, created_at: c.created_at, miembro_id: MIEMBRO, recompensas: { nombre: c.premio } })),
      perfiles: [
        { id: "u-maria", nombre: "María Jiménez" },
        { id: DUENO, nombre: "Luis Herrera" },
      ],
    });

    beforeEach(() => {
      IDENTIDADES[MIEMBRO] = { nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: "88887777" };
    });

    it("el cliente con sus números y la primera página; `siguiente` sigue con los más viejos", async () => {
      const { db } = baseEnMemoria(tablas());
      const r = await detalleDelCliente(db, { ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO, limite: 3, antes: null }, DUENO);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.detalle.cliente).toMatchObject({
        miembro_id: MIEMBRO,
        nombre: "Ana",
        correo: "a***@gmail.com",
        telefono: "****-7777",
        saldo: 0,
        acumulado: 4,
        visitas: 3,
        canjes: 1,
        ultimo_canje: "2026-09-04T10:00:00.000Z",
        desde: "2026-08-01T10:00:00.000Z",
      });
      expect(r.detalle.movimientos.map((m) => m.id)).toEqual(["t7", "t6", "t5"]);
      expect(r.detalle.siguiente).toBe("2026-09-05T10:00:00+00:00");

      const sigue = await detalleDelCliente(db, { ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO, limite: 3, antes: r.detalle.siguiente }, DUENO);
      expect(sigue.ok && sigue.detalle.movimientos.map((m) => m.id)).toEqual(["t4", "t3", "t2"]);
      expect(JSON.stringify([r, sigue])).not.toMatch(/ana\.solis@|88887777|Solís|Jiménez|Herrera/);
    });

    it("de otra tarjeta, dado de baja o inexistente: «no encontrado», igual para los tres", async () => {
      const { db } = baseEnMemoria(tablas());
      const pedir = (miembroId: string) => detalleDelCliente(db, { ranchoId: RANCHO, programaId: PROGRAMA, miembroId, limite: 50, antes: null }, DUENO);
      const esperado = { ok: false, codigo: "no_encontrado", motivo: "Ese cliente no tiene esta tarjeta.", status: 404 };
      expect(await pedir("m-otra-tarjeta")).toEqual(esperado);
      expect(await pedir("m-baja")).toEqual(esperado);
      expect(await pedir("m-nadie")).toEqual(esperado);
    });

    it("sin ventas ni canjes legibles (tablas viejas), igual sale: el premio del motivo del ledger", async () => {
      const t = tablas();
      delete t.lealtad_transacciones;
      t.canjes = [];
      const { db } = baseEnMemoria(t);
      const r = await detalleDelCliente(db, { ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO, limite: 50, antes: null }, DUENO);
      expect(r.ok && r.detalle.movimientos.find((m) => m.id === "t4")?.premio).toBe("Café gratis");
    });
  });
});
