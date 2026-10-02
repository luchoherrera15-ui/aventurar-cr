import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/caja/canjear CON `monto` (0253), de punta
 * a punta: la firma de verdad, la puerta de verdad (`abrirLaCaja`), la
 * marca de Foorkie, el núcleo (`canjearMontoCore`) y un RPC de mentira que
 * hace lo mismo que `canjear_monto_lealtad` (idempotencia primero, el
 * mínimo, el saldo).
 *
 * Pedido del dueño: «uno acumula cashback y cuando la persona desee
 * canjear, lo hará». Lo que se fija: que se descuenta el monto pedido y
 * se avisa al pase UNA vez, que el reintento no descuenta dos veces, y
 * que una tarjeta sin la marca de Foorkie —Pura Matcha— o sin el canje
 * libre ni llega al RPC.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let llamadasRpc: Record<string, unknown>[] = [];
const avisos: { miembro: string; evento?: string }[] = [];

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  // Sin el contexto de una petición: se ejecuta de una (lo que importa es QUE se ejecute).
  after: (fn: () => unknown) => fn(),
}));

vi.mock("@/lib/wallet/servicio", () => ({
  avisarCambioDePase: async (miembro: string, evento?: string) => {
    avisos.push({ miembro, evento });
  },
}));

/** Una consulta encadenable que aplica `eq` e `in` a las filas de su tabla. */
function consulta(tabla: string) {
  const eqs: [string, unknown][] = [];
  const ins: [string, unknown[]][] = [];
  let unico = false;
  let limite: number | null = null;
  const b = {
    select: () => b,
    order: () => b,
    eq: (col: string, val: unknown) => {
      eqs.push([col, val]);
      return b;
    },
    in: (col: string, vals: unknown[]) => {
      ins.push([col, vals]);
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
          const filas = (tablas[tabla] ?? [])
            .filter((f) => eqs.every(([c, v]) => f[c] === v))
            .filter((f) => ins.every(([c, vs]) => vs.includes(f[c])));
          const vistas = (limite === null ? filas : filas.slice(0, limite)).map((f) => ({ ...f }));
          return { data: unico ? (vistas[0] ?? null) : vistas, error: null };
        })
        .then(ok, mal),
  };
  return b;
}

/** Lo mismo que `canjear_monto_lealtad` (0253), sobre las tablas de mentira. */
function canjearMonto(a: Record<string, unknown>) {
  const miembro = tablas.miembros.find((m) => m.id === a.p_miembro_id);
  const ledger = tablas.transacciones_puntos.filter((t) => t.miembro_id === a.p_miembro_id);
  const saldo = ledger.reduce((s, t) => s + Number(t.puntos), 0);
  const previo = ledger.find((t) => t.referencia === a.p_referencia);
  if (previo) return { ok: true, ya_estaba: true, saldo, monto: Math.abs(Number(previo.puntos)) };
  if (!miembro || miembro.estado !== "activa") return { ok: false, codigo: "membresia_inactiva", motivo: "Esa membresía no está activa." };
  const programa = tablas.programa_lealtad.find((p) => p.id === miembro.programa_id) as Fila;
  const b = (programa.beneficio ?? {}) as Fila;
  if (programa.modo !== "cashback" || b.canjeLibre !== true) return { ok: false, codigo: "canje_no_libre", motivo: "No." };
  const minimo = typeof b.minimoCanje === "number" ? b.minimoCanje : null;
  const monto = Number(a.p_monto);
  if (minimo !== null && monto < minimo) return { ok: false, codigo: "debajo_del_minimo", minimo, saldo, motivo: "Mínimo." };
  if (saldo < monto) return { ok: false, codigo: "saldo_insuficiente", saldo, motivo: "Saldo insuficiente." };
  tablas.transacciones_puntos.push({
    miembro_id: a.p_miembro_id,
    tipo: "canjeado",
    puntos: -monto,
    referencia: a.p_referencia,
    motivo: a.p_motivo,
    usuario_id: a.p_usuario_id,
  });
  return { ok: true, ya_estaba: false, saldo: saldo - monto, monto };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => consulta(t),
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      llamadasRpc.push({ nombre, ...args });
      if (nombre !== "canjear_monto_lealtad") return { data: null, error: { code: "PGRST202", message: "no" } };
      return { data: canjearMonto(args), error: null };
    },
  }),
}));

import { POST } from "./route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const INTENTO = "44444444-4444-4444-8444-444444444444";
const OTRO_INTENTO = "55555555-5555-4555-8555-555555555555";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

