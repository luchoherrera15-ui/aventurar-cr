import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/negocio — el alta de la tarjeta desde
 * Foorkie, de punta a punta hasta `crearNegocioDeLealtadCompleto` (que acá
 * es de mentira: se fija QUÉ tarjeta le llega, ya validada por
 * `validarTarjetaDeAlta` de verdad). La firma, la lectura de los locales y
 * la copia de imágenes (`copiarImagenDeFoorkie`, con un `fetch` y un
 * storage de mentira) son las de verdad.
 *
 * Lo que se fija (oct 2026, «elegir el diseño completo»): el ícono del
 * sello —uno de los doce o el propio, COPIADO a Bookea— y la tira viajan
 * hasta el alta; un id fuera del catálogo, 'propio' sin archivo o una
 * tira que no es un objeto se rechazan; la tira se sanea como en el panel
 * de Bookea; en una tarjeta que no es de sellos el ícono se descarta (y no
 * se copia); y un alta sin los campos nuevos sigue igual que antes.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let subidas: { bucket: string; path: string; tipo: string; bytes: number }[] = [];

function consulta(tabla: string) {
  const eqs: [string, unknown][] = [];
  let ins: [string, unknown[]] | null = null;
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
      ins = [col, vals];
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
          const filas = (tablas[tabla] ?? []).filter(
            (f) => eqs.every(([c, v]) => f[c] === v) && (!ins || ins[1].includes(f[ins[0]])),
          );
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

const RANCHO_NUEVO = "33333333-3333-4333-8333-333333333333";
const PROGRAMA_NUEVO = "44444444-4444-4444-8444-444444444444";
vi.mock("@/lib/lealtad/crear-negocio-completo", () => ({
  crearNegocioDeLealtadCompleto: vi.fn(async () => {
    tablas.programa_lealtad.push({ id: PROGRAMA_NUEVO, rancho_id: RANCHO_NUEVO, created_at: "2026-10-05T00:00:00Z" });
    return { ok: true, creado: { ranchoId: RANCHO_NUEVO, slug: "donde-george" } };
  }),
}));

import { crearNegocioDeLealtadCompleto } from "@/lib/lealtad/crear-negocio-completo";
import { CONFIG_CLASICA } from "@/lib/wallet/layout-tira";
import { POST } from "./route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const LOCAL = "55555555-5555-4555-8555-555555555555";
const DUENO = "66666666-6666-4666-8666-666666666666";
const FOORKIE = "https://x.supabase.co/storage/v1/object/public/foorkie_media/dueno/lealtad";

let archivos: Record<string, { tipo: string; bytes: number }> = {};
const traer = vi.fn(async (url: string) => {
  const a = archivos[url];
  if (!a) return new Response("no", { status: 404 });
  return new Response(new Uint8Array(a.bytes), { status: 200, headers: { "content-type": a.tipo } });
});

const SELLOS = { tipo: "sellos", requeridos: 10, recompensa: "Café gratis", inicial: 0, repetible: true, sellosPor: "compra", montoPorSello: null };
const CASHBACK = { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null };

function cuerpo(tarjeta: Record<string, unknown>): Record<string, unknown> {
  return { restaurante_ids: [LOCAL], nombre: "Donde George", correo: "dueno@ejemplo.com", plan: "impulso", tarjeta };
}

async function alta(tarjeta: Record<string, unknown>) {
  const texto = JSON.stringify(cuerpo(tarjeta));
  const t = Date.now();
  const v1 = createHmac("sha256", SECRETO).update(`${t}.${texto}`).digest("hex");
  const r = await POST(
    new Request("https://www.bookea.lat/api/plataforma/foorkie/negocio", {
      method: "POST",
      headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
      body: texto,
    }),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

/** La tarjeta que le llegó al alta (ya validada). */
function tarjetaDelAlta(): Record<string, unknown> | null {
  const llamadas = vi.mocked(crearNegocioDeLealtadCompleto).mock.calls;
  return (llamadas.at(-1)?.[0] as { tarjeta: Record<string, unknown> | null } | undefined)?.tarjeta ?? null;
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
  subidas = [];
  traer.mockClear();
  vi.mocked(crearNegocioDeLealtadCompleto).mockClear();
  archivos = {
    [`${FOORKIE}/logo.png`]: { tipo: "image/png", bytes: 2000 },
    [`${FOORKIE}/matcha.webp`]: { tipo: "image/webp", bytes: 900 },
    [`${FOORKIE}/enorme.png`]: { tipo: "image/png", bytes: 3 * 1024 * 1024 },
  };
  tablas = {
    foorkie_restaurantes: [{ id: LOCAL, dueno_id: DUENO, bookea_rancho_id: null, bookea_programa_id: null }],
    programa_lealtad: [],
  };
});

describe("negocio: el sello y la tira en el alta", () => {
  it("uno de los doce y una tira propia llegan al alta, validados", async () => {
    const tira = { filas: 1, escalaSello: 0.8, alineacionH: "centro", alineacionV: "abajo", margenY: 0.12, fondo: { forma: "cascada", acento: "#2A3A7A", acento2: "#4C5FC9" } };
    const r = await alta({ modo: "sellos", beneficio: SELLOS, colorFondo: "#1B2A6B", colorSello: "#FCB700", iconoSello: "cafe", diseno: tira });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, rancho_id: RANCHO_NUEVO, programa_id: PROGRAMA_NUEVO, slug: "donde-george" } });
    expect(tarjetaDelAlta()).toMatchObject({ modo: "sellos", iconoSello: "cafe", iconoUrl: null, diseno: tira, colorFondo: "#1B2A6B" });
    expect(vi.mocked(crearNegocioDeLealtadCompleto).mock.calls[0][0]).toMatchObject({ userId: DUENO, plan: "impulso", origen: "admin" });
  });

  it("el ícono propio se COPIA de Foorkie a Bookea (como el logo) y llega con 'propio'", async () => {
    const r = await alta({ modo: "sellos", beneficio: SELLOS, logoUrl: `${FOORKIE}/logo.png`, iconoSello: "propio", iconoUrl: `${FOORKIE}/matcha.webp` });
    expect(r.status).toBe(200);
    expect(subidas.map((s) => [s.bucket, /^logos-negocio\/foorkie-([a-z]+)-/.exec(s.path)?.[1], s.tipo])).toEqual(
      expect.arrayContaining([
        ["comprobantes", "logo", "image/png"],
        ["comprobantes", "icono", "image/webp"],
      ]),
    );
    const icono = subidas.find((s) => s.path.includes("foorkie-icono-"));
    expect(tarjetaDelAlta()).toMatchObject({ iconoSello: "propio", iconoUrl: `${BOOKEA}/${icono?.path}`, diseno: null });
  });

  it("rechazos con motivo: un ícono fuera del catálogo, 'propio' sin archivo, un archivo que no sirve, una tira que no es objeto", async () => {
    expect(await alta({ modo: "sellos", beneficio: SELLOS, iconoSello: "pizza" })).toMatchObject({
      status: 400,
      cuerpo: { codigo: "datos", motivo: "Ese icono de sello no existe." },
    });
    expect(await alta({ modo: "sellos", beneficio: SELLOS, iconoSello: "propio" })).toMatchObject({
      status: 400,
      cuerpo: { motivo: "Subí tu ícono antes de elegirlo como sello." },
    });
    for (const url of [`${FOORKIE}/enorme.png`, "https://otro.com/icono.png", `${FOORKIE}/no-existe.png`]) {
      expect(await alta({ modo: "sellos", beneficio: SELLOS, iconoSello: "propio", iconoUrl: url })).toMatchObject({
        status: 400,
        cuerpo: { motivo: "El ícono no se pudo usar: tiene que ser una imagen PNG, JPG o WebP de hasta 2 MB." },
      });
    }
    expect(await alta({ modo: "sellos", beneficio: SELLOS, diseno: "dos filas" })).toMatchObject({
      status: 400,
      cuerpo: { motivo: "El diseño de la tira no vino bien armado." },
    });
    expect(crearNegocioDeLealtadCompleto).not.toHaveBeenCalled();
  });

  it("la tira se sanea como en el panel de Bookea; la clásica no viaja (la columna queda en `{}`)", async () => {
    await alta({ modo: "sellos", beneficio: SELLOS, diseno: { filas: 9, escalaSello: 7, margenY: 0.5 } });
    expect(tarjetaDelAlta()?.diseno).toEqual({ ...CONFIG_CLASICA, escalaSello: 2, margenY: 0.25 });
    await alta({ modo: "sellos", beneficio: SELLOS, diseno: CONFIG_CLASICA });
    expect(tarjetaDelAlta()?.diseno).toBeNull();
    await alta({ modo: "sellos", beneficio: SELLOS, diseno: null });
    expect(tarjetaDelAlta()?.diseno).toBeNull();
  });

  it("en una tarjeta de cashback el ícono se descarta (no hay círculos) y el archivo ni se baja; la tira sí viaja", async () => {
    const tira = { ...CONFIG_CLASICA, fondo: { forma: "resplandor", acento: "#1B3A8F", acento2: null } };
    const r = await alta({ modo: "cashback", beneficio: CASHBACK, iconoSello: "propio", iconoUrl: `${FOORKIE}/matcha.webp`, diseno: tira });
    expect(r.status).toBe(200);
    expect(traer).not.toHaveBeenCalled();
    expect(tarjetaDelAlta()).toMatchObject({ modo: "cashback", iconoSello: null, iconoUrl: null, diseno: tira });
    // Toda tarjeta de cashback de este alta nace con canje libre (lo de siempre).
    expect(tarjetaDelAlta()?.beneficio).toMatchObject({ tipo: "cashback", porcentaje: 5, canjeLibre: true });
  });

  it("un alta sin los campos nuevos sigue igual que antes", async () => {
    const r = await alta({ modo: "sellos", beneficio: SELLOS, colorFondo: "#1B2A6B", colorSello: "#FCB700" });
    expect(r.status).toBe(200);
    expect(tarjetaDelAlta()).toEqual({
      modo: "sellos",
      beneficio: SELLOS,
      colorFondo: "#1B2A6B",
      colorSello: "#FCB700",
      iconoSello: null,
      iconoUrl: null,
      logoUrl: null,
      bannerUrl: null,
      notificacionLogoUrl: null,
      diseno: null,
    });
    expect(traer).not.toHaveBeenCalled();
  });
});
