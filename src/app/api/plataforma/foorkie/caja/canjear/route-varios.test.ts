import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/caja/canjear CON `premios` (0257), de punta a
 * punta: la firma de verdad, la puerta de verdad (`abrirLaCaja`), el núcleo
 * (`canjearVariosCore`) y un RPC de mentira que hace lo mismo que
 * `canjear_recompensas_varias` (idempotencia primero, todo validado antes de
 * escribir, el saldo contra el TOTAL, una fila de ledger y de canjes por
 * unidad).
 *
 * Pedido del dueño: «tengo 100 puntos y canjeo 4 cosas de 25 puntos; si
 * intento canjear algo superior, me tira un error de que no tengo esa
 * cantidad de puntos». Lo que se fija: 4 × 25 con 100 → ok y saldo 0;
 * 5 × 25 → `saldo_insuficiente` sin escribir nada; el reintento del mismo
 * intento no cobra dos veces; un premio de otra tarjeta no entra.
 *
 * El SQL de verdad NO corre acá: se prueba contra la base (ver la cabecera de
 * la migración 0257).
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let llamadasRpc: Record<string, unknown>[] = [];
/** Reemplaza al RPC de mentira (para probar la base sin migrar o caída). */
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

/** Una consulta encadenable que aplica `eq`, `neq` e `in` a las filas de su tabla (y cuenta con `head`). */
function consulta(tabla: string) {
  const eqs: [string, unknown][] = [];
  const neqs: [string, unknown][] = [];
  const ins: [string, unknown[]][] = [];
  let unico = false;
  let contar = false;
  const b = {
    select: (_cols?: string, opciones?: { count?: string; head?: boolean }) => {
      if (opciones?.head) contar = true;
      return b;
    },
    order: () => b,
    limit: () => b,
    eq: (col: string, val: unknown) => {
      eqs.push([col, val]);
      return b;
    },
    neq: (col: string, val: unknown) => {
      neqs.push([col, val]);
      return b;
    },
    in: (col: string, vals: unknown[]) => {
      ins.push([col, vals]);
      return b;
    },
    maybeSingle: () => {
      unico = true;
      return b;
    },
    insert: (filas: Fila | Fila[]) => {
      const lista = Array.isArray(filas) ? filas : [filas];
      tablas[tabla] = [...(tablas[tabla] ?? []), ...lista.map((f) => ({ ...f }))];
      return Promise.resolve({ data: null, error: null });
    },
    then: (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          const filas = (tablas[tabla] ?? [])
            .filter((f) => eqs.every(([c, v]) => f[c] === v))
            .filter((f) => neqs.every(([c, v]) => f[c] !== v))
            .filter((f) => ins.every(([c, vs]) => vs.includes(f[c])));
          if (contar) return { data: null, count: filas.length, error: null };
          const vistas = filas.map((f) => ({ ...f }));
          return { data: unico ? (vistas[0] ?? null) : vistas, error: null };
        })
        .then(ok, mal),
  };
  return b;
}

const saldoDe = (miembro: unknown) =>
  (tablas.transacciones_puntos ?? []).filter((t) => t.miembro_id === miembro).reduce((s, t) => s + Number(t.puntos), 0);

