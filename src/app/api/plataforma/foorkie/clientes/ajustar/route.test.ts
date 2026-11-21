import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/clientes/ajustar (0258), de punta a punta: la
 * firma de verdad, la puerta de verdad (`abrirLaCaja`), el núcleo
 * (`ajustarSaldoCore`) y un RPC de mentira que hace lo mismo que
 * `ajustar_saldo_lealtad` (idempotencia primero, nada bajo cero, una fila de
 * ledger `ajuste`).
 *
 * Pedido del dueño de Tostado: «a esta persona le entregaron más por error;
 * necesito poder quitarle puntos, otorgarle, etcétera». Lo que se fija:
 * quitar 470 de 475 deja 5 y el historial dice por qué y quién; quitar de más
 * se rechaza sin escribir; el reintento no ajusta dos veces; un cashback con
 * centavos habla en dólares hacia afuera y en centavos hacia el ledger.
 *
 * El SQL de verdad NO corre acá: se prueba contra la base (ver la cabecera de
 * la migración 0258).
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let llamadasRpc: Record<string, unknown>[] = [];
/** Reemplaza al RPC de mentira (para probar la base sin migrar). */
let rpcPropio: ((nombre: string, args: Record<string, unknown>) => { data: unknown; error: unknown } | null) | null = null;
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

/** Una consulta encadenable que aplica `eq` a las filas de su tabla. */
function consulta(tabla: string) {
  const eqs: [string, unknown][] = [];
  let unico = false;
  const b = {
    select: () => b,
    order: () => b,
    limit: () => b,
    eq: (col: string, val: unknown) => {
      eqs.push([col, val]);
      return b;
    },
    maybeSingle: () => {
      unico = true;
      return b;
    },
    then: (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          const filas = (tablas[tabla] ?? []).filter((f) => eqs.every(([c, v]) => f[c] === v)).map((f) => ({ ...f }));
          return { data: unico ? (filas[0] ?? null) : filas, error: null };
        })
        .then(ok, mal),
  };
  return b;
}

const saldoDe = (miembro: unknown) => tablas.transacciones_puntos.filter((t) => t.miembro_id === miembro).reduce((s, t) => s + Number(t.puntos), 0);

/** Lo mismo que `ajustar_saldo_lealtad` (0258), sobre las tablas de mentira. */
function ajustar(a: Record<string, unknown>) {
  const puntos = a.p_puntos as number;
  const ref = String(a.p_referencia ?? "").trim();
  const motivo = String(a.p_motivo ?? "").trim();
  if (!puntos || Math.abs(puntos) > 10_000_000) return { ok: false, codigo: "cantidad_invalida", motivo: "La cantidad tiene que ser distinta de cero." };
  if (!ref) return { ok: false, codigo: "sin_referencia", motivo: "Falta la llave de la operación." };
  if (!motivo) return { ok: false, codigo: "sin_motivo", motivo: "Escribe por qué se modifica." };

  const miembro = tablas.miembros.find((m) => m.id === a.p_miembro_id);
  if (!miembro) return { ok: false, codigo: "membresia_inactiva", motivo: "Esa membresía no existe." };
  const saldo = saldoDe(a.p_miembro_id);

  const previo = tablas.transacciones_puntos.find((t) => t.miembro_id === a.p_miembro_id && t.referencia === ref);
  if (previo) return { ok: true, ya_estaba: true, saldo, puntos: previo.puntos };

  if (!["activa", "pausada"].includes(String(miembro.estado))) return { ok: false, codigo: "membresia_inactiva", motivo: "Ese cliente ya no tiene la tarjeta." };
  if (saldo + puntos < 0) {
    return { ok: false, codigo: "saldo_insuficiente", saldo, motivo: `No se puede quitar tanto: el cliente tiene ${saldo} y se quieren quitar ${Math.abs(puntos)}.` };
  }
  const tx = { id: `tx-${tablas.transacciones_puntos.length + 1}`, miembro_id: a.p_miembro_id, tipo: "ajuste", puntos, motivo, referencia: ref, saldo_anterior: saldo, saldo_posterior: saldo + puntos, usuario_id: null };
  tablas.transacciones_puntos.push(tx);
  return { ok: true, ya_estaba: false, saldo: saldo + puntos, puntos, transaccion_id: tx.id };
}

const dbDeMentira = {
  from: (t: string) => consulta(t),
  rpc: async (nombre: string, args: Record<string, unknown>) => {
    llamadasRpc.push({ nombre, ...args });
    const propio = rpcPropio?.(nombre, args);
    if (propio) return propio;
    if (nombre === "ajustar_saldo_lealtad") return { data: ajustar(args), error: null };
    return { data: null, error: { code: "PGRST202", message: "no" } };
  },
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => dbDeMentira }));

