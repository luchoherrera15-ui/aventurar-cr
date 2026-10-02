import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * «Este negocio es de Foorkie» corta SOLO el correo al dueño. Se prueba
 * la guardia sola y en los dos envíos automáticos que la usan: el aviso
 * de la prueba que vence (`avisos-prueba.ts`) y los avisos de la
 * suscripción de Stripe (`puerta-supabase.ts`).
 *
 * Los tres casos que importan (regla dura de Luis: a Pura Matcha no se
 * le toca nada):
 *   · vinculado Y marcado `lealtad_por_foorkie` → de Foorkie, no se le escribe;
 *   · vinculado SIN la marca (como Pura Matcha) → de Bookea, se le escribe;
 *   · la consulta falla (la columna todavía no existe) → de Bookea, se le escribe.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ enviarCorreo: vi.fn(async () => ({ enviado: true })) }));
vi.mock("@/lib/correo/prueba-lealtad", () => ({
  asuntoPruebaPorVencer: () => "Tu prueba se termina",
  plantillaPruebaPorVencer: () => "<p>prueba</p>",
}));
vi.mock("@/lib/correo/suscripcion", () => ({
  plantillaCobroFallido: () => "<p>cobro</p>",
  plantillaCorteProgramado: () => "<p>corte</p>",
  plantillaProgramaPausado: () => "<p>pausa</p>",
  plantillaProgramaReanudado: () => "<p>reanudado</p>",
}));
vi.mock("@/lib/correo/administradores", () => ({ avisarAAdministradores: vi.fn() }));
vi.mock("@/lib/celebrar/pagos/acreditar", () => ({ acreditarCompraDeCreditos: vi.fn() }));
vi.mock("@/lib/invitaciones/pedido", () => ({ notificarPedidoPagado: vi.fn() }));
vi.mock("@/lib/lealtad/alta-desde-solicitud", () => ({ crearNegocioDesdeSolicitud: vi.fn() }));
vi.mock("@/lib/lealtad/aplicar-plan", () => ({ aplicarPlanDeLealtad: vi.fn() }));
vi.mock("@/lib/pagos/stripe", () => ({ stripeDelEntorno: () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => baseDeLaPuerta }));
// Hoy ningún paquete trae días de prueba (todos `diasPrueba: 0`), así que
// ese aviso está dormido. Se fuerza el estado para probar que, el día que
// vuelva, no le escriba al dueño de un negocio de Foorkie.
vi.mock("@/lib/lealtad/prueba", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lealtad/prueba")>()),
  estadoDePrueba: ({ venceEn }: { venceEn: string | null }) => ({
    esPrueba: true,
    vencida: false,
    diasRestantes: 3,
    porVencer: true,
    venceEn,
  }),
}));

import { enviarCorreo } from "@/lib/email";
import { avisarPruebasPorVencer } from "@/lib/lealtad/avisos-prueba";
import { puertaSupabase } from "@/lib/pagos/puerta-supabase";
import { COLUMNA_LEALTAD_POR_FOORKIE, esNegocioDeFoorkie, negociosDeFoorkie } from "./negocio-de-foorkie";

/** Vinculado a un local de Foorkie Y marcado `lealtad_por_foorkie` (como Donde George). */
const DE_FOORKIE = "11111111-1111-4111-8111-111111111111";
/** Un negocio de Bookea que ningún local de Foorkie tiene vinculado. */
const DE_BOOKEA = "22222222-2222-4222-8222-222222222222";
/** Vinculado a un local de Foorkie pero SIN la marca (como Pura Matcha): sigue siendo de Bookea. */
const SIN_MARCA = "33333333-3333-4333-8333-333333333333";

type Consulta = { tabla: string; filtros: unknown[][] };

function baseFalsa(responder: (c: Consulta) => { data?: unknown; error?: unknown }) {
  const consultas: Consulta[] = [];
  const db = {
    from(tabla: string) {
      const c: Consulta = { tabla, filtros: [] };
      consultas.push(c);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "gte", "lt", "is", "order", "limit", "maybeSingle"]) {
        b[m] = (...args: unknown[]) => {
          c.filtros.push([m, ...args]);
          return b;
        };
      }
      b.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            const r = responder(c);
            return { data: r.data ?? null, error: r.error ?? null };
          })
          .then(ok, mal);
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, consultas };
}

