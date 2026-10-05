import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/programa/guardar, de punta a punta: la
 * firma de verdad, el vínculo de verdad, la copia de imágenes de verdad
 * (`copiarImagenDeFoorkie`, con un `fetch` y un storage de mentira) y la
 * `vista` del pase, contra una base de mentira que aplica los filtros y
 * los `update`.
 *
 * Lo que se fija (oct 2026, «elegir el diseño completo»): el dibujo del
 * sello —uno de los doce, el ícono propio COPIADO a Bookea o el logo— y la
 * tira se guardan con las reglas del editor de Bookea (`selloParaGuardar`,
 * `configDesdeJson`); null vuelve al diseño por defecto; lo que no cambia
 * no se escribe ni se empuja a los teléfonos; en una tarjeta que no es de
 * sellos el ícono se ignora; y lo de siempre (colores, logo, beneficio)
 * sigue igual.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let escrituras: { tabla: string; valores: Fila }[] = [];
let subidas: { bucket: string; path: string; tipo: string; bytes: number }[] = [];

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
            escrituras.push({ tabla, valores: structuredClone(valores) });
            for (const f of filas) Object.assign(f, structuredClone(valores));
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

const BOOKEA = "https://x.supabase.co/storage/v1/object/public/comprobantes";
const storage = {
  from: (bucket: string) => ({
    upload: async (path: string, bytes: Uint8Array, o: { contentType: string }) => {
      subidas.push({ bucket, path, tipo: o.contentType, bytes: bytes.length });
      return { error: null };
    },
    getPublicUrl: (path: string) => ({ data: { publicUrl: `${BOOKEA}/${path}` } }),
  }),
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => consulta(t), storage }) }));

let despues: (() => unknown)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    despues.push(fn);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/wallet/aviso-de-diseno", () => ({ avisarCambioDeDiseno: vi.fn(async () => null) }));
vi.mock("@/lib/wallet/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wallet/google")>()),
  refrescarClaseGoogle: vi.fn(async () => ({ ok: true })),
}));

import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";
import { CONFIG_CLASICA } from "@/lib/wallet/layout-tira";
import { ICONOS_SELLO } from "@/lib/lealtad/iconos-sello";
import { POST } from "./route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const FOORKIE = "https://x.supabase.co/storage/v1/object/public/foorkie_media/dueno/lealtad";
const PROPIO_GUARDADO = `${BOOKEA}/logos-negocio/foorkie-icono-viejo.png`;

/** Lo que «sirve» el bucket de Foorkie: URL → tipo y peso. */
let archivos: Record<string, { tipo: string; bytes: number }> = {};
const traer = vi.fn(async (url: string) => {
  const a = archivos[url];
  if (!a) return new Response("no", { status: 404 });
  return new Response(new Uint8Array(a.bytes), { status: 200, headers: { "content-type": a.tipo } });
});