/** Lo mismo que `canjear_recompensas_varias` (0257), sobre las tablas de mentira. */
function canjearVarias(a: Record<string, unknown>) {
  const items = a.p_items as { recompensa_id: string; cantidad: number }[];
  const prefijo = `${a.p_referencia_base}:`;
  const saldo = saldoDe(a.p_miembro_id);

  // La idempotencia, PRIMERO: lo que ya se entregó con esta base.
  const previos = tablas.canjes.filter(
    (c) => c.miembro_id === a.p_miembro_id && String(c.referencia).startsWith(prefijo) && /^[0-9]{1,4}$/.test(String(c.referencia).slice(prefijo.length)),
  );
  if (previos.length > 0) {
    const porPremio = new Map<string, { cantidad: number; puntos: number }>();
    for (const c of previos) {
      const k = String(c.recompensa_id);
      porPremio.set(k, { cantidad: (porPremio.get(k)?.cantidad ?? 0) + 1, puntos: Number(c.puntos) });
    }
    return {
      ok: true,
      ya_estaba: true,
      saldo,
      total_puntos: previos.reduce((s, c) => s + Number(c.puntos), 0),
      items: [...porPremio].map(([id, v]) => {
        const r = tablas.recompensas.find((x) => x.id === id) as Fila;
        return { recompensa_id: id, recompensa: r.nombre, sku: r.sku, instrucciones: r.instrucciones, ...v };
      }),
    };
  }

  const miembro = tablas.miembros.find((m) => m.id === a.p_miembro_id);
  if (!miembro || miembro.estado !== "activa") {
    return { ok: false, codigo: "membresia_inactiva", motivo: "Esa membresía no está activa." };
  }

  // TODO se valida antes de escribir.
  let total = 0;
  const plan: { r: Fila; cantidad: number }[] = [];
  for (const it of items) {
    const r = tablas.recompensas.find((x) => x.id === it.recompensa_id);
    if (!r || r.programa_id !== miembro.programa_id) {
      return { ok: false, codigo: "recompensa_ajena", motivo: "Alguno de esos premios no es de esta tarjeta." };
    }
    if (!r.activo) return { ok: false, codigo: "recompensa_no_disponible", motivo: `«${r.nombre}» está desactivada.` };
    const hechos = tablas.canjes.filter((c) => c.recompensa_id === r.id && c.estado !== "anulado");
    if (r.stock_total !== null && hechos.length + it.cantidad > Number(r.stock_total)) {
      return { ok: false, codigo: "agotada", motivo: `De «${r.nombre}» no quedan suficientes.` };
    }
    const delCliente = hechos.filter((c) => c.miembro_id === a.p_miembro_id).length;
    if (r.limite_por_cliente !== null && delCliente + it.cantidad > Number(r.limite_por_cliente)) {
      return { ok: false, codigo: "limite_alcanzado", motivo: "Este cliente ya canjeó su máximo." };
    }
    total += Number(r.costo_puntos) * it.cantidad;
    plan.push({ r, cantidad: it.cantidad });
  }
  if (saldo < total) {
    return { ok: false, codigo: "saldo_insuficiente", saldo, total, motivo: `Saldo insuficiente: tiene ${saldo} y el total cuesta ${total}.` };
  }

  // Ya validado: una fila de ledger y una de canjes POR UNIDAD, con el saldo encadenado.
  let actual = saldo;
  let n = 0;
  const canjes: Fila[] = [];
  for (const { r, cantidad } of plan) {
    for (let u = 0; u < cantidad; u++) {
      n += 1;
      const costo = Number(r.costo_puntos);
      const ref = `${prefijo}${n}`;
      const tx = { id: `tx-${ref}`, miembro_id: a.p_miembro_id, tipo: "canjeado", puntos: -costo, referencia: ref, saldo_anterior: actual, saldo_posterior: actual - costo };
      tablas.transacciones_puntos.push(tx);
      const canje = { id: `canje-${n}`, miembro_id: a.p_miembro_id, recompensa_id: r.id, puntos: costo, estado: "entregado", transaccion_id: tx.id, referencia: ref };
      tablas.canjes.push(canje);
      actual -= costo;
      canjes.push({ canje_id: canje.id, recompensa_id: r.id, recompensa: r.nombre, sku: r.sku, puntos: costo, saldo: actual });
    }
  }
  return {
    ok: true,
    ya_estaba: false,
    saldo: actual,
    total_puntos: total,
    items: plan.map(({ r, cantidad }) => ({ recompensa_id: r.id, recompensa: r.nombre, sku: r.sku, instrucciones: r.instrucciones, cantidad, puntos: r.costo_puntos })),
    canjes,
  };
}

const dbDeMentira = {
  from: (t: string) => consulta(t),
  rpc: async (nombre: string, args: Record<string, unknown>) => {
    llamadasRpc.push({ nombre, ...args });
    const propio = rpcPropio?.(nombre, args);
    if (propio) return propio;
    if (nombre === "canjear_recompensas_varias") return { data: canjearVarias(args), error: null };
    if (nombre === "canjear_recompensa") {
      return { data: { ok: true, canje_id: "canje-uno", saldo: 75, recompensa: "Café del día 8 oz", sku: "CAFE8", instrucciones: null }, error: null };
    }
    return { data: null, error: { code: "PGRST202", message: "no" } };
  },
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => dbDeMentira }));

import { POST } from "./route";
import { canjearVariosCore } from "@/lib/lealtad/operar-core";
import { referenciaCanjeVarios } from "@/lib/lealtad/canje-varios";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const OTRO_PROGRAMA = "66666666-6666-4666-8666-666666666666";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const INTENTO = "44444444-4444-4444-8444-444444444444";
const OTRO_INTENTO = "55555555-5555-4555-8555-555555555555";
const CAFE = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const PASTEL = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";
const AJENO = "aaaaaaaa-aaaa-4aaa-8aaa-000000000003";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };
const QUIEN = { usuarioId: "dueno-1", permisos: { acreditar: true, canjear: true, revertir: false, auditoria: false } };

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

