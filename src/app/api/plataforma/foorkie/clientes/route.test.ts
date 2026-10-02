import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/clientes (con `orden` y `resumen`) y
 * POST /api/plataforma/foorkie/clientes/detalle, de punta a punta: la
 * firma de verdad, la puerta de verdad (`abrirElPanel` = `abrirLaCaja`),
 * el vínculo con Foorkie, contra una base de mentira que aplica los
 * filtros de cada consulta. Sin la 0252 (la función no existe): las
 * cuentas salen del ledger leído por páginas.
 *
 * Pedido del dueño (2 oct 2026): «ver quién es el que más sellos lleva,
 * quién ha canjeado y cuántas veces». Lo que se fija: los números y el
 * orden, que nada sale con un contacto completo y que vale también para
 * una tarjeta que el negocio maneja en Bookea (solo lee).
 */

vi.mock("@/lib/lealtad/identidades-db", () => ({
  miembrosConIdentidad: async () => [],
  identidadesDeMiembros: async (_db: unknown, miembros: { id: string }[]) =>
    new Map(
      miembros.map((m) => [
        m.id,
        m.id === ANA
          ? { nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: "88887777" }
          : m.id === BETO
            ? { nombre: "Beto", correo: "beto@correo.cr", telefono: null }
            : { nombre: null, correo: null, telefono: null },
      ]),
    ),
}));
vi.mock("@/lib/lealtad/plan-del-negocio", () => ({ planDelNegocio: vi.fn(async () => "arranque") }));
vi.mock("@/lib/wallet/mensaje-promocional", () => ({ enviarMensajePromocional: vi.fn() }));
vi.mock("@/lib/wallet/aviso-de-pausa", () => ({ plataformasConfiguradas: vi.fn(() => ["apple", "google"]) }));
vi.mock("@/lib/wallet/aviso-de-diseno", () => ({ avisarCambioDeDiseno: vi.fn() }));
vi.mock("@/lib/wallet/google", () => ({ refrescarClaseGoogle: vi.fn() }));

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let escrituras = 0;

/** Una consulta encadenable que aplica los filtros, el orden y el rango a las filas de su tabla. */
function consulta(origen: () => { data: Fila[]; error: unknown }) {
  const filtros: unknown[][] = [];
  let unico = false;
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "lt", "order", "limit", "range"]) {
    b[m] = (...args: unknown[]) => {
      filtros.push([m, ...args]);
      return b;
    };
  }
  for (const m of ["insert", "update", "upsert", "delete"]) {
    b[m] = () => {
      escrituras += 1;
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
        let filas = base.data.map((f) => ({ ...f }));
        for (const [m, col, val] of filtros as [string, string, unknown][]) {
          const valor = (f: Fila) => (col.includes(".") ? (f[col.split(".")[0]] as Fila | undefined)?.[col.split(".")[1]] : f[col]);
          if (m === "eq") filas = filas.filter((f) => valor(f) === val);
          if (m === "in") filas = filas.filter((f) => (val as unknown[]).includes(valor(f)));
          if (m === "lt") filas = filas.filter((f) => String(valor(f)) < String(val));
        }
        for (const [, col, o] of (filtros.filter((f) => f[0] === "order") as [string, string, { ascending?: boolean }?][]).reverse()) {
          const sube = o?.ascending !== false;
          filas.sort((a, z) => (String(a[col]) < String(z[col]) ? (sube ? -1 : 1) : String(a[col]) > String(z[col]) ? (sube ? 1 : -1) : 0));
        }
        const rango = filtros.find((f) => f[0] === "range") as [string, number, number] | undefined;
        if (rango) filas = filas.slice(rango[1], rango[2] + 1);
        const limite = filtros.find((f) => f[0] === "limit") as [string, number] | undefined;
        if (limite) filas = filas.slice(0, limite[1]);
        return { data: unico ? (filas[0] ?? null) : filas, error: null };
      })
      .then(ok, mal);
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => consulta(() => ({ data: tablas[t] ?? [], error: null })),
    // La 0252 todavía no está corrida: PostgREST no encuentra la función.
    rpc: (nombre: string) =>
      consulta(() => ({ data: [], error: { code: "PGRST202", message: `Could not find the function public.${nombre}(p_programa_id) in the schema cache` } })),
  }),
}));