function firmado(cuerpo: Record<string, unknown>): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", SECRETO).update(`${t}.${texto}`).digest("hex");
  return new Request("https://www.bookea.lat/api/plataforma/foorkie/programa/guardar", {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

async function guardar(cambios: unknown) {
  const r = await POST(firmado({ rancho_id: RANCHO, programa_id: PROGRAMA, cambios }));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

function programa(): Fila {
  return tablas.programa_lealtad[0];
}

function escritoEnPrograma(): Fila {
  return Object.assign({}, ...escrituras.filter((e) => e.tabla === "programa_lealtad").map((e) => e.valores));
}

beforeAll(() => {
  vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubGlobal("fetch", traer);
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  escrituras = [];
  subidas = [];
  despues = [];
  traer.mockClear();
  vi.mocked(avisarCambioDeDiseno).mockClear();
  archivos = {
    [`${FOORKIE}/matcha.png`]: { tipo: "image/png", bytes: 1200 },
    [`${FOORKIE}/enorme.png`]: { tipo: "image/png", bytes: 3 * 1024 * 1024 },
    [`${FOORKIE}/documento.pdf`]: { tipo: "application/pdf", bytes: 800 },
  };
  tablas = {
    foorkie_restaurantes: [
      { id: "local-1", slug: "donde-george", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: true, activo: true, estado_publicacion: "aprobado" },
    ],
    ranchos: [{ id: RANCHO, owner_id: "dueno-1", nombre: "Donde George", slug: "donde-george" }],
    programa_lealtad: [
      {
        id: PROGRAMA,
        rancho_id: RANCHO,
        nombre: "Programa de lealtad",
        modo: "sellos",
        estado: "activo",
        activo: true,
        beneficio: { tipo: "sellos", requeridos: 8, recompensa: "Café gratis", inicial: 0, repetible: true },
        pase_color_fondo: "#1B2A6B",
        pase_color_sello: "#FCB700",
        pase_logo_url: null,
        pase_banner_url: null,
        pase_sello_icono: null,
        pase_sello_icono_url: null,
        pase_diseno: {},
      },
    ],
    recompensas: [{ id: "rc-1", programa_id: PROGRAMA, nombre: "Café gratis", costo_puntos: 8, activo: true }],
    miembros: [{ id: "m-1", programa_id: PROGRAMA, estado: "activa" }],
  };
});

describe("programa/guardar: el sello y la tira", () => {
  it("uno de los doce y una tira propia: se guardan, vuelven en `diseno` y en la `vista`, y se avisa a los pases", async () => {
    const tira = {
      filas: 2,
      escalaSello: 1.25,
      alineacionH: "izquierda",
      alineacionV: "abajo",
      margenY: 0.1,
      fondo: { forma: "resplandor", acento: "#112233", acento2: "#445566" },
    };
    const r = await guardar({ iconoSello: "cafe", diseno: tira });
    expect(r.status).toBe(200);
    expect(r.cuerpo.cambio).toBe(true);
    expect(escritoEnPrograma()).toEqual({ pase_sello_icono: "cafe", pase_diseno: tira });

    const p = r.cuerpo.programa as Record<string, unknown>;
    expect(p.diseno).toEqual({
      colorFondo: "#1B2A6B",
      colorSello: "#FCB700",
      logoUrl: null,
      bannerUrl: null,
      iconoSello: "cafe",
      iconoUrl: null,
      tira,
    });
    expect((p.vista as { tira: unknown }).tira).toMatchObject({
      tipo: "sellos",
      total: 8,
      sello: { clase: "icono", icono: "cafe", trazos: [...ICONOS_SELLO.cafe.trazos] },
      diseno: tira,
      degradado: expect.any(Array),
    });
    // Apple y Google se enteran después de responder.
    expect(despues).toHaveLength(2);
    await Promise.all(despues.map((f) => f()));
    expect(avisarCambioDeDiseno).toHaveBeenCalledWith(PROGRAMA);
  });

  it("el ícono propio se COPIA de Foorkie a Bookea y queda elegido", async () => {
    const r = await guardar({ iconoSello: "propio", iconoUrl: `${FOORKIE}/matcha.png` });
    expect(r.status).toBe(200);
    expect(traer).toHaveBeenCalledWith(`${FOORKIE}/matcha.png`, expect.anything());
    expect(subidas).toHaveLength(1);
    expect(subidas[0]).toMatchObject({ bucket: "comprobantes", tipo: "image/png", bytes: 1200 });
    expect(subidas[0].path).toMatch(/^logos-negocio\/foorkie-icono-\d+-[a-z0-9]+\.png$/);
    const copiada = `${BOOKEA}/${subidas[0].path}`;
    expect(escritoEnPrograma()).toEqual({ pase_sello_icono: "propio", pase_sello_icono_url: copiada });
    const p = r.cuerpo.programa as Record<string, unknown>;
    expect(p.diseno).toMatchObject({ iconoSello: "propio", iconoUrl: copiada });
    expect((p.vista as { tira: unknown }).tira).toMatchObject({ sello: { clase: "propio", url: copiada }, imagen: copiada });
  });

  it("'propio' sin archivo, una URL que no es de Foorkie o una imagen que no sirve: 400 y no se toca nada", async () => {
    expect(await guardar({ iconoSello: "propio" })).toMatchObject({
      status: 400,
      cuerpo: { codigo: "datos", motivo: "Subí tu ícono antes de elegirlo como sello." },
    });
    const motivo = "El ícono no se pudo usar: tiene que ser una imagen PNG, JPG o WebP de hasta 2 MB.";
    for (const url of ["https://otro.com/icono.png", `${FOORKIE}/enorme.png`, `${FOORKIE}/documento.pdf`, `${FOORKIE}/no-existe.png`]) {
      expect(await guardar({ iconoSello: "propio", iconoUrl: url })).toMatchObject({ status: 400, cuerpo: { codigo: "datos", motivo } });
    }
    expect(escrituras).toEqual([]);
    expect(subidas).toEqual([]);
    expect(despues).toEqual([]);
  });

  it("formas que no se pueden leer: un ícono que no existe, una tira que no es un objeto", async () => {
    expect(await guardar({ iconoSello: "pizza" })).toMatchObject({ status: 400, cuerpo: { motivo: "Ese icono de sello no existe." } });
    expect(await guardar({ diseno: "dos filas" })).toMatchObject({ status: 400, cuerpo: { motivo: "El diseño de la tira no vino bien armado." } });
    expect(await guardar({ diseno: [1, 2] })).toMatchObject({ status: 400, cuerpo: { motivo: "El diseño de la tira no vino bien armado." } });
    expect(await guardar({ iconoUrl: 42 })).toMatchObject({ status: 400, cuerpo: { motivo: "El ícono no se subió bien — probá de nuevo." } });
    expect(escrituras).toEqual([]);
  });

  it("la tira se sanea como en el panel de Bookea: fuera de rango se acota; lo que falta, clásico", async () => {
    const r = await guardar({ diseno: { filas: 7, escalaSello: 5, margenY: -1, alineacionH: "arriba", fondo: { forma: "cascada", acento: "rojo" } } });
    expect(r.status).toBe(200);
    expect(escritoEnPrograma().pase_diseno).toEqual({ ...CONFIG_CLASICA, escalaSello: 2, margenY: 0 });
  });

  it("null = el diseño por defecto: la tira vuelve a `{}` y el sello al logo (el archivo propio se conserva)", async () => {
    Object.assign(programa(), {
      pase_sello_icono: "propio",
      pase_sello_icono_url: PROPIO_GUARDADO,
      pase_diseno: { filas: 1, escalaSello: 0.8, alineacionH: "centro", alineacionV: "arriba", margenY: 0.05 },
    });
    const r = await guardar({ iconoSello: null, diseno: null });
    expect(r.status).toBe(200);
    expect(escritoEnPrograma()).toEqual({ pase_sello_icono: null, pase_diseno: {} });
    const p = r.cuerpo.programa as Record<string, unknown>;
    expect(p.diseno).toMatchObject({ iconoSello: null, iconoUrl: PROPIO_GUARDADO, tira: CONFIG_CLASICA });
    expect((p.vista as { tira: unknown }).tira).toMatchObject({ sello: { clase: "logo" } });
  });

  it("volver al archivo guardado: 'propio' sin `iconoUrl` usa el que ya tiene, sin copiar nada", async () => {
    Object.assign(programa(), { pase_sello_icono: "estrella", pase_sello_icono_url: PROPIO_GUARDADO });
    const r = await guardar({ iconoSello: "propio" });
    expect(r.status).toBe(200);
    expect(escritoEnPrograma()).toEqual({ pase_sello_icono: "propio" });
    expect(traer).not.toHaveBeenCalled();
    // La misma URL que ya tiene tampoco se copia de nuevo.
    expect(await guardar({ iconoSello: "propio", iconoUrl: PROPIO_GUARDADO })).toMatchObject({ status: 200, cuerpo: { cambio: false } });
    expect(traer).not.toHaveBeenCalled();
  });

  it("sacar el archivo con 'propio' elegido pide elegir otra cosa; con otro sello, se saca", async () => {
    Object.assign(programa(), { pase_sello_icono: "propio", pase_sello_icono_url: PROPIO_GUARDADO });
    expect(await guardar({ iconoUrl: null })).toMatchObject({ status: 400, cuerpo: { motivo: "Subí tu ícono antes de elegirlo como sello." } });
    const r = await guardar({ iconoSello: "regalo", iconoUrl: null });
    expect(r.status).toBe(200);
    expect(escritoEnPrograma()).toEqual({ pase_sello_icono: "regalo", pase_sello_icono_url: null });
  });

  it("lo mismo que ya tiene no se escribe ni se empuja (la tira en otro orden y los acentos en minúscula son la misma)", async () => {
    Object.assign(programa(), {
      pase_sello_icono: "cafe",
      pase_diseno: { margenY: 0.1, filas: 2, escalaSello: 1, alineacionV: "centro", alineacionH: "centro", fondo: { forma: "cascada", acento: "#AABBCC", acento2: null } },
    });
    const r = await guardar({
      iconoSello: "cafe",
      diseno: { filas: 2, escalaSello: 1, alineacionH: "centro", alineacionV: "centro", margenY: 0.1, fondo: { forma: "cascada", acento: "#aabbcc", acento2: null } },
    });
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, cambio: false } });
    expect(escrituras).toEqual([]);
    expect(despues).toEqual([]);
    // La tira clásica sobre una columna vacía, igual.
    Object.assign(programa(), { pase_diseno: {} });
    expect(await guardar({ diseno: CONFIG_CLASICA })).toMatchObject({ status: 200, cuerpo: { cambio: false } });
    expect(await guardar({ diseno: null })).toMatchObject({ status: 200, cuerpo: { cambio: false } });
    expect(escrituras).toEqual([]);
  });

  it("en una tarjeta que no es de sellos el ícono se ignora (como en el alta): ni se copia ni se escribe; la tira sí", async () => {
    Object.assign(programa(), {
      modo: "cashback",
      beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, canjeLibre: true },
    });
    const solo = await guardar({ iconoSello: "propio", iconoUrl: `${FOORKIE}/matcha.png` });
    expect(solo).toMatchObject({ status: 200, cuerpo: { ok: true, cambio: false } });
    expect(traer).not.toHaveBeenCalled();
    expect(escrituras).toEqual([]);
    expect((solo.cuerpo.programa as { diseno: unknown }).diseno).toMatchObject({ iconoSello: null, iconoUrl: null });

    const conTira = await guardar({ iconoSello: "cafe", diseno: { filas: 1, escalaSello: 1, alineacionH: "centro", alineacionV: "centro", margenY: 0.07, fondo: { forma: "resplandor", acento: "#000000", acento2: null } } });
    expect(conTira.status).toBe(200);
    expect(Object.keys(escritoEnPrograma())).toEqual(["pase_diseno"]);
  });

  it("lo de siempre sigue igual: un color cambia solo el color y no toca el sello ni la tira", async () => {
    Object.assign(programa(), { pase_sello_icono: "cafe", pase_diseno: { filas: 2 } });
    const r = await guardar({ colorFondo: "#38571a" });
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, cambio: true } });
    expect(escritoEnPrograma()).toEqual({ pase_color_fondo: "#38571A" });
    expect((r.cuerpo.programa as { diseno: unknown }).diseno).toMatchObject({ colorFondo: "#38571A", iconoSello: "cafe", tira: { filas: 2 } });
  });
});