function firmado(cuerpo: Record<string, unknown>): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", SECRETO).update(`${t}.${texto}`).digest("hex");
  return new Request("https://www.bookea.lat/api/plataforma/foorkie/caja/canjear", {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

async function canjear(cuerpo: Record<string, unknown>) {
  const r = await POST(firmado({ ...vinculo, miembro_id: MIEMBRO, ...cuerpo }));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  llamadasRpc = [];
  avisos.length = 0;
  tablas = {
    foorkie_restaurantes: [
      { id: "local-1", slug: "donde-george", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: true, activo: true, estado_publicacion: "aprobado" },
    ],
    ranchos: [{ id: RANCHO, owner_id: "dueno-1", nombre: "Donde George" }],
    programa_lealtad: [
      {
        id: PROGRAMA,
        rancho_id: RANCHO,
        nombre: "Tarjeta",
        modo: "cashback",
        estado: "activo",
        activo: true,
        beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, canjeLibre: true, minimoCanje: 500 },
      },
    ],
    miembros: [{ id: MIEMBRO, programa_id: PROGRAMA, persona_id: null, cliente_id: null, estado: "activa" }],
    transacciones_puntos: [
      { miembro_id: MIEMBRO, puntos: 1500, referencia: "foorkie:p1" },
      { miembro_id: MIEMBRO, puntos: 850, referencia: "foorkie:p2" },
    ],
  };
});

describe("caja/canjear con monto — el cashback que el cliente quiera usar", () => {
  it("descuenta el monto, con su referencia y quién operó, y avisa al pase UNA vez", async () => {
    const r = await canjear({ monto: 1000, intento_id: INTENTO, operador: "Ana" });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, tipo: "monto", monto: 1000, saldo: 1350, ya_estaba: false } });
    expect(llamadasRpc).toEqual([
      {
        nombre: "canjear_monto_lealtad",
        p_miembro_id: MIEMBRO,
        p_monto: 1000,
        p_usuario_id: "dueno-1",
        p_referencia: `canje:${MIEMBRO}:cashback:${INTENTO}`,
        p_motivo: "Canje: Cashback usado (Caja Foorkie · Ana)",
      },
    ]);
    expect(avisos).toEqual([{ miembro: MIEMBRO, evento: "canjear" }]);
  });

  it("el reintento con el MISMO intento no descuenta dos veces (ni avisa de nuevo)", async () => {
    await canjear({ monto: 1000, intento_id: INTENTO });
    const otra = await canjear({ monto: 1000, intento_id: INTENTO });
    expect(otra.cuerpo).toEqual({ ok: true, tipo: "monto", monto: 1000, saldo: 1350, ya_estaba: true });
    expect(tablas.transacciones_puntos.filter((t) => t.tipo === "canjeado")).toHaveLength(1);
    expect(avisos).toHaveLength(1);
  });

  it("no le alcanza, o está por debajo del mínimo: dice cuánto, sin tocar el saldo", async () => {
    const mucho = await canjear({ monto: 5000, intento_id: INTENTO });
    expect(mucho.cuerpo).toMatchObject({ ok: false, codigo: "saldo_insuficiente", saldo: 2350 });
    expect(String(mucho.cuerpo.motivo)).toMatch(/No le alcanza: tiene ₡/);
    const poco = await canjear({ monto: 300, intento_id: OTRO_INTENTO });
    expect(poco.cuerpo).toMatchObject({ ok: false, codigo: "debajo_del_minimo", minimo: 500 });
    expect(tablas.transacciones_puntos.some((t) => t.tipo === "canjeado")).toBe(false);
    expect(avisos).toEqual([]);
  });

  it("una tarjeta sin la marca de Foorkie (Pura Matcha) ni llega al RPC", async () => {
    tablas.foorkie_restaurantes[0].lealtad_por_foorkie = false;
    const r = await canjear({ monto: 1000, intento_id: INTENTO });
    expect(r.cuerpo).toMatchObject({ ok: false, codigo: "canje_no_libre" });
    expect(llamadasRpc).toEqual([]);
  });

  it("una tarjeta de Foorkie que canjea en tramos (sin canje libre) tampoco", async () => {
    tablas.programa_lealtad[0].beneficio = { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null };
    const r = await canjear({ monto: 1000, intento_id: INTENTO });
    expect(r.cuerpo).toMatchObject({ ok: false, codigo: "canje_no_libre" });
    expect(llamadasRpc).toEqual([]);
  });

  it("monto y premio a la vez, o un monto con decimales: 400 sin tocar la base", async () => {
    expect(await canjear({ monto: 1000, recompensa_id: OTRO_INTENTO, intento_id: INTENTO })).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    expect(await canjear({ monto: 1000.5, intento_id: INTENTO })).toMatchObject({ status: 400 });
    expect(await canjear({ monto: 1000 })).toMatchObject({ status: 400 });
    expect(llamadasRpc).toEqual([]);
  });

  it("sin la 0253 en la base: «todavía no se puede», y no es ambiguo (no se hizo nada)", async () => {
    // La función no existe: PostgREST contesta PGRST202.
    const { canjearMontoCore } = await import("@/lib/lealtad/operar-core");
    const r = await canjearMontoCore({
      db: { from: (t: string) => consulta(t), rpc: async () => ({ data: null, error: { code: "PGRST202", message: "no existe" } }) } as never,
      ranchoId: RANCHO,
      quien: { usuarioId: "dueno-1", permisos: { acreditar: true, canjear: true, revertir: false, auditoria: false } },
      miembroId: MIEMBRO,
      monto: 1000,
      referencia: `canje:${MIEMBRO}:cashback:${INTENTO}`,
    });
    expect(r).toMatchObject({ ok: false, codigo: "sin_migracion" });
  });
});