const pide = (...renglones: [string, number][]) => renglones.map(([recompensa_id, cantidad]) => ({ recompensa_id, cantidad }));
const canjesHechos = () => tablas.canjes.filter((c) => c.estado !== "anulado");
const movimientosDeCanje = () => tablas.transacciones_puntos.filter((t) => t.tipo === "canjeado");

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
    miembros: [{ id: MIEMBRO, programa_id: PROGRAMA, persona_id: null, cliente_id: null, estado: "activa" }],
    recompensas: [
      { id: CAFE, programa_id: PROGRAMA, nombre: "Café del día 8 oz", costo_puntos: 25, activo: true, stock_total: null, limite_por_cliente: null, sku: "CAFE8", instrucciones: null },
      { id: PASTEL, programa_id: PROGRAMA, nombre: "Pastel de la casa", costo_puntos: 40, activo: true, stock_total: null, limite_por_cliente: null, sku: null, instrucciones: "  Sácalo del refrigerador.  " },
      { id: AJENO, programa_id: OTRO_PROGRAMA, nombre: "Premio de otro local", costo_puntos: 10, activo: true, stock_total: null, limite_por_cliente: null, sku: null, instrucciones: null },
    ],
    // Saldo: 100 puntos.
    transacciones_puntos: [{ id: "tx-0", miembro_id: MIEMBRO, tipo: "ganado", puntos: 100, referencia: "foorkie:p1" }],
    canjes: [],
    eventos_integracion: [],
    intentos_canje: [],
  };
});

