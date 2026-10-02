import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/programa/mensajes (+ /guardar), de punta a
 * punta: la firma de verdad, la puerta del panel de verdad
 * (`abrirElPanel`), la guardia de la marca de verdad
 * (`localDeFoorkieDeLaTarjeta`), contra una base de mentira que aplica
 * los filtros de cada consulta y los `update`.
 *
 * Lo que se fija: los de fábrica, que guardar no pisa el resto de la
 * configuración de la tarjeta, y LA GUARDIA — con la marca
 * `lealtad_por_foorkie` sí; vinculada sin la marca (Pura Matcha), 403 y
 * su fila no se toca.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let escrituras: { tabla: string; valores: Fila }[] = [];

/** Una consulta encadenable que aplica `eq` (y `limit`) a las filas de su tabla, y los `update`. */
function consulta(tabla: string) {
  const eqs: [string, unknown][] = [];
  let valores: Fila | null = null;
  let unico = false;
  let limite: number | null = null;
  const b = {
    select: () => b,
    update: (v: Fila) => {
      valores = v;
      return b;
    },
    eq: (col: string, val: unknown) => {
      eqs.push([col, val]);
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
          const filas = (tablas[tabla] ?? []).filter((f) => eqs.every(([c, v]) => f[c] === v));
          if (valores) {
            escrituras.push({ tabla, valores });
            for (const f of filas) Object.assign(f, valores);
            return { data: null, error: null };
          }
          const vistas = (limite === null ? filas : filas.slice(0, limite)).map((f) => structuredClone(f));
          return { data: unico ? (vistas[0] ?? null) : vistas, error: null };
        })
        .then(ok, mal),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => consulta(t) }) }));

// `after` de verdad necesita el contexto de una petición de Next: acá se
// anota lo que se dejó para después y la prueba decide cuándo correrlo.
let despues: (() => unknown)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    despues.push(fn);
  },
}));
vi.mock("@/lib/wallet/aviso-de-diseno", () => ({ avisarCambioDeDiseno: vi.fn(async () => null) }));

import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";
import { POST as leer } from "./route";
import { POST as guardar } from "./guardar/route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

const DE_FABRICA = {
  sumar: { activo: true, texto: "¡Gracias por preferirnos!" },
  quitar: { activo: true, texto: "Tu tarjeta se modificó." },
  canjear: { activo: true, texto: "¡Gracias! Disfrutá tu premio." },
};

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

async function pedir(ruta: "programa/mensajes" | "programa/mensajes/guardar", cuerpo: Record<string, unknown>, secreto?: string) {
  const r = await (ruta === "programa/mensajes" ? leer : guardar)(firmado(ruta, cuerpo, secreto));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

/** El local de Foorkie de esta tarjeta; `marca` = `lealtad_por_foorkie`. */
const local = (marca: boolean): Fila => ({
  id: "local-1",
  slug: marca ? "donde-george" : "pura-matcha",
  activo: true,
  estado_publicacion: "aprobado",
  created_at: "2026-09-01T10:00:00Z",
  bookea_rancho_id: RANCHO,
  bookea_programa_id: PROGRAMA,
  lealtad_por_foorkie: marca,
});

function escenario({ marca = true, conColumna = true }: { marca?: boolean; conColumna?: boolean } = {}) {
  const programa: Fila = { id: PROGRAMA, rancho_id: RANCHO, nombre: "Tarjeta", modo: "cashback", estado: "activo", activo: true };
  if (conColumna) programa.configuracion = { ritmo_clientes: "quincenal" };
  tablas = {
    foorkie_restaurantes: [local(marca)],
    ranchos: [{ id: RANCHO, owner_id: "dueno-1", nombre: "Donde George" }],
    programa_lealtad: [programa],
  };
}

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  escrituras = [];
  despues = [];
  vi.mocked(avisarCambioDeDiseno).mockClear();
  escenario();
});

/** Corre lo que la ruta dejó en `after()`, como Next después de responder. */
async function correrLoDeDespues() {
  for (const fn of despues.splice(0)) await fn();
}

