import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/programa/reglas (+ /guardar), de punta a
 * punta: la firma de verdad, la puerta de la caja de verdad
 * (`abrirLaCaja`), la guardia de la marca de verdad
 * (`localDeFoorkieDeLaTarjeta`), contra una base de mentira que aplica los
 * filtros de cada consulta y los `update`.
 *
 * Lo que se fija: que se lee lo que el motor aplica, que guardar escribe
 * SOLO lo que cambió y refresca los pases SOLO si cambió algo, y la
 * guardia — sin la marca `lealtad_por_foorkie` (Pura Matcha), 403 y su
 * fila no se toca.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let escrituras: { tabla: string; valores: Fila }[] = [];

function consulta(tabla: string) {
  const eqs: [string, unknown][] = [];
  let valores: Fila | null = null;
  let unico = false;
  let limite: number | null = null;
  let contar = false;
  const b = {
    select: (_c?: string, o?: { count?: string }) => {
      if (o?.count) contar = true;
      return b;
    },
    update: (v: Fila) => {
      valores = v;
      return b;
    },
    eq: (col: string, val: unknown) => {
      eqs.push([col, val]);
      return b;
    },
    order: () => b,
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
          if (contar) return { count: filas.length, data: null, error: null };
          const vistas = (limite === null ? filas : filas.slice(0, limite)).map((f) => structuredClone(f));
          return { data: unico ? (vistas[0] ?? null) : vistas, error: null };
        })
        .then(ok, mal),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => consulta(t) }) }));

let despues: (() => unknown)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    despues.push(fn);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/wallet/aviso-de-diseno", () => ({ avisarCambioDeDiseno: vi.fn(async () => null) }));

import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";
import { POST as leer } from "./route";
import { POST as guardar } from "./guardar/route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

function firmado(ruta: string, cuerpo: Record<string, unknown>): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", SECRETO).update(`${t}.${texto}`).digest("hex");
  return new Request(`https://www.bookea.lat/api/plataforma/foorkie/${ruta}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

async function json(r: Response) {
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  escrituras = [];
  despues = [];
  vi.mocked(avisarCambioDeDiseno).mockClear();
  tablas = {
    foorkie_restaurantes: [
      { id: "local-1", slug: "donde-george", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: true, activo: true, estado_publicacion: "aprobado" },
    ],
    ranchos: [{ id: RANCHO, owner_id: "dueno-1", nombre: "Donde George" }],
    programa_lealtad: [
      {
        id: PROGRAMA,
        rancho_id: RANCHO,
        modo: "cashback",
        estado: "activo",
        activo: true,
        puntos_por_colon: 0.05,
        compra_minima: null,
        max_por_transaccion: null,
        sellos_vencen_meses: null,
        sellos_vencen_desde: null,
        beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, canjeLibre: true },
      },
    ],
    recompensas: [],
    miembros: [{ id: "m-1", programa_id: PROGRAMA }],
  };
});

describe("programa/reglas", () => {
  it("las reglas del cashback como se aplican hoy", async () => {
    expect(await json(await leer(firmado("programa/reglas", vinculo)))).toEqual({
      status: 200,
      cuerpo: {
        ok: true,
        reglas: {
          tipo: "cashback",
          cashback: { porcentaje: 5, compraMinima: null, topePorCompra: null, minimoCanje: null, canjeLibre: true },
          sellos: null,
          vencimiento: { meses: null, desde: null, diasDeAviso: 14 },
        },
      },
    });
  });

  it("sin la marca de Foorkie (Pura Matcha): 403 y nada más", async () => {
    tablas.foorkie_restaurantes[0].lealtad_por_foorkie = false;
    expect(await json(await leer(firmado("programa/reglas", vinculo)))).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_es_de_foorkie" } });
    const g = await json(await guardar(firmado("programa/reglas/guardar", { ...vinculo, reglas: { vencimiento: { meses: 6 } } })));
    expect(g).toMatchObject({ status: 403, cuerpo: { codigo: "no_es_de_foorkie" } });
    expect(escrituras).toEqual([]);
  });
});

describe("programa/reglas/guardar", () => {
  it("guarda lo que cambió, devuelve cómo quedó y refresca los pases después de responder", async () => {
    const r = await json(
      await guardar(firmado("programa/reglas/guardar", { ...vinculo, reglas: { cashback: { minimoCanje: 1000, compraMinima: 2000 }, vencimiento: { meses: 6 } } })),
    );
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({
      ok: true,
      cambio: true,
      reglas: { cashback: { compraMinima: 2000, minimoCanje: 1000, canjeLibre: true }, vencimiento: { meses: 6 } },
    });
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].valores).toMatchObject({ compra_minima: 2000, sellos_vencen_meses: 6 });
    expect(avisarCambioDeDiseno).not.toHaveBeenCalled();
    await Promise.all(despues.map((f) => f()));
    expect(avisarCambioDeDiseno).toHaveBeenCalledWith(PROGRAMA);
  });

  it("lo mismo dos veces: no escribe ni refresca", async () => {
    const cuerpo = { ...vinculo, reglas: { vencimiento: { meses: 6 } } };
    await guardar(firmado("programa/reglas/guardar", cuerpo));
    escrituras = [];
    despues = [];
    const otra = await json(await guardar(firmado("programa/reglas/guardar", cuerpo)));
    expect(otra.cuerpo).toMatchObject({ ok: true, cambio: false });
    expect(escrituras).toEqual([]);
    expect(despues).toEqual([]);
  });

  it("una regla fuera de rango o de otro tipo: 400 sin tocar nada", async () => {
    expect(await json(await guardar(firmado("programa/reglas/guardar", { ...vinculo, reglas: { cashback: { topePorCompra: 500_000 } } })))).toMatchObject({
      status: 400,
      cuerpo: { codigo: "datos" },
    });
    expect(await json(await guardar(firmado("programa/reglas/guardar", { ...vinculo, reglas: { sellos: { inicial: 2 } } })))).toMatchObject({
      status: 400,
      cuerpo: { codigo: "datos" },
    });
    expect(escrituras).toEqual([]);
  });
});
