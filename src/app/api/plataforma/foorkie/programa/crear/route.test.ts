import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * POST /api/plataforma/foorkie/programa/crear — OTRA tarjeta en el negocio
 * de un local de Foorkie (11 nov 2026, «Tostado Café Bistró»: puntos y dos
 * de socio). La firma, la validación de la tarjeta (`validarTarjetaDeAlta`)
 * y el paquete son los de verdad; la base es de mentira y anota qué se
 * escribe. La siembra del premio es de mentira: se fija que se llame.
 *
 * Lo que se fija:
 *   · solo sobre la PRINCIPAL de un local con la marca, en su negocio;
 *   · la tarjeta nueva nace en ESE negocio, con id = intento_id, con la
 *     marca de la principal si no trae colores ni logo;
 *   · un reintento no crea otra; un intento de otro negocio es un 400;
 *   · la de socio con renovación automática nace sin vencimiento.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let escrituras: { op: "insert" | "update"; tabla: string; fila: Fila; donde?: [string, unknown][] }[] = [];

function consulta(tabla: string) {
  const eqs: [string, unknown][] = [];
  let unico = false;
  let limite: number | null = null;
  let cambio: Fila | null = null;
  const leer = () => {
    const filas = (tablas[tabla] ?? []).filter((f) => eqs.every(([c, v]) => f[c] === v));
    const vistas = (limite === null ? filas : filas.slice(0, limite)).map((f) => structuredClone(f));
    return { data: unico ? (vistas[0] ?? null) : vistas, error: null };
  };
  const b: Record<string, unknown> = {
    select: () => b,
    order: () => b,
    eq: (col: string, val: unknown) => {
      eqs.push([col, val]);
      return b;
    },
    in: () => b,
    limit: (n: number) => {
      limite = n;
      return b;
    },
    maybeSingle: () => {
      unico = true;
      return b;
    },
    insert: (fila: Fila) => {
      escrituras.push({ op: "insert", tabla, fila });
      const lista = (tablas[tabla] ??= []);
      if (fila.id && lista.some((f) => f.id === fila.id)) {
        return Promise.resolve({ error: { code: "23505", message: "duplicate key value violates unique constraint" } });
      }
      lista.push(structuredClone(fila));
      return Promise.resolve({ error: null });
    },
    update: (fila: Fila) => {
      cambio = fila;
      return b;
    },
    then: (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          if (cambio) {
            escrituras.push({ op: "update", tabla, fila: cambio, donde: [...eqs] });
            for (const f of tablas[tabla] ?? []) if (eqs.every(([c, v]) => f[c] === v)) Object.assign(f, cambio);
            return { data: null, error: null };
          }
          return leer();
        })
        .then(ok, mal),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => consulta(t) }) }));

vi.mock("@/lib/lealtad/sembrar-recompensa", () => ({
  sembrarRecompensa: vi.fn(async (_db: unknown, programaId: string, beneficio: Record<string, unknown>) => {
    // Como la de verdad: una membresía nace con su vigencia (`vigenciaMeses`).
    (tablas.recompensas ??= []).push({
      id: `premio-${programaId}`,
      programa_id: programaId,
      costo_puntos: 1,
      activo: true,
      vigencia_hasta: beneficio.tipo === "membresia" ? "2027-11-11" : null,
    });
  }),
}));

import { sembrarRecompensa } from "@/lib/lealtad/sembrar-recompensa";
import { POST } from "./route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const OTRO_RANCHO = "22222222-2222-4222-8222-222222222222";
const PRINCIPAL = "33333333-3333-4333-8333-333333333333";
const INTENTO = "44444444-4444-4444-8444-444444444444";
const MATCHA_RANCHO = "55555555-5555-4555-8555-555555555555";
const MATCHA = "66666666-6666-4666-8666-666666666666";
const CF = "https://imagedelivery.net/hash/logo-bookea/gallery";

const EQUIPO_1 = {
  tipo: "membresia",
  nivel: "Equipo 1",
  beneficios: ["10 % de descuento"],
  porcentaje: 10,
  vigenciaMeses: 12,
  renovacionAutomatica: true,
};
const PUNTOS = { tipo: "puntos", nombre: "puntos", porMoneda: 1, porVisita: 0, inicial: 0, minimoCanje: 1, maximo: null };