import { POST } from "./route";
import { motivoDelAjuste, referenciaDelAjuste } from "@/lib/plataforma/foorkie-ajuste";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const OTRO_PROGRAMA = "66666666-6666-4666-8666-666666666666";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const AJENO = "77777777-7777-4777-8777-777777777777";
const INTENTO = "44444444-4444-4444-8444-444444444444";
const OTRO_INTENTO = "55555555-5555-4555-8555-555555555555";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

function firmado(cuerpo: Record<string, unknown>, secreto = SECRETO): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", secreto).update(`${t}.${texto}`).digest("hex");
  return new Request("https://www.bookea.lat/api/plataforma/foorkie/clientes/ajustar", {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

async function pedir(cuerpo: Record<string, unknown>) {
  const r = await POST(firmado({ ...vinculo, miembro_id: MIEMBRO, intento_id: INTENTO, motivo: "Se le entregó de más por error", ...cuerpo }));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

const ajustes = () => tablas.transacciones_puntos.filter((t) => t.tipo === "ajuste");

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  llamadasRpc = [];
  rpcPropio = null;
  avisos.length = 0;
  tablas = {
    foorkie_restaurantes: [
      { id: "local-1", slug: "tostado", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: true, activo: true, estado_publicacion: "aprobado" },
    ],
    ranchos: [{ id: RANCHO, owner_id: "dueno-1", nombre: "Tostado" }],
    programa_lealtad: [
      { id: PROGRAMA, rancho_id: RANCHO, nombre: "Tarjeta de puntos", modo: "puntos", estado: "activo", activo: true, beneficio: { tipo: "puntos" } },
      { id: OTRO_PROGRAMA, rancho_id: "otro-rancho", nombre: "Otra", modo: "puntos", estado: "activo", activo: true, beneficio: { tipo: "puntos" } },
    ],
    miembros: [
      { id: MIEMBRO, programa_id: PROGRAMA, persona_id: null, cliente_id: null, estado: "activa" },
      { id: AJENO, programa_id: OTRO_PROGRAMA, persona_id: null, cliente_id: null, estado: "activa" },
    ],
    // Saldo: 475 puntos (la compra de $475 del mostrador, por error).
    transacciones_puntos: [{ id: "tx-0", miembro_id: MIEMBRO, tipo: "ganado", puntos: 475, referencia: "mostrador:p1" }],
  };
});

describe("clientes/ajustar — modificar a mano el saldo de un cliente", () => {
  it("quitar 470 de 475: queda en 5, el historial dice por qué y quién, y avisa al pase UNA vez", async () => {
    const r = await pedir({ puntos: -470, operador: "Ana" });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, puntos: -470, saldo: 5, ya_estaba: false } });

    // El RPC recibe la cantidad con signo, la llave del intento y el motivo con quién fue.
    expect(llamadasRpc).toEqual([
      {
        nombre: "ajustar_saldo_lealtad",
        p_miembro_id: MIEMBRO,
        p_puntos: -470,
        p_referencia: `panel:ajuste:${MIEMBRO}:${INTENTO}`,
        p_motivo: "Se le entregó de más por error (Ana)",
      },
    ]);
    expect(ajustes().map((t) => [t.puntos, t.saldo_anterior, t.saldo_posterior, t.motivo, t.usuario_id])).toEqual([[-470, 475, 5, "Se le entregó de más por error (Ana)", null]]);
    expect(saldoDe(MIEMBRO)).toBe(5);
    // «Tu tarjeta se modificó»: el evento de las correcciones del negocio.
    expect(avisos).toEqual([{ miembro: MIEMBRO, evento: "quitar" }]);
  });

  it("dar 20: suma y avisa igual", async () => {
    const r = await pedir({ puntos: 20, motivo: "Regalo por el error de la fila" });
    expect(r.cuerpo).toEqual({ ok: true, puntos: 20, saldo: 495, ya_estaba: false });
    expect(ajustes().map((t) => t.puntos)).toEqual([20]);
    expect(avisos).toHaveLength(1);
  });

  it("quitar más de lo que tiene: saldo_insuficiente con lo que tiene y NO se escribe nada", async () => {
    const r = await pedir({ puntos: -500 });
    expect(r).toEqual({
      status: 200,
      cuerpo: { ok: false, codigo: "saldo_insuficiente", motivo: "No se puede quitar tanto: el cliente tiene 475 y se quieren quitar 500.", saldo: 475 },
    });
    expect(ajustes()).toEqual([]);
    expect(saldoDe(MIEMBRO)).toBe(475);
    expect(avisos).toEqual([]);
  });

  it("el reintento del MISMO intento no ajusta dos veces ni avisa dos veces; otro intento sí ajusta", async () => {
    await pedir({ puntos: -100 });
    const repetido = await pedir({ puntos: -100 });
    expect(repetido.cuerpo).toEqual({ ok: true, puntos: -100, saldo: 375, ya_estaba: true });
    expect(ajustes()).toHaveLength(1);
    expect(avisos).toHaveLength(1);

    const otro = await pedir({ puntos: -100, intento_id: OTRO_INTENTO });
    expect(otro.cuerpo).toMatchObject({ ok: true, saldo: 275, ya_estaba: false });
    expect(ajustes()).toHaveLength(2);
  });

  it("una tarjeta de puntos no acepta decimales: se rechaza sin llamar al RPC", async () => {
    const r = await pedir({ puntos: -2.5 });
    expect(r.cuerpo).toEqual({ ok: false, codigo: "cantidad_invalida", motivo: "La cantidad tiene que ser un número entero." });
    expect(llamadasRpc).toEqual([]);
  });

  it("un cashback con centavos: hacia afuera en dólares, hacia el ledger en centavos", async () => {
    tablas.programa_lealtad[0] = { ...tablas.programa_lealtad[0], modo: "cashback", beneficio: { tipo: "cashback", moneda: "USD", escala: 100 } };
    // 475 centavos de saldo = $4.75.
    const r = await pedir({ puntos: -1.25 });
    expect(r.cuerpo).toEqual({ ok: true, puntos: -1.25, saldo: 3.5, ya_estaba: false });
    expect(llamadasRpc[0]).toMatchObject({ p_puntos: -125 });
    expect(saldoDe(MIEMBRO)).toBe(350);

    const demasiados = await pedir({ puntos: 0.005, intento_id: OTRO_INTENTO });
    expect(demasiados.cuerpo).toMatchObject({ ok: false, codigo: "cantidad_invalida" });
  });

  it("un cliente de otra tarjeta no entra", async () => {
    const r = await pedir({ puntos: -10, miembro_id: AJENO });
    expect(r.cuerpo).toEqual({ ok: false, codigo: "miembro_ajeno", motivo: "Ese cliente no tiene esta tarjeta." });
    expect(llamadasRpc).toEqual([]);
  });

  it("sin la migración (0258) no se hizo nada y se dice", async () => {
    rpcPropio = () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    const r = await pedir({ puntos: -10 });
    expect(r.cuerpo).toMatchObject({ ok: false, codigo: "sin_migracion" });
    expect(avisos).toEqual([]);
  });

  it("lo que viene mal formado se rechaza con 400 antes de tocar nada", async () => {
    for (const malo of [{ puntos: 0 }, { puntos: "10" }, { puntos: null }, { motivo: "  " }, { motivo: "ab" }, { motivo: "x".repeat(91) }, { intento_id: "no-es-uuid" }, { miembro_id: "no-es-uuid" }]) {
      const r = await pedir({ puntos: -10, ...malo });
      expect(r.status).toBe(400);
      expect(r.cuerpo).toMatchObject({ ok: false, codigo: "datos" });
    }
    expect(llamadasRpc).toEqual([]);
  });

  it("una firma que no es la nuestra es un 401", async () => {
    const r = await POST(firmado({ ...vinculo, miembro_id: MIEMBRO, intento_id: INTENTO, motivo: "Prueba", puntos: -10 }, "otro-secreto"));
    expect(r.status).toBe(401);
    expect(llamadasRpc).toEqual([]);
  });

  it("una tarjeta que no es de un local de Foorkie es un 403", async () => {
    tablas.foorkie_restaurantes = [];
    const r = await pedir({ puntos: -10 });
    expect(r.status).toBe(403);
    expect(llamadasRpc).toEqual([]);
  });
});

describe("motivo y llave del ajuste", () => {
  it("el motivo lleva quién fue entre paréntesis y la llave usa el prefijo del panel", () => {
    expect(motivoDelAjuste("Error de caja", "Ana")).toBe("Error de caja (Ana)");
    expect(motivoDelAjuste("Error de caja", null)).toBe("Error de caja");
    expect(motivoDelAjuste("Error de caja", "  ")).toBe("Error de caja");
    expect(referenciaDelAjuste(MIEMBRO, INTENTO)).toBe(`panel:ajuste:${MIEMBRO}:${INTENTO}`);
  });

  it("el operador se corta a 40 letras: el renglón de la ficha no pasa de 140", () => {
    const largo = motivoDelAjuste("x".repeat(90), "Y".repeat(80));
    expect(largo.length).toBeLessThanOrEqual(140);
  });
});