/** Los locales de Foorkie, como están en `foorkie_restaurantes`. */
const LOCALES = [
  { bookea_rancho_id: DE_FOORKIE, lealtad_por_foorkie: true },
  { bookea_rancho_id: SIN_MARCA, lealtad_por_foorkie: false },
];

/** La base de verdad: aplica el `in` de los negocios Y el filtro de la marca, si la consulta lo pide. */
function vinculados(c: Consulta) {
  const ids = (c.filtros.find((f) => f[0] === "in")?.[2] ?? []) as string[];
  const marca = c.filtros.find((f) => f[0] === "eq" && f[1] === COLUMNA_LEALTAD_POR_FOORKIE);
  return {
    data: LOCALES.filter((l) => ids.includes(l.bookea_rancho_id))
      .filter((l) => !marca || l.lealtad_por_foorkie === marca[2])
      .map((l) => ({ bookea_rancho_id: l.bookea_rancho_id })),
  };
}

const NOMBRES: Record<string, string> = { [DE_FOORKIE]: "Donde George", [DE_BOOKEA]: "Café Central", [SIN_MARCA]: "Matcha de prueba" };

/** Un negocio cualquiera, su dueño y su correo. */
function negocioYDueno(c: Consulta) {
  if (c.tabla === "foorkie_restaurantes") return vinculados(c);
  if (c.tabla === "ranchos") {
    const id = String(c.filtros.find((f) => f[0] === "eq" && f[1] === "id")?.[2] ?? "");
    return { data: { id, nombre: NOMBRES[id] ?? "Otro", owner_id: `dueno-${id}`, plan_lealtad: "prueba" } };
  }
  if (c.tabla === "perfiles") {
    const id = String(c.filtros.find((f) => f[0] === "eq" && f[1] === "id")?.[2] ?? "");
    return { data: { email: `${id.slice(6, 14)}@negocio.cr` } };
  }
  return { data: null };
}

/** Lo mismo, con la consulta a `foorkie_restaurantes` caída (la columna todavía no existe). */
function sinLaColumna(c: Consulta) {
  if (c.tabla === "foorkie_restaurantes") {
    return { error: { message: `column foorkie_restaurantes.${COLUMNA_LEALTAD_POR_FOORKIE} does not exist`, code: "42703" } };
  }
  return negocioYDueno(c);
}

/** El correo del dueño de un negocio, como lo arma `negocioYDueno`. */
const correoDe = (rancho: string) => `${`dueno-${rancho}`.slice(6, 14)}@negocio.cr`;

let baseDeLaPuerta: SupabaseClient = baseFalsa(negocioYDueno).db;

beforeEach(() => {
  vi.mocked(enviarCorreo).mockClear();
  vi.restoreAllMocks();
});

describe("negociosDeFoorkie / esNegocioDeFoorkie", () => {
  it("de Foorkie es solo el vinculado Y marcado, en una consulta", async () => {
    const { db, consultas } = baseFalsa(vinculados);
    expect(await negociosDeFoorkie(db, [DE_FOORKIE, DE_BOOKEA, SIN_MARCA, DE_FOORKIE])).toEqual(new Set([DE_FOORKIE]));
    expect(consultas).toHaveLength(1);
    expect(consultas[0].tabla).toBe("foorkie_restaurantes");
    expect(consultas[0].filtros).toContainEqual(["in", "bookea_rancho_id", [DE_FOORKIE, DE_BOOKEA, SIN_MARCA]]);
    expect(consultas[0].filtros).toContainEqual(["eq", "lealtad_por_foorkie", true]);
  });

  it("con la marca: de Foorkie", async () => {
    const { db } = baseFalsa(vinculados);
    expect(await esNegocioDeFoorkie(db, DE_FOORKIE)).toBe(true);
  });

  it("vinculado sin la marca (como Pura Matcha): de Bookea", async () => {
    const { db } = baseFalsa(vinculados);
    expect(await esNegocioDeFoorkie(db, SIN_MARCA)).toBe(false);
    expect(await esNegocioDeFoorkie(db, DE_BOOKEA)).toBe(false);
  });

  it("sin negocio no pregunta nada", async () => {
    const { db, consultas } = baseFalsa(vinculados);
    expect(await esNegocioDeFoorkie(db, null)).toBe(false);
    expect(await negociosDeFoorkie(db, [])).toEqual(new Set());
    expect(consultas).toHaveLength(0);
  });

  it("si no se puede saber (la columna todavía no existe), de Bookea: el correo sale como siempre", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db } = baseFalsa(sinLaColumna);
    expect(await esNegocioDeFoorkie(db, DE_FOORKIE)).toBe(false);
    expect(await negociosDeFoorkie(db, [DE_FOORKIE, DE_BOOKEA, SIN_MARCA])).toEqual(new Set());
    // La red que se corta también.
    const cortada = {
      from: () => {
        throw new Error("se cortó la red");
      },
    } as unknown as SupabaseClient;
    expect(await esNegocioDeFoorkie(cortada, DE_FOORKIE)).toBe(false);
  });
});

