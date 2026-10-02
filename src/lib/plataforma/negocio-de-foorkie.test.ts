import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * «Este negocio es de Foorkie» corta SOLO el correo al dueño. Se prueba
 * la guardia sola y en los dos envíos automáticos que la usan: el aviso
 * de la prueba que vence (`avisos-prueba.ts`) y los avisos de la
 * suscripción de Stripe (`puerta-supabase.ts`).
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
import { esNegocioDeFoorkie, negociosDeFoorkie } from "./negocio-de-foorkie";

const DE_FOORKIE = "11111111-1111-4111-8111-111111111111";
const DE_BOOKEA = "22222222-2222-4222-8222-222222222222";

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

/** Los locales de Foorkie vinculados: solo DE_FOORKIE. */
function vinculados(c: Consulta) {
  const ids = (c.filtros.find((f) => f[0] === "in")?.[2] ?? []) as string[];
  return { data: ids.filter((id) => id === DE_FOORKIE).map((id) => ({ bookea_rancho_id: id })) };
}

/** Un negocio cualquiera, su dueño y su correo. */
function negocioYDueno(c: Consulta) {
  if (c.tabla === "foorkie_restaurantes") return vinculados(c);
  if (c.tabla === "ranchos") {
    const id = c.filtros.find((f) => f[0] === "eq" && f[1] === "id")?.[2];
    return { data: { id, nombre: id === DE_FOORKIE ? "Donde George" : "Café Central", owner_id: `dueno-${id}`, plan_lealtad: "prueba" } };
  }
  if (c.tabla === "perfiles") {
    const id = String(c.filtros.find((f) => f[0] === "eq" && f[1] === "id")?.[2] ?? "");
    return { data: { email: `${id.slice(6, 14)}@negocio.cr` } };
  }
  return { data: null };
}

let baseDeLaPuerta: SupabaseClient = baseFalsa(negocioYDueno).db;

beforeEach(() => {
  vi.mocked(enviarCorreo).mockClear();
});

describe("negociosDeFoorkie / esNegocioDeFoorkie", () => {
  it("dice cuáles están vinculados a un local de Foorkie, en una consulta", async () => {
    const { db, consultas } = baseFalsa(vinculados);
    expect(await negociosDeFoorkie(db, [DE_FOORKIE, DE_BOOKEA, DE_FOORKIE])).toEqual(new Set([DE_FOORKIE]));
    expect(consultas).toHaveLength(1);
    expect(consultas[0].tabla).toBe("foorkie_restaurantes");
    expect(consultas[0].filtros).toContainEqual(["in", "bookea_rancho_id", [DE_FOORKIE, DE_BOOKEA]]);
    expect(await esNegocioDeFoorkie(db, DE_FOORKIE)).toBe(true);
    expect(await esNegocioDeFoorkie(db, DE_BOOKEA)).toBe(false);
  });

  it("sin negocio no pregunta nada", async () => {
    const { db, consultas } = baseFalsa(vinculados);
    expect(await esNegocioDeFoorkie(db, null)).toBe(false);
    expect(await negociosDeFoorkie(db, [])).toEqual(new Set());
    expect(consultas).toHaveLength(0);
  });

  it("si no se puede saber, no se le escribe al dueño", async () => {
    const { db } = baseFalsa(() => ({ error: { message: "caída" } }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await esNegocioDeFoorkie(db, DE_BOOKEA)).toBe(true);
    expect(await negociosDeFoorkie(db, [DE_FOORKIE, DE_BOOKEA])).toEqual(new Set([DE_FOORKIE, DE_BOOKEA]));
  });
});

describe("el aviso de la prueba que vence", () => {
  it("le llega al dueño de un negocio de Bookea y no al de uno de Foorkie", async () => {
    const venceEn = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();
    const { db } = baseFalsa((c) =>
      c.tabla === "addons_negocio"
        ? { data: [{ rancho_id: DE_FOORKIE, vence_en: venceEn }, { rancho_id: DE_BOOKEA, vence_en: venceEn }] }
        : negocioYDueno(c),
    );

    expect(await avisarPruebasPorVencer(db)).toEqual({ avisados: 1, omitidos: 1 });
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enviarCorreo).mock.calls[0][0]).toMatchObject({ to: `${`dueno-${DE_BOOKEA}`.slice(6, 14)}@negocio.cr` });
  });
});

describe("los avisos de la suscripción (Stripe)", () => {
  it("el negocio de Foorkie no recibe el correo; el de Bookea sí", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    baseDeLaPuerta = baseFalsa(negocioYDueno).db;
    const puerta = puertaSupabase();
    expect(puerta).not.toBeNull();

    await puerta?.avisarAlDueno({ ranchoId: DE_FOORKIE, cuentaId: null, clase: "cobro_fallido", plan: null, hasta: null });
    expect(enviarCorreo).not.toHaveBeenCalled();

    await puerta?.avisarAlDueno({ ranchoId: DE_BOOKEA, cuentaId: null, clase: "cobro_fallido", plan: null, hasta: null });
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
  });
});