describe("programa/mensajes — leer", () => {
  it("mientras el restaurante no guarde nada: los tres de fábrica, activos", async () => {
    expect(await pedir("programa/mensajes", vinculo)).toEqual({ status: 200, cuerpo: { ok: true, mensajes: DE_FABRICA } });
  });

  it("sin la migración 0251 también: leer no la necesita", async () => {
    escenario({ conColumna: false });
    expect(await pedir("programa/mensajes", vinculo)).toEqual({ status: 200, cuerpo: { ok: true, mensajes: DE_FABRICA } });
  });

  it("vinculada SIN la marca (como Pura Matcha): 403 no_es_de_foorkie", async () => {
    escenario({ marca: false });
    expect(await pedir("programa/mensajes", vinculo)).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_es_de_foorkie" } });
  });

  it("la misma puerta del panel: 400, 401 y 403 no_vinculado", async () => {
    expect(await pedir("programa/mensajes", { rancho_id: "no-es-uuid", programa_id: PROGRAMA })).toMatchObject({
      status: 400,
      cuerpo: { codigo: "datos" },
    });
    expect(await pedir("programa/mensajes", vinculo, "otra-llave")).toMatchObject({ status: 401, cuerpo: { codigo: "firma" } });
    tablas.foorkie_restaurantes = [];
    expect(await pedir("programa/mensajes", vinculo)).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
  });
});

describe("programa/mensajes/guardar", () => {
  it("guarda lo que cambia, devuelve los tres y no pisa el resto de la configuración", async () => {
    const r = await pedir("programa/mensajes/guardar", {
      ...vinculo,
      mensajes: { sumar: { texto: "  ¡Gracias por venir,\nvolvé pronto!  " }, quitar: { activo: false } },
    });
    const esperados = {
      sumar: { activo: true, texto: "¡Gracias por venir, volvé pronto!" },
      quitar: { activo: false, texto: "Tu tarjeta se modificó." },
      canjear: DE_FABRICA.canjear,
    };
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, mensajes: esperados } });
    expect(tablas.programa_lealtad[0].configuracion).toEqual({ ritmo_clientes: "quincenal", mensajes_automaticos: esperados });
    // Lo que se guarda es lo que se lee.
    expect(await pedir("programa/mensajes", vinculo)).toEqual({ status: 200, cuerpo: { ok: true, mensajes: esperados } });
  });

  it("si algo cambió, DESPUÉS de responder refresca en silencio los pases de esa tarjeta (como un cambio de diseño)", async () => {
    await pedir("programa/mensajes/guardar", { ...vinculo, mensajes: { canjear: { activo: false } } });
    // Nada antes de responder.
    expect(avisarCambioDeDiseno).not.toHaveBeenCalled();
    await correrLoDeDespues();
    expect(vi.mocked(avisarCambioDeDiseno).mock.calls).toEqual([[PROGRAMA]]);
  });

  it("sin cambios de verdad no escribe ni refresca nada", async () => {
    const r = await pedir("programa/mensajes/guardar", { ...vinculo, mensajes: { sumar: { activo: true } } });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, mensajes: DE_FABRICA } });
    expect(escrituras).toHaveLength(0);
    expect(despues).toHaveLength(0);
  });

  it("lo que no tiene la forma rebota con su motivo, sin escribir nada", async () => {
    expect(await pedir("programa/mensajes/guardar", { ...vinculo, mensajes: { sumar: { texto: "x".repeat(121) } } })).toEqual({
      status: 400,
      cuerpo: {
        ok: false,
        codigo: "datos",
        motivo: "El mensaje al sumar puede tener hasta 120 caracteres: en la tarjeta no entra más.",
      },
    });
    expect(await pedir("programa/mensajes/guardar", { ...vinculo, mensajes: { acreditar: { activo: false } } })).toMatchObject({
      status: 400,
    });
    expect(await pedir("programa/mensajes/guardar", vinculo)).toMatchObject({ status: 400 });
    expect(escrituras).toHaveLength(0);
  });

  it("vinculada SIN la marca (Pura Matcha): 403 y su tarjeta no se toca", async () => {
    escenario({ marca: false });
    const r = await pedir("programa/mensajes/guardar", { ...vinculo, mensajes: { sumar: { activo: false } } });
    expect(r).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_es_de_foorkie" } });
    expect(escrituras).toHaveLength(0);
    expect(despues).toHaveLength(0);
    expect(tablas.programa_lealtad[0].configuracion).toEqual({ ritmo_clientes: "quincenal" });
  });

  it("sin la migración 0251: 503 sin_migracion, sin intentar escribir", async () => {
    escenario({ conColumna: false });
    const r = await pedir("programa/mensajes/guardar", { ...vinculo, mensajes: { sumar: { activo: false } } });
    expect(r).toMatchObject({ status: 503, cuerpo: { ok: false, codigo: "sin_migracion" } });
    expect(escrituras).toHaveLength(0);
    expect(despues).toHaveLength(0);
  });
});