describe("caja/canjear con premios — varios a la vez, todo o nada", () => {
  it("4 × 25 con saldo 100: entrega los 4, el saldo queda en 0 y avisa al pase UNA vez", async () => {
    const r = await canjear({ premios: pide([CAFE, 4]), intento_id: INTENTO });
    expect(r).toEqual({
      status: 200,
      cuerpo: {
        ok: true,
        saldo: 0,
        total_puntos: 100,
        canjeados: [{ recompensa_id: CAFE, recompensa: "Café del día 8 oz", cantidad: 4, puntos: 25 }],
        instrucciones: [],
      },
    });

    // UNA llamada al RPC, con la lista y la llave base del intento.
    expect(llamadasRpc).toEqual([
      {
        nombre: "canjear_recompensas_varias",
        p_miembro_id: MIEMBRO,
        p_items: [{ recompensa_id: CAFE, cantidad: 4 }],
        p_usuario_id: "dueno-1",
        p_referencia_base: `canje:${MIEMBRO}:${INTENTO}`,
      },
    ]);

    // Una fila de ledger y una de canjes POR UNIDAD, con el saldo encadenado.
    expect(movimientosDeCanje().map((t) => [t.referencia, t.puntos, t.saldo_anterior, t.saldo_posterior])).toEqual([
      [`canje:${MIEMBRO}:${INTENTO}:1`, -25, 100, 75],
      [`canje:${MIEMBRO}:${INTENTO}:2`, -25, 75, 50],
      [`canje:${MIEMBRO}:${INTENTO}:3`, -25, 50, 25],
      [`canje:${MIEMBRO}:${INTENTO}:4`, -25, 25, 0],
    ]);
    expect(canjesHechos()).toHaveLength(4);
    expect(saldoDe(MIEMBRO)).toBe(0);

    // UN aviso al Wallet (no uno por unidad), un evento de POS por unidad y
    // una constancia aprobada por premio pedido.
    expect(avisos).toEqual([{ miembro: MIEMBRO, evento: "canjear" }]);
    expect(tablas.eventos_integracion).toHaveLength(4);
    expect(new Set(tablas.eventos_integracion.map((e) => e.idempotencia)).size).toBe(4);
    expect(tablas.eventos_integracion[3]).toMatchObject({
      rancho_id: RANCHO,
      tipo: "canje",
      payload: { miembro_id: MIEMBRO, recompensa: "Café del día 8 oz", sku: "CAFE8", saldo_resultante: 0 },
    });
    expect(tablas.intentos_canje).toEqual([
      { programa_id: PROGRAMA, miembro_id: MIEMBRO, recompensa_id: CAFE, usuario_id: "dueno-1", aprobado: true, motivo: null },
    ]);
  });

  it("5 × 25 con saldo 100: saldo_insuficiente con lo que tiene y lo que cuesta, y NO se escribe nada", async () => {
    const r = await canjear({ premios: pide([CAFE, 5]), intento_id: INTENTO });
    expect(r).toEqual({
      status: 200,
      cuerpo: { ok: false, codigo: "saldo_insuficiente", motivo: "Saldo insuficiente: tiene 100 y el total cuesta 125.", saldo: 100, total: 125 },
    });
    expect(movimientosDeCanje()).toEqual([]);
    expect(tablas.canjes).toEqual([]);
    expect(saldoDe(MIEMBRO)).toBe(100);
    expect(avisos).toEqual([]);
    expect(tablas.eventos_integracion).toEqual([]);
    expect(tablas.intentos_canje).toEqual([
      { programa_id: PROGRAMA, miembro_id: MIEMBRO, recompensa_id: CAFE, usuario_id: "dueno-1", aprobado: false, motivo: "saldo_insuficiente" },
    ]);
  });

  it("varios premios distintos: el total se suma, las instrucciones son una por premio y el orden es el pedido", async () => {
    const r = await canjear({ premios: pide([PASTEL, 1], [CAFE, 2]), intento_id: INTENTO });
    expect(r.cuerpo).toEqual({
      ok: true,
      saldo: 10,
      total_puntos: 90,
      canjeados: [
        { recompensa_id: PASTEL, recompensa: "Pastel de la casa", cantidad: 1, puntos: 40 },
        { recompensa_id: CAFE, recompensa: "Café del día 8 oz", cantidad: 2, puntos: 25 },
      ],
      instrucciones: ["Sácalo del refrigerador."],
    });
    expect(movimientosDeCanje().map((t) => t.puntos)).toEqual([-40, -25, -25]);
    // Uno de los dos tiene el tope justo: 40 + 25 + 25 = 90 ≤ 100, pero 40 + 25 × 3 = 115 no.
    const mas = await canjear({ premios: pide([PASTEL, 1], [CAFE, 3]), intento_id: OTRO_INTENTO });
    expect(mas.cuerpo).toMatchObject({ ok: false, codigo: "saldo_insuficiente", saldo: 10, total: 115 });
  });

  it("el reintento con el MISMO intento no descuenta dos veces, aunque el saldo ya no alcance (ni avisa de nuevo)", async () => {
    const primera = await canjear({ premios: pide([CAFE, 4]), intento_id: INTENTO });
    expect(primera.cuerpo).not.toHaveProperty("ya_estaba");
    const otra = await canjear({ premios: pide([CAFE, 4]), intento_id: INTENTO });
    expect(otra.cuerpo).toEqual({
      ok: true,
      ya_estaba: true,
      saldo: 0,
      total_puntos: 100,
      canjeados: [{ recompensa_id: CAFE, recompensa: "Café del día 8 oz", cantidad: 4, puntos: 25 }],
      instrucciones: [],
    });
    expect(movimientosDeCanje()).toHaveLength(4);
    expect(canjesHechos()).toHaveLength(4);
    expect(saldoDe(MIEMBRO)).toBe(0);
    expect(avisos).toHaveLength(1);
    expect(tablas.eventos_integracion).toHaveLength(4);
    // Otro intento es otra operación: ahí sí le dice que no alcanza.
    const nuevo = await canjear({ premios: pide([CAFE, 1]), intento_id: OTRO_INTENTO });
    expect(nuevo.cuerpo).toMatchObject({ ok: false, codigo: "saldo_insuficiente", saldo: 0, total: 25 });
  });

  it("un renglón repetido, un tope roto o premios junto con premio o monto: 400 sin tocar la base", async () => {
    const repetido = await canjear({ premios: pide([CAFE, 1], [CAFE, 2]), intento_id: INTENTO });
    expect(repetido).toMatchObject({ status: 400, cuerpo: { ok: false, codigo: "datos" } });
    expect(await canjear({ premios: [], intento_id: INTENTO })).toMatchObject({ status: 400 });
    expect(await canjear({ premios: pide([CAFE, 21]), intento_id: INTENTO })).toMatchObject({ status: 400 });
    expect(await canjear({ premios: pide([CAFE, 20], [PASTEL, 11]), intento_id: INTENTO })).toMatchObject({ status: 400 });
    expect(await canjear({ premios: pide([CAFE, 1]), recompensa_id: PASTEL, intento_id: INTENTO })).toMatchObject({ status: 400 });
    expect(await canjear({ premios: pide([CAFE, 1]), monto: 1000, intento_id: INTENTO })).toMatchObject({ status: 400 });
    expect(await canjear({ premios: pide([CAFE, 1]) })).toMatchObject({ status: 400 });
    expect(llamadasRpc).toEqual([]);
    expect(movimientosDeCanje()).toEqual([]);
  });

  it("un premio de OTRA tarjeta, o que no existe: recompensa_ajena, y ni llega al RPC", async () => {
    const ajeno = await canjear({ premios: pide([CAFE, 1], [AJENO, 1]), intento_id: INTENTO });
    expect(ajeno.cuerpo).toMatchObject({ ok: false, codigo: "recompensa_ajena" });
    const fantasma = await canjear({ premios: pide([CAFE, 1], ["aaaaaaaa-aaaa-4aaa-8aaa-0000000000ff", 1]), intento_id: INTENTO });
    expect(fantasma.cuerpo).toMatchObject({ ok: false, codigo: "recompensa_ajena" });
    expect(llamadasRpc).toEqual([]);
    expect(movimientosDeCanje()).toEqual([]);
    expect(avisos).toEqual([]);
  });

  it("un cliente de otra tarjeta: miembro_ajeno", async () => {
    tablas.miembros.push({ id: "99999999-9999-4999-8999-999999999999", programa_id: OTRO_PROGRAMA, estado: "activa" });
    const r = await canjear({ miembro_id: "99999999-9999-4999-8999-999999999999", premios: pide([CAFE, 1]), intento_id: INTENTO });
    expect(r.cuerpo).toMatchObject({ ok: false, codigo: "miembro_ajeno" });
    expect(llamadasRpc).toEqual([]);
  });

  it.each([
    ["recompensa_no_disponible", (t: typeof tablas) => ((t.recompensas[0] as Fila).activo = false)],
    ["agotada", (t: typeof tablas) => ((t.recompensas[0] as Fila).stock_total = 3)],
    ["limite_alcanzado", (t: typeof tablas) => ((t.recompensas[0] as Fila).limite_por_cliente = 3)],
    ["membresia_inactiva", (t: typeof tablas) => ((t.miembros[0] as Fila).estado = "pausada")],
  ])("%s: el RPC lo rechaza y no se escribe nada", async (codigo, preparar) => {
    preparar(tablas);
    const r = await canjear({ premios: pide([CAFE, 4]), intento_id: INTENTO });
    expect(r.cuerpo).toMatchObject({ ok: false, codigo });
    expect(movimientosDeCanje()).toEqual([]);
    expect(tablas.canjes).toEqual([]);
    expect(avisos).toEqual([]);
  });

  it("sin la 0257 en la base: sin_migracion, y no se hizo nada", async () => {
    rpcPropio = () => ({ data: null, error: { code: "PGRST202", message: "no existe" } });
    const r = await canjear({ premios: pide([CAFE, 1]), intento_id: INTENTO });
    expect(r.cuerpo).toMatchObject({ ok: false, codigo: "sin_migracion" });
    expect(movimientosDeCanje()).toEqual([]);
    expect(avisos).toEqual([]);
    expect(tablas.intentos_canje).toEqual([]);
  });

  it("las reglas de la tarjeta cuentan lo que se pide: con tope de 3 por cliente, 4 unidades no pasan (ni llegan al RPC)", async () => {
    (tablas.programa_lealtad[0] as Fila).max_por_cliente = 3;
    const cuatro = await canjear({ premios: pide([CAFE, 2], [PASTEL, 2]), intento_id: INTENTO });
    expect(cuatro.cuerpo).toMatchObject({ ok: false, codigo: "tope_cliente" });
    expect(llamadasRpc).toEqual([]);
    // Con 3 unidades cabe justo (2 × 25 + 1 × 40 = 90).
    const tres = await canjear({ premios: pide([CAFE, 2], [PASTEL, 1]), intento_id: OTRO_INTENTO });
    expect(tres.cuerpo).toMatchObject({ ok: true, saldo: 10 });
  });

  it("un premio suelto (recompensa_id) sigue por canjear_recompensa, como siempre", async () => {
    const r = await canjear({ recompensa_id: CAFE, intento_id: INTENTO });
    expect(r.cuerpo).toEqual({ ok: true, saldo: 75, recompensa: "Café del día 8 oz", instrucciones: null });
    expect(llamadasRpc).toEqual([
      {
        nombre: "canjear_recompensa",
        p_miembro_id: MIEMBRO,
        p_recompensa_id: CAFE,
        p_usuario_id: "dueno-1",
        p_referencia: `canje:${MIEMBRO}:${CAFE}:${INTENTO}`,
      },
    ]);
  });
});

