import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/programa/ubicaciones (+ /guardar), de punta
 * a punta: la firma de verdad, la puerta del panel de verdad
 * (`abrirElPanel`), la guardia de la marca de verdad
 * (`localDeFoorkieDeLaTarjeta`), contra una base de mentira que aplica
 * los filtros, el orden, los `insert` y los `delete`.
 *
 * Lo que se fija: que guardar reemplaza las del negocio y refresca los
 * pases DESPUÉS de responder, que mandar lo mismo no escribe ni refresca,
 * y LA GUARDIA — con la marca `lealtad_por_foorkie` sí; vinculada sin la
 * marca (Pura Matcha), 403 y su negocio no se toca.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let escrituras: { tabla: string; op: "insert" | "delete" }[] = [];
let reloj = 0;

/** Una consulta encadenable que aplica `eq`/`in`, `order` y `limit`, y los `insert`/`delete`. */
function consulta(tabla: string) {
  let op: "select" | "insert" | "delete" = "select";
  let nuevas: Fila[] = [];
  const filtros: [string, "eq" | "in", unknown][] = [];
  const orden: string[] = [];
  let unico = false;
  let limite: number | null = null;
  const pasa = (f: Fila) => filtros.every(([c, t, v]) => (t === "eq" ? f[c] === v : (v as unknown[]).includes(f[c])));
  const b = {
    select: () => b,
    insert: (v: Fila | Fila[]) => {
      op = "insert";
      nuevas = Array.isArray(v) ? v : [v];
      return b;
    },
    delete: () => {
      op = "delete";
      return b;
    },
    eq: (c: string, v: unknown) => {
      filtros.push([c, "eq", v]);
      return b;
    },
    in: (c: string, v: unknown[]) => {
      filtros.push([c, "in", v]);
      return b;
    },
    order: (c: string) => {
      orden.push(c);
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
          const lista = (tablas[tabla] ??= []);
          if (op === "insert") {
            escrituras.push({ tabla, op });
            for (const v of nuevas) {
              reloj += 1;
              lista.push({ id: `nueva-${reloj}`, created_at: new Date(Date.UTC(2026, 9, 2, 12, 0, reloj)).toISOString(), ...v });
            }
            return { data: null, error: null };
          }
          if (op === "delete") {
            escrituras.push({ tabla, op });
            tablas[tabla] = lista.filter((f) => !pasa(f));
            return { data: null, error: null };
          }
          let filas = lista.filter(pasa);
          for (const c of [...orden].reverse()) filas = [...filas].sort((x, y) => String(x[c]).localeCompare(String(y[c])));
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
const OTRA_TARJETA = "33333333-3333-4333-8333-333333333333";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

const CENTRO = { latitud: 10.016, longitud: -84.214, mensaje: "Estás cerca de Donde George · Centro · mostrá tu tarjeta", nombre: "Donde George · Centro" };
const PATIO = { latitud: 10.02, longitud: -84.2, mensaje: "Estás cerca de Donde George · El Patio · mostrá tu tarjeta", nombre: "Donde George · El Patio" };

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

async function pedir(ruta: "programa/ubicaciones" | "programa/ubicaciones/guardar", cuerpo: Record<string, unknown>, secreto?: string) {
  const r = await (ruta === "programa/ubicaciones" ? leer : guardar)(firmado(ruta, cuerpo, secreto));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

/** Un local de Foorkie; `marca` = `lealtad_por_foorkie`. */
const local = (slug: string, programa: string, marca: boolean): Fila => ({
  id: `local-${slug}`,
  slug,
  activo: true,
  estado_publicacion: "aprobado",
  created_at: "2026-09-01T10:00:00Z",
  bookea_rancho_id: RANCHO,
  bookea_programa_id: programa,
  lealtad_por_foorkie: marca,
});

function escenario({ marca = true, otraDeBookea = false }: { marca?: boolean; otraDeBookea?: boolean } = {}) {
  tablas = {
    foorkie_restaurantes: [local(marca ? "donde-george" : "pura-matcha", PROGRAMA, marca)],
    ranchos: [{ id: RANCHO, owner_id: "dueno-1", nombre: "Donde George" }],
    programa_lealtad: [
      { id: PROGRAMA, rancho_id: RANCHO, modo: "cashback", estado: "activo", activo: true },
      ...(otraDeBookea ? [{ id: OTRA_TARJETA, rancho_id: RANCHO, modo: "sellos", estado: "activo", activo: true }] : []),
    ],
    lealtad_ubicaciones: [{ id: "vieja-1", rancho_id: RANCHO, created_at: "2026-10-01T12:00:00Z", ...CENTRO }],
  };
}

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  escrituras = [];
  despues = [];
  reloj = 0;
  vi.mocked(avisarCambioDeDiseno).mockClear();
  escenario();
});

/** Corre lo que la ruta dejó en `after()`, como Next después de responder. */
async function correrLoDeDespues() {
  for (const fn of despues.splice(0)) await fn();
}

describe("programa/ubicaciones — leer", () => {
  it("las del negocio de la tarjeta", async () => {
    expect(await pedir("programa/ubicaciones", vinculo)).toEqual({ status: 200, cuerpo: { ok: true, ubicaciones: [CENTRO] } });
  });

  it("un negocio sin ninguna: la lista vacía", async () => {
    tablas.lealtad_ubicaciones = [];
    expect(await pedir("programa/ubicaciones", vinculo)).toEqual({ status: 200, cuerpo: { ok: true, ubicaciones: [] } });
  });

  it("vinculada SIN la marca (como Pura Matcha): 403 no_es_de_foorkie", async () => {
    escenario({ marca: false });
    expect(await pedir("programa/ubicaciones", vinculo)).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_es_de_foorkie" } });
  });

  it("la misma puerta del panel: 400, 401 y 403 no_vinculado", async () => {
    expect(await pedir("programa/ubicaciones", { rancho_id: "no-es-uuid", programa_id: PROGRAMA })).toMatchObject({
      status: 400,
      cuerpo: { codigo: "datos" },
    });
    expect(await pedir("programa/ubicaciones", vinculo, "otra-llave")).toMatchObject({ status: 401, cuerpo: { codigo: "firma" } });
    tablas.foorkie_restaurantes = [];
    expect(await pedir("programa/ubicaciones", vinculo)).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
  });
});

describe("programa/ubicaciones/guardar", () => {
  it("reemplaza las del negocio, devuelve cómo quedaron y lo que se guarda es lo que se lee", async () => {
    const r = await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: [CENTRO, { ...PATIO, latitud: 10.0200004 }] });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, cambio: true, ubicaciones: [CENTRO, PATIO] } });
    // El Centro ya estaba igual: solo se insertó El Patio.
    expect(escrituras).toEqual([{ tabla: "lealtad_ubicaciones", op: "insert" }]);
    expect(await pedir("programa/ubicaciones", vinculo)).toEqual({ status: 200, cuerpo: { ok: true, ubicaciones: [CENTRO, PATIO] } });
  });

  it("si algo cambió, DESPUÉS de responder refresca en silencio los pases (como un cambio de diseño)", async () => {
    await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: [PATIO] });
    // Nada antes de responder.
    expect(avisarCambioDeDiseno).not.toHaveBeenCalled();
    await correrLoDeDespues();
    expect(vi.mocked(avisarCambioDeDiseno).mock.calls).toEqual([[PROGRAMA]]);
  });

  it("lo mismo que ya estaba: no escribe ni refresca nada", async () => {
    const r = await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: [CENTRO] });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, cambio: false, ubicaciones: [CENTRO] } });
    expect(escrituras).toHaveLength(0);
    expect(despues).toHaveLength(0);
  });

  it("una lista vacía las saca todas", async () => {
    expect(await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: [] })).toEqual({
      status: 200,
      cuerpo: { ok: true, cambio: true, ubicaciones: [] },
    });
    expect(tablas.lealtad_ubicaciones).toEqual([]);
  });

  it("lo que no tiene la forma rebota con su motivo, sin escribir nada", async () => {
    expect(
      await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: [{ ...CENTRO, mensaje: "x".repeat(81) }] }),
    ).toEqual({
      status: 400,
      cuerpo: {
        ok: false,
        codigo: "datos",
        motivo: "El mensaje de la ubicación 1 puede tener hasta 80 caracteres: en la pantalla bloqueada no entra más.",
      },
    });
    expect(await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: [{ ...CENTRO, latitud: 91 }] })).toMatchObject({
      status: 400,
    });
    expect(await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: Array(11).fill(CENTRO) })).toMatchObject({
      status: 400,
    });
    expect(await pedir("programa/ubicaciones/guardar", vinculo)).toMatchObject({ status: 400 });
    expect(escrituras).toHaveLength(0);
  });

  it("vinculada SIN la marca (Pura Matcha): 403 y su negocio no se toca", async () => {
    escenario({ marca: false });
    const r = await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: [] });
    expect(r).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_es_de_foorkie" } });
    expect(escrituras).toHaveLength(0);
    expect(despues).toHaveLength(0);
    expect(tablas.lealtad_ubicaciones).toHaveLength(1);
  });

  it("si el negocio tiene otra tarjeta que no es de Foorkie: 409 negocio_compartido, sin escribir", async () => {
    escenario({ otraDeBookea: true });
    const r = await pedir("programa/ubicaciones/guardar", { ...vinculo, ubicaciones: [PATIO] });
    expect(r).toMatchObject({ status: 409, cuerpo: { ok: false, codigo: "negocio_compartido" } });
    expect(escrituras).toHaveLength(0);
    expect(despues).toHaveLength(0);
  });
});