function cuerpo(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rancho_id: RANCHO,
    programa_id: PRINCIPAL,
    nombre: "Equipo 1",
    intento_id: INTENTO,
    tarjeta: { modo: "membresia", beneficio: EQUIPO_1 },
    ...extra,
  };
}

async function crear(datos: Record<string, unknown>, secreto = SECRETO) {
  const texto = JSON.stringify(datos);
  const t = Date.now();
  const v1 = createHmac("sha256", secreto).update(`${t}.${texto}`).digest("hex");
  const r = await POST(
    new Request("https://www.bookea.lat/api/plataforma/foorkie/programa/crear", {
      method: "POST",
      headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
      body: texto,
    }),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

const creada = () => (tablas.programa_lealtad ?? []).find((f) => f.id === INTENTO);

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  escrituras = [];
  vi.mocked(sembrarRecompensa).mockClear();
  tablas = {
    foorkie_restaurantes: [
      { id: "local-tostado", moneda: "USD", bookea_rancho_id: RANCHO, bookea_programa_id: PRINCIPAL, lealtad_por_foorkie: true },
      { id: "local-matcha", moneda: "CRC", bookea_rancho_id: MATCHA_RANCHO, bookea_programa_id: MATCHA, lealtad_por_foorkie: false },
    ],
    ranchos: [
      { id: RANCHO, plan_lealtad: "impulso" },
      { id: MATCHA_RANCHO, plan_lealtad: "impulso" },
    ],
    programa_lealtad: [
      {
        id: PRINCIPAL,
        rancho_id: RANCHO,
        nombre: "Tarjeta de puntos",
        modo: "puntos",
        pase_color_fondo: "#1A1410",
        pase_color_sello: "#C8A27A",
        pase_logo_url: CF,
        pase_banner_url: null,
      },
      { id: MATCHA, rancho_id: MATCHA_RANCHO, nombre: "Matcha", modo: "sellos" },
    ],
    recompensas: [],
  };
});

describe("programa/crear: otra tarjeta en el negocio de un local de Foorkie", () => {
  it("la de socio de un equipo: nace en el MISMO negocio, con id = intento_id y la marca de la principal", async () => {
    expect(await crear(cuerpo())).toEqual({ status: 200, cuerpo: { ok: true, programa_id: INTENTO, ya_estaba: false } });
    expect(creada()).toMatchObject({
      id: INTENTO,
      rancho_id: RANCHO,
      nombre: "Equipo 1",
      modo: "membresia",
      beneficio: EQUIPO_1,
      pase_color_fondo: "#1A1410",
      pase_color_sello: "#C8A27A",
      pase_logo_url: CF,
      activo: true,
      estado: "activo",
      // Presentar la tarjeta es UNO (el derecho de uso), como en el mostrador.
      puntos_por_visita: 1,
      puntos_por_colon: 0,
    });
    expect(vi.mocked(sembrarRecompensa).mock.calls[0]?.[1]).toBe(INTENTO);
  });

  it("con renovación automática, el beneficio del socio nace SIN vencimiento", async () => {
    await crear(cuerpo());
    expect(tablas.recompensas.find((r) => r.programa_id === INTENTO)?.vigencia_hasta).toBeNull();
    expect(escrituras.filter((e) => e.op === "update")).toEqual([
      { op: "update", tabla: "recompensas", fila: { vigencia_hasta: null }, donde: [["programa_id", INTENTO]] },
    ]);
  });

  it("sin renovación automática, la vigencia que sembró el alta se respeta", async () => {
    await crear(cuerpo({ tarjeta: { modo: "membresia", beneficio: { ...EQUIPO_1, renovacionAutomatica: false } } }));
    expect(tablas.recompensas.find((r) => r.programa_id === INTENTO)?.vigencia_hasta).toBe("2027-11-11");
    expect(escrituras.filter((e) => e.op === "update")).toEqual([]);
  });

  it("una de puntos, con sus colores propios", async () => {
    const r = await crear(cuerpo({ nombre: "Puntos extra", tarjeta: { modo: "puntos", beneficio: PUNTOS, colorFondo: "#000000" } }));
    expect(r.status).toBe(200);
    expect(creada()).toMatchObject({ modo: "puntos", pase_color_fondo: "#000000", pase_color_sello: "#C8A27A", puntos_por_visita: 0, puntos_por_colon: 1 });
  });

  it("un reintento del mismo intento no crea otra: `ya_estaba`", async () => {
    await crear(cuerpo());
    vi.mocked(sembrarRecompensa).mockClear();
    escrituras = [];
    expect(await crear(cuerpo())).toEqual({ status: 200, cuerpo: { ok: true, programa_id: INTENTO, ya_estaba: true } });
    expect(escrituras).toEqual([]);
    expect(sembrarRecompensa).not.toHaveBeenCalled();
    expect(tablas.programa_lealtad.filter((f) => f.id === INTENTO)).toHaveLength(1);
  });

  it("un intento_id que ya es una tarjeta de otro negocio: 400 y no se toca nada", async () => {
    tablas.programa_lealtad.push({ id: INTENTO, rancho_id: OTRO_RANCHO, nombre: "Otra" });
    expect(await crear(cuerpo())).toMatchObject({ status: 400, cuerpo: { ok: false, codigo: "datos" } });
    expect(escrituras).toEqual([]);
  });
});