describe("canjearVariosCore — lo que la ruta no alcanza a probar", () => {
  const entrada = (extra: Record<string, unknown> = {}) => ({
    db: dbDeMentira as never,
    ranchoId: RANCHO,
    quien: QUIEN,
    miembroId: MIEMBRO,
    premios: [{ recompensaId: CAFE, cantidad: 2 }],
    referencia: referenciaCanjeVarios(MIEMBRO, INTENTO),
    ...extra,
  });

  it("sin el permiso de canjear: no, y no toca la base", async () => {
    const r = await canjearVariosCore(entrada({ quien: { ...QUIEN, permisos: { ...QUIEN.permisos, canjear: false } } }));
    expect(r).toMatchObject({ ok: false, codigo: "sin_permiso" });
    expect(llamadasRpc).toEqual([]);
  });

  it("un pedido fuera de los topes lo frena el núcleo aunque la puerta lo deje pasar", async () => {
    expect(await canjearVariosCore(entrada({ premios: [] }))).toMatchObject({ ok: false, codigo: "datos" });
    expect(
      await canjearVariosCore(entrada({ premios: [{ recompensaId: CAFE, cantidad: 1 }, { recompensaId: CAFE, cantidad: 1 }] })),
    ).toMatchObject({ ok: false, codigo: "datos" });
    expect(await canjearVariosCore(entrada({ premios: [{ recompensaId: CAFE, cantidad: 2.5 }] }))).toMatchObject({ ok: false, codigo: "datos" });
    expect(await canjearVariosCore(entrada({ referencia: "  " }))).toMatchObject({ ok: false, codigo: "sin_referencia" });
    expect(llamadasRpc).toEqual([]);
  });

  it("un negocio que no es el del miembro: miembro_ajeno", async () => {
    expect(await canjearVariosCore(entrada({ ranchoId: "otro-rancho" }))).toMatchObject({ ok: false, codigo: "miembro_ajeno" });
    expect(llamadasRpc).toEqual([]);
  });

  it("un error de la base que no es «falta la migración»: error_base, anotado, sin aviso al pase", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcPropio = () => ({ data: null, error: { code: "40001", message: "could not serialize access" } });
    const r = await canjearVariosCore(entrada());
    expect(r).toMatchObject({ ok: false, codigo: "error_base" });
    expect(avisos).toEqual([]);
    expect(tablas.intentos_canje).toEqual([
      { programa_id: PROGRAMA, miembro_id: MIEMBRO, recompensa_id: CAFE, usuario_id: "dueno-1", aprobado: false, motivo: "error_rpc" },
    ]);
    consola.mockRestore();
  });

  it("una tarjeta de cashback con centavos: el saldo y el total salen en la moneda, no en centavos", async () => {
    (tablas.programa_lealtad[0] as Fila).beneficio = { tipo: "cashback", moneda: "USD", escala: 100 };
    // 100 centavos de saldo; el pedido cuesta 25 × 5 = 125 centavos.
    const r = await canjearVariosCore(entrada({ premios: [{ recompensaId: CAFE, cantidad: 5 }] }));
    expect(r).toEqual({
      ok: false,
      codigo: "saldo_insuficiente",
      motivo: "Saldo insuficiente: tiene $1.00 y el total cuesta $1.25.",
      saldo: 1,
      total: 1.25,
    });
    const bien = await canjearVariosCore(entrada({ premios: [{ recompensaId: CAFE, cantidad: 3 }] }));
    expect(bien).toMatchObject({ ok: true, saldo: 0.25, totalPuntos: 0.75, yaEstaba: false });
    expect(bien.ok && bien.canjeados).toEqual([{ recompensaId: CAFE, recompensa: "Café del día 8 oz", cantidad: 3, puntos: 0.25 }]);
  });

  it("el evento de POS que falla no tumba el canje (el débito ya está en el ledger)", async () => {
    const original = dbDeMentira.from;
    dbDeMentira.from = (t: string) => {
      if (t === "eventos_integracion") throw new Error("la tabla no existe");
      return original(t);
    };
    try {
      const r = await canjearVariosCore(entrada());
      expect(r).toMatchObject({ ok: true, saldo: 50, yaEstaba: false });
      expect(avisos).toHaveLength(1);
    } finally {
      dbDeMentira.from = original;
    }
  });
});