describe("el aviso de la prueba que vence", () => {
  const venceEn = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();
  const pruebas = (c: Consulta, resto: (c: Consulta) => { data?: unknown; error?: unknown }) =>
    c.tabla === "addons_negocio"
      ? { data: [DE_FOORKIE, DE_BOOKEA, SIN_MARCA].map((rancho_id) => ({ rancho_id, vence_en: venceEn })) }
      : resto(c);

  it("le llega al dueño de un negocio de Bookea y al vinculado sin la marca; no al de Foorkie", async () => {
    const { db } = baseFalsa((c) => pruebas(c, negocioYDueno));

    expect(await avisarPruebasPorVencer(db)).toEqual({ avisados: 2, omitidos: 1 });
    expect(enviarCorreo).toHaveBeenCalledTimes(2);
    const destinos = vi.mocked(enviarCorreo).mock.calls.map((c) => (c[0] as { to: string }).to);
    expect(destinos).toEqual(expect.arrayContaining([correoDe(DE_BOOKEA), correoDe(SIN_MARCA)]));
    expect(destinos).not.toContain(correoDe(DE_FOORKIE));
  });

  it("si la guardia no puede leer, le llega a todos (Bookea de siempre)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db } = baseFalsa((c) => pruebas(c, sinLaColumna));

    expect(await avisarPruebasPorVencer(db)).toEqual({ avisados: 3, omitidos: 0 });
    expect(enviarCorreo).toHaveBeenCalledTimes(3);
  });
});

describe("los avisos de la suscripción (Stripe)", () => {
  it("el negocio de Foorkie no recibe el correo; el vinculado sin la marca y el de Bookea, sí", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    baseDeLaPuerta = baseFalsa(negocioYDueno).db;
    const puerta = puertaSupabase();
    expect(puerta).not.toBeNull();

    await puerta?.avisarAlDueno({ ranchoId: DE_FOORKIE, cuentaId: null, clase: "cobro_fallido", plan: null, hasta: null });
    expect(enviarCorreo).not.toHaveBeenCalled();

    await puerta?.avisarAlDueno({ ranchoId: SIN_MARCA, cuentaId: null, clase: "cobro_fallido", plan: null, hasta: null });
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enviarCorreo).mock.calls[0][0]).toMatchObject({ to: correoDe(SIN_MARCA) });

    await puerta?.avisarAlDueno({ ranchoId: DE_BOOKEA, cuentaId: null, clase: "cobro_fallido", plan: null, hasta: null });
    expect(enviarCorreo).toHaveBeenCalledTimes(2);
  });

  it("si la guardia no puede leer, el «cobro fallido» le llega igual al dueño", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    baseDeLaPuerta = baseFalsa(sinLaColumna).db;
    const puerta = puertaSupabase();

    await puerta?.avisarAlDueno({ ranchoId: DE_FOORKIE, cuentaId: null, clase: "cobro_fallido", plan: null, hasta: null });
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enviarCorreo).mock.calls[0][0]).toMatchObject({ to: correoDe(DE_FOORKIE) });
  });
});
