import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/programa, de punta a punta: la firma de
 * verdad, el vínculo con Foorkie de verdad y la `vista` del pase
 * (`foorkie-vista.ts`), contra una base de mentira que aplica los filtros.
 *
 * Lo que se fija: la vista viaja junto a lo de siempre (campo nuevo: lo
 * demás no cambia), es la tarjeta de quien recién se une (saldo 0, los
 * mismos textos que `textos`), lleva la geometría y el dibujo del sello
 * de la fila, y bajo el QR dice lo que dice SU pase: «Foorkie Lealtad»
 * solo con la marca `lealtad_por_foorkie`; vinculada sin la marca (Pura
 * Matcha), lo de Bookea. Y las mismas guardias de siempre.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};

/** Una consulta encadenable que aplica `eq` (y `limit`) a las filas de su tabla, con `count`. */
function consulta(tabla: string) {
  const eqs: [string, unknown][] = [];
  let unico = false;
  let limite: number | null = null;
  const b = {
    select: () => b,
    order: () => b,
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
          const vistas = (limite === null ? filas : filas.slice(0, limite)).map((f) => structuredClone(f));
          return { data: unico ? (vistas[0] ?? null) : vistas, error: null, count: filas.length };
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
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };
const PROPIO = "https://x.supabase.co/storage/v1/object/public/comprobantes/iconos/matcha.png";

function firmado(cuerpo: Record<string, unknown>, secreto = SECRETO): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", secreto).update(`${t}.${texto}`).digest("hex");
  return new Request("https://www.bookea.lat/api/plataforma/foorkie/programa", {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

async function leer(cuerpo: Record<string, unknown>, secreto?: string) {
  const r = await POST(firmado(cuerpo, secreto));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  tablas = {
    foorkie_restaurantes: [
      { id: "local-1", slug: "pura", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: false, activo: true, estado_publicacion: "aprobado" },
    ],
    ranchos: [{ id: RANCHO, owner_id: "dueno-1", nombre: "Pura Prueba", slug: "puraprueba" }],
    programa_lealtad: [
      {
        id: PROGRAMA,
        rancho_id: RANCHO,
        nombre: "Programa de lealtad",
        modo: "sellos",
        estado: "activo",
        activo: true,
        beneficio: { tipo: "sellos", requeridos: 10, recompensa: "Bebida gratis", inicial: 0, repetible: true },
        pase_color_fondo: "#38571a",
        pase_color_sello: "#929292",
        pase_sello_icono: "propio",
        pase_sello_icono_url: PROPIO,
        pase_diseno: { filas: 2, escalaSello: 1.1, alineacionH: "centro", alineacionV: "centro", margenY: 0.1 },
      },
    ],
    recompensas: [{ id: "rc-1", programa_id: PROGRAMA, nombre: "Bebida gratis", costo_puntos: 10, activo: true }],
    miembros: [
      { id: "m1", programa_id: PROGRAMA, estado: "activa" },
      { id: "m2", programa_id: PROGRAMA, estado: "activa" },
    ],
  };
});

describe("programa: la vista del pase", () => {
  it("viaja junto a lo de siempre: la tarjeta de quien recién se une, con el sello y la geometría de la fila", async () => {
    const r = await leer(vinculo);
    expect(r.status).toBe(200);
    const p = r.cuerpo.programa as Record<string, unknown>;
    // Lo de siempre, igual.
    expect(p).toMatchObject({
      id: PROGRAMA,
      negocio: "Pura Prueba",
      modo: "sellos",
      miembros: 2,
      diseno: { colorFondo: "#38571a", colorSello: "#929292", logoUrl: null, bannerUrl: null },
      textos: { encabezado: { label: "SELLOS", value: "0/10" } },
    });
    const vista = p.vista as Record<string, unknown>;
    expect(vista).toMatchObject({
      version: 1,
      saldo: 0,
      colores: { fondo: "#38571a", etiqueta: "#929292" },
      logo: null,
      tira: { tipo: "sellos", total: 10, logrados: 0, sello: { clase: "propio", url: PROPIO }, imagen: PROPIO, diseno: { filas: 2, escalaSello: 1.1, margenY: 0.1 } },
      google: { logo: null, inicial: "P", saldo: { etiqueta: "Sellos", valor: "0" } },
    });
    expect(vista.textos).toEqual(p.textos);
    // Dos filas de cinco, como el pase.
    expect((vista.tira as { layout: { posiciones: unknown[] } }).layout.posiciones).toHaveLength(10);
  });

  it("`diseno` trae además lo GUARDADO del sello y la tira (oct 2026), para que el editor de Foorkie arranque con eso", async () => {
    const r = await leer(vinculo);
    expect((r.cuerpo.programa as { diseno: unknown }).diseno).toEqual({
      colorFondo: "#38571a",
      colorSello: "#929292",
      logoUrl: null,
      bannerUrl: null,
      iconoSello: "propio",
      iconoUrl: PROPIO,
      // Saneada: el fondo que no estaba guardado, el clásico.
      tira: { filas: 2, escalaSello: 1.1, alineacionH: "centro", alineacionV: "centro", margenY: 0.1, fondo: { forma: "plano" } },
    });
  });

  it("bajo el QR: lo de Bookea en una tarjeta vinculada SIN la marca; «Foorkie Lealtad» con ella", async () => {
    const deBookea = await leer(vinculo);
    expect((deBookea.cuerpo.programa as { vista: unknown }).vista).toMatchObject({ marca: "bookea", pie: "Powered by Bookea.lat" });
    tablas.foorkie_restaurantes[0].lealtad_por_foorkie = true;
    const deFoorkie = await leer(vinculo);
    expect((deFoorkie.cuerpo.programa as { vista: unknown }).vista).toMatchObject({ marca: "foorkie", pie: "Foorkie Lealtad" });
  });

  it("las mismas guardias: firma ajena 401, ids raros 400, sin vínculo con Foorkie 403", async () => {
    expect(await leer(vinculo, "otra-llave")).toMatchObject({ status: 401, cuerpo: { codigo: "firma" } });
    expect(await leer({ rancho_id: "x", programa_id: PROGRAMA })).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    tablas.foorkie_restaurantes = [];
    expect(await leer(vinculo)).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
  });
});
