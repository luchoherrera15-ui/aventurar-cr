import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/caja/buscar CON `miembro_id`, de punta a
 * punta: la firma de verdad, la puerta de verdad (`abrirLaCaja`), el
 * vínculo con Foorkie y la tarjeta del cliente, contra una base de
 * mentira que aplica los filtros de cada consulta.
 *
 * Pedido del dueño: «con solo colocar el nombre, que salgan las opciones
 * disponibles». Foorkie sugiere por nombre (`clientes`) y pide la tarjeta
 * del elegido por su id. Lo que se fija: que contesta EXACTAMENTE lo
 * mismo que por correo, y que un id de otra tarjeta no delata nada.
 */

vi.mock("@/lib/lealtad/identidades-db", () => ({
  miembrosConIdentidad: async () => [],
  identidadesDeMiembros: async (_db: unknown, miembros: { id: string }[]) =>
    new Map(miembros.map((m) => [m.id, { nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: "88887777" }])),
}));

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};

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

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => consulta(t) }) }));

import { POST } from "./route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const PERSONA = "44444444-4444-4444-8444-444444444444";
const OTRA_TARJETA = "55555555-5555-4555-8555-555555555555";
const DE_OTRA = "66666666-6666-4666-8666-666666666666";
const DE_BAJA = "77777777-7777-4777-8777-777777777777";
const NADIE = "88888888-8888-4888-8888-888888888888";
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

function firmado(cuerpo: Record<string, unknown>, secreto = SECRETO): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", secreto).update(`${t}.${texto}`).digest("hex");
  return new Request("https://www.bookea.lat/api/plataforma/foorkie/caja/buscar", {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

async function buscar(cuerpo: Record<string, unknown>, secreto?: string) {
  const r = await POST(firmado(cuerpo, secreto));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  tablas = {
    foorkie_restaurantes: [
      { id: "local-1", slug: "donde-george", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: true },
    ],
    ranchos: [{ id: RANCHO, owner_id: "dueno-1", nombre: "Donde George" }],
    programa_lealtad: [
      { id: PROGRAMA, rancho_id: RANCHO, nombre: "Tarjeta", modo: "sellos", estado: "activo", activo: true },
      { id: OTRA_TARJETA, rancho_id: RANCHO, nombre: "La otra", modo: "sellos", estado: "activo", activo: true },
    ],
    miembros: [
      { id: MIEMBRO, programa_id: PROGRAMA, persona_id: PERSONA, cliente_id: null, estado: "activa", created_at: "2026-09-01T10:00:00Z" },
      { id: DE_OTRA, programa_id: OTRA_TARJETA, persona_id: null, cliente_id: null, estado: "activa" },
      { id: DE_BAJA, programa_id: PROGRAMA, persona_id: null, cliente_id: null, estado: "cancelada" },
    ],
    personas: [{ id: PERSONA, correo: "ana.solis@gmail.com" }],
    personas_negocio: [],
    recompensas: [{ id: "rc-1", programa_id: PROGRAMA, nombre: "Un café gratis", costo_puntos: 10, activo: true }],
    transacciones_puntos: [
      { miembro_id: MIEMBRO, puntos: 3 },
      { miembro_id: MIEMBRO, puntos: 2 },
    ],
  };
});

describe("caja/buscar por miembro_id", () => {
  it("encuentra al cliente de ESTA tarjeta, con nombre de pila y correo enmascarado", async () => {
    const r = await buscar({ ...vinculo, miembro_id: MIEMBRO });
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({
      ok: true,
      cliente: {
        miembro_id: MIEMBRO,
        nombre: "Ana",
        correo: "a***@gmail.com",
        tipo: "sellos",
        saldo: 5,
        pausada: false,
        progreso: { actual: 5, total: 10 },
        recompensas: [{ id: "rc-1", nombre: "Un café gratis", costo: 10, alcanza: false }],
      },
    });
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/ana\.solis@|88887777/);
  });

  it("contesta EXACTAMENTE lo mismo que buscarlo por su correo", async () => {
    const porId = await buscar({ ...vinculo, miembro_id: MIEMBRO });
    const porCorreo = await buscar({ ...vinculo, correo: "Ana.Solis@gmail.com" });
    expect(porId).toEqual(porCorreo);
  });

  it("un id de OTRA tarjeta (aunque sea del mismo negocio) es «no encontrado», igual que uno que no existe", async () => {
    const deOtra = await buscar({ ...vinculo, miembro_id: DE_OTRA });
    const inexistente = await buscar({ ...vinculo, miembro_id: NADIE });
    expect(deOtra).toEqual({
      status: 200,
      cuerpo: { ok: false, codigo: "no_encontrado", motivo: "Ese cliente no tiene esta tarjeta de lealtad." },
    });
    expect(inexistente).toEqual(deOtra);
  });

  it("una membresía dada de baja no se atiende", async () => {
    expect(await buscar({ ...vinculo, miembro_id: DE_BAJA })).toMatchObject({
      status: 200,
      cuerpo: { ok: false, codigo: "no_encontrado" },
    });
  });

  it("un id que no es uuid, o junto con el correo o el código: 400 sin tocar la base", async () => {
    tablas = {};
    expect(await buscar({ ...vinculo, miembro_id: "ana" })).toMatchObject({ status: 400, cuerpo: { ok: false, codigo: "datos" } });
    expect(await buscar({ ...vinculo, miembro_id: MIEMBRO, correo: "ana.solis@gmail.com" })).toMatchObject({ status: 400 });
    expect(await buscar({ ...vinculo, miembro_id: MIEMBRO, codigo: MIEMBRO })).toMatchObject({ status: 400 });
  });

  it("la misma puerta de siempre: firma ajena 401, tarjeta sin vínculo con Foorkie 403", async () => {
    expect(await buscar({ ...vinculo, miembro_id: MIEMBRO }, "otra-llave")).toMatchObject({ status: 401, cuerpo: { codigo: "firma" } });
    tablas.foorkie_restaurantes = [];
    expect(await buscar({ ...vinculo, miembro_id: MIEMBRO })).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
  });
});