describe("programa/crear: la puerta", () => {
  it("una firma mala es 401", async () => {
    expect(await crear(cuerpo(), "otro-secreto")).toMatchObject({ status: 401 });
  });

  it("sin la marca de Foorkie (Pura Matcha): 403 no_es_de_foorkie, sin escribir", async () => {
    const r = await crear(cuerpo({ rancho_id: MATCHA_RANCHO, programa_id: MATCHA }));
    expect(r).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_es_de_foorkie" } });
    expect(escrituras).toEqual([]);
  });

  it("el par negocio + tarjeta tiene que coincidir: 403", async () => {
    expect(await crear(cuerpo({ rancho_id: OTRO_RANCHO }))).toMatchObject({ status: 403, cuerpo: { codigo: "no_es_de_foorkie" } });
  });

  it("una tarjeta extra no sirve de ancla: solo la principal (la de la columna de siempre)", async () => {
    tablas.programa_lealtad.push({ id: "77777777-7777-4777-8777-777777777777", rancho_id: RANCHO, nombre: "Equipo 2" });
    const r = await crear(cuerpo({ programa_id: "77777777-7777-4777-8777-777777777777" }));
    expect(r).toMatchObject({ status: 403, cuerpo: { codigo: "no_es_de_foorkie" } });
  });

  it("los datos: sin intento, nombre vacío o de más de 40, sin tipo, tipo que no existe, beneficio de otro tipo", async () => {
    expect(await crear(cuerpo({ intento_id: "no" }))).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    expect(await crear(cuerpo({ nombre: "  " }))).toMatchObject({ status: 400 });
    expect(await crear(cuerpo({ nombre: "x".repeat(41) }))).toMatchObject({ status: 400 });
    expect(await crear(cuerpo({ tarjeta: { beneficio: EQUIPO_1 } }))).toMatchObject({ status: 400 });
    expect(await crear(cuerpo({ tarjeta: { modo: "trueque", beneficio: EQUIPO_1 } }))).toMatchObject({
      status: 400,
      cuerpo: { motivo: "Ese tipo de tarjeta no existe." },
    });
    expect(await crear(cuerpo({ tarjeta: { modo: "puntos", beneficio: EQUIPO_1 } }))).toMatchObject({
      status: 400,
      cuerpo: { motivo: "La configuración no corresponde a ese tipo de tarjeta." },
    });
    expect(await crear(cuerpo({ tarjeta: { modo: "membresia", beneficio: { ...EQUIPO_1, porcentaje: 150 } } }))).toMatchObject({
      status: 400,
      cuerpo: { motivo: "El descuento del socio va de 1 a 100." },
    });
    expect(escrituras).toEqual([]);
  });

  it("un paquete con tope de tarjetas se respeta (hoy ningún negocio de Foorkie lo tiene)", async () => {
    tablas.ranchos[0].plan_lealtad = "prueba";
    const r = await crear(cuerpo({ tarjeta: { modo: "puntos", beneficio: PUNTOS } }));
    expect(r).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    expect(String(r.cuerpo.motivo)).toMatch(/permite 1 tarjeta/);
    expect(escrituras).toEqual([]);
  });
});