import { POST as clientes } from "./route";
import { POST as detalle } from "./detalle/route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const ANA = "33333333-3333-4333-8333-333333333333";
const BETO = "44444444-4444-4444-8444-444444444444";
const NUEVO = "55555555-5555-4555-8555-555555555555";
const DUENO = "66666666-6666-4666-8666-666666666666";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

function firmado(ruta: string, cuerpo: Record<string, unknown>, secreto = SECRETO): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", secreto).update(`${t}.${texto}`).digest("hex");
  return new Request(`https://www.bookea.lat/api/plataforma/foorkie/${ruta}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

async function pedir(ruta: "clientes" | "clientes/detalle", cuerpo: Record<string, unknown>, secreto?: string) {
  const r = await (ruta === "clientes" ? clientes : detalle)(firmado(ruta, cuerpo, secreto));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

const tx = (id: string, miembro: string, tipo: string, puntos: number, created_at: string, extra: Fila = {}) => ({
  id,
  miembro_id: miembro,
  tipo,
  puntos,
  motivo: null,
  referencia: null,
  reversion_de: null,
  usuario_id: null,
  llave_id: null,
  created_at,
  miembros: { programa_id: PROGRAMA },
  ...extra,
});

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  escrituras = 0;
  tablas = {
    // Una tarjeta que el negocio maneja en Bookea (sin la marca de Foorkie): los lectores igual contestan.
    foorkie_restaurantes: [{ id: "local-1", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: false }],
    ranchos: [{ id: RANCHO, owner_id: DUENO, nombre: "Café de prueba" }],
    programa_lealtad: [{ id: PROGRAMA, rancho_id: RANCHO, nombre: "Tarjeta", modo: "sellos", estado: "activo", activo: true }],
    miembros: [
      { id: ANA, programa_id: PROGRAMA, persona_id: "p-ana", cliente_id: null, estado: "activa", created_at: "2026-08-01T10:00:00+00:00" },
      { id: BETO, programa_id: PROGRAMA, persona_id: "p-beto", cliente_id: null, estado: "activa", created_at: "2026-08-15T10:00:00+00:00" },
      { id: NUEVO, programa_id: PROGRAMA, persona_id: null, cliente_id: null, estado: "activa", created_at: "2026-09-30T10:00:00+00:00" },
    ],
    transacciones_puntos: [
      tx("t1", ANA, "ganado", 1, "2026-09-01T10:00:00+00:00", { referencia: "foorkie:pedido-1" }),
      tx("t2", ANA, "ganado", 1, "2026-09-02T10:00:00+00:00"),
      tx("t3", ANA, "canjeado", -2, "2026-09-03T10:00:00+00:00", { motivo: "Canje: Café gratis" }),
      tx("t4", ANA, "ganado", 1, "2026-09-25T10:00:00+00:00"),
      tx("t5", BETO, "ganado", 1, "2026-09-10T10:00:00+00:00"),
      tx("t6", BETO, "ganado", 1, "2026-09-11T10:00:00+00:00"),
      tx("t7", BETO, "ganado", 1, "2026-09-12T10:00:00+00:00"),
    ],
    canjes: [],
    perfiles: [],
  };
});

describe("clientes con orden", () => {
  it("el que más sellos lleva primero, con sus números, su posición y el resumen de la tarjeta", async () => {
    const r = await pedir("clientes", { ...vinculo, orden: "saldo", limite: 2, resumen: true });
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({
      ok: true,
      total: 3,
      siguiente: null,
      siguiente_desde: 2,
      resumen: { clientes: 3, canjearon: 1, canjes: 1, acumulado: 6 },
      clientes: [
        { miembro_id: BETO, nombre: "Beto", correo: "b***@correo.cr", saldo: 3, acumulado: 3, visitas: 3, canjes: 0, posicion: 1 },
        { miembro_id: ANA, nombre: "Ana", correo: "a***@gmail.com", telefono: "****-7777", saldo: 1, acumulado: 3, visitas: 3, canjes: 1, posicion: 2 },
      ],
    });
    const sigue = await pedir("clientes", { ...vinculo, orden: "saldo", limite: 2, desde: 2 });
    expect(sigue.cuerpo).toMatchObject({ ok: true, siguiente_desde: null, clientes: [{ miembro_id: NUEVO, nombre: "Cliente", saldo: 0, posicion: 3 }] });
    expect(sigue.cuerpo).not.toHaveProperty("resumen");
    expect(JSON.stringify([r.cuerpo, sigue.cuerpo])).not.toMatch(/ana\.solis@|88887777|Solís|beto@correo/);
    expect(escrituras).toBe(0);
  });

  it("quién canjeó y cuántas veces", async () => {
    const r = await pedir("clientes", { ...vinculo, orden: "canjes" });
    expect((r.cuerpo.clientes as Fila[]).map((c) => [c.miembro_id, c.canjes, c.ultimo_canje])).toEqual([
      [ANA, 1, "2026-09-03T10:00:00.000Z"],
      [BETO, 0, null],
      [NUEVO, 0, null],
    ]);
  });

  it("el pedido de siempre (sin orden) sigue igual, ahora con los números de cada uno", async () => {
    tablas.miembros = tablas.miembros.slice(0, 2);
    const r = await pedir("clientes", { ...vinculo, limite: 1 });
    // El conteo del pedido de siempre usa `count: exact` (la base de mentira no lo calcula): acá importa la página.
    expect(r.cuerpo).toMatchObject({
      ok: true,
      siguiente: "2026-08-15T10:00:00+00:00",
      siguiente_desde: null,
      clientes: [{ miembro_id: BETO, saldo: 3, acumulado: 3, visitas: 3, canjes: 0 }],
    });
    expect((r.cuerpo.clientes as Fila[])[0]).not.toHaveProperty("posicion");
  });

  it("lo que no se entiende: 400 sin tocar la base", async () => {
    expect(await pedir("clientes", { ...vinculo, orden: "dinero" })).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    expect(await pedir("clientes", { ...vinculo, orden: "saldo", antes: "2026-09-01T10:00:00Z" })).toMatchObject({ status: 400 });
    expect(await pedir("clientes", { ...vinculo, desde: 10 })).toMatchObject({ status: 400 });
  });
});

describe("clientes/detalle", () => {
  it("un cliente de la tarjeta y sus movimientos, del más nuevo al más viejo", async () => {
    const r = await pedir("clientes/detalle", { ...vinculo, miembro_id: ANA, limite: 2 });
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({
      ok: true,
      cliente: { miembro_id: ANA, nombre: "Ana", correo: "a***@gmail.com", saldo: 1, acumulado: 3, visitas: 3, canjes: 1 },
      movimientos: [
        { id: "t4", tipo: "acredito", puntos: 1, saldo: 1 },
        { id: "t3", tipo: "canjeo", puntos: -2, saldo: 0, premio: "Café gratis" },
      ],
      siguiente: "2026-09-03T10:00:00+00:00",
    });
    // La fecha cruda no viaja en cada movimiento (solo como cursor).
    expect((r.cuerpo.movimientos as Fila[])[0]).not.toHaveProperty("created_at");
    const sigue = await pedir("clientes/detalle", { ...vinculo, miembro_id: ANA, limite: 2, antes: r.cuerpo.siguiente });
    expect((sigue.cuerpo.movimientos as Fila[]).map((m) => [m.id, m.canal, m.saldo])).toEqual([
      ["t2", "otro", 2],
      ["t1", "pedido", 1],
    ]);
    expect(sigue.cuerpo.siguiente).toBeNull();
    expect(escrituras).toBe(0);
  });

  it("un cliente que no es de esta tarjeta: 404, igual que uno que no existe", async () => {
    tablas.miembros.push({ id: "77777777-7777-4777-8777-777777777777", programa_id: "otra", estado: "activa", created_at: "2026-09-01T10:00:00+00:00" });
    const ajeno = await pedir("clientes/detalle", { ...vinculo, miembro_id: "77777777-7777-4777-8777-777777777777" });
    const nadie = await pedir("clientes/detalle", { ...vinculo, miembro_id: "88888888-8888-4888-8888-888888888888" });
    expect(ajeno).toEqual({ status: 404, cuerpo: { ok: false, codigo: "no_encontrado", motivo: "Ese cliente no tiene esta tarjeta." } });
    expect(nadie).toEqual(ajeno);
  });

  it("la misma puerta de siempre: firma ajena 401, tarjeta sin vínculo con Foorkie 403, sin cliente 400", async () => {
    expect(await pedir("clientes/detalle", { ...vinculo, miembro_id: ANA }, "otra-llave")).toMatchObject({ status: 401, cuerpo: { codigo: "firma" } });
    expect(await pedir("clientes/detalle", { ...vinculo })).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    tablas.foorkie_restaurantes = [];
    expect(await pedir("clientes/detalle", { ...vinculo, miembro_id: ANA })).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
    expect(await pedir("clientes", { ...vinculo, orden: "saldo" })).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
  });
});
