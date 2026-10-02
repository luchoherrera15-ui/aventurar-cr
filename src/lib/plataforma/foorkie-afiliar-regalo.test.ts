import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResultadoAltaSinSesion } from "@/lib/lealtad/personas";

/**
 * LOS SELLOS DE REGALO AL UNIRSE (0253). El creador los guardaba desde
 * siempre (`ConfigSellos.inicial`) y nadie los daba. Desde la 0253 los da
 * el alta de las tarjetas de Foorkie, a la membresía NUEVA, una sola vez.
 */

const avisos: string[] = [];

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => fn(),
}));
vi.mock("@/lib/wallet/servicio", () => ({
  avisarCambioDePase: async (miembro: string) => {
    avisos.push(miembro);
  },
}));

const { afiliarDesdeFoorkie, sellosDeRegalo } = await import("./foorkie-afiliar");
const { regalarSellosDeBienvenidaCore, referenciaDeBienvenida } = await import("@/lib/lealtad/operar-core");

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "33333333-3333-4333-8333-333333333333";
const MIEMBRO = "44444444-4444-4444-8444-444444444444";
const PERSONA = "55555555-5555-4555-8555-555555555555";

const sellos = (beneficio: Record<string, unknown> | null) => ({
  id: PROGRAMA,
  rancho_id: RANCHO,
  nombre: "Tarjeta",
  modo: "sellos",
  estado: "activo",
  activo: true,
  beneficio,
  created_at: "2026-09-01T10:00:00Z",
});

beforeEach(() => {
  avisos.length = 0;
});

describe("sellosDeRegalo — ¿la tarjeta regala al unirse?", () => {
  it("los `inicial` de una tarjeta de sellos, siempre menos que la meta", () => {
    expect(sellosDeRegalo(sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 2, repetible: true }))).toBe(2);
    expect(sellosDeRegalo(sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 0, repetible: true }))).toBe(0);
    expect(sellosDeRegalo(sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 10, repetible: true }))).toBe(0);
    expect(sellosDeRegalo(sellos(null))).toBe(0);
    expect(sellosDeRegalo({ ...sellos(null), modo: "cashback", beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null } })).toBe(0);
  });
});

/** Una base de mentira con un RPC que anota lo que se le pide. */
function baseConRpc(programa: Record<string, unknown>, respuesta: Record<string, unknown> = { otorgado: true, puntos: 2, saldo: 2 }) {
  const rpc: Record<string, unknown>[] = [];
  const db = {
    from(tabla: string) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: () =>
          Promise.resolve({
            data: tabla === "miembros" ? { id: MIEMBRO, programa_id: PROGRAMA } : tabla === "programa_lealtad" ? programa : null,
            error: null,
          }),
      };
      return q;
    },
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      rpc.push({ nombre, ...args });
      return { data: respuesta, error: null };
    },
  };
  return { db: db as never, rpc };
}

describe("regalarSellosDeBienvenidaCore — el mismo RPC que cualquier sello", () => {
  it("acredita los sellos de regalo, con la llave de UNA vez por miembro", async () => {
    const { db, rpc } = baseConRpc(sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 2, repetible: true }));
    expect(await regalarSellosDeBienvenidaCore({ db, ranchoId: RANCHO, miembroId: MIEMBRO })).toBe(2);
    expect(rpc).toEqual([
      {
        nombre: "acreditar_lealtad",
        p_miembro_id: MIEMBRO,
        p_monto: null,
        p_referencia: referenciaDeBienvenida(MIEMBRO),
        p_usuario_id: null,
        p_motivo: "Sellos de regalo por unirse",
        p_sellos: 2,
      },
    ]);
    expect(avisos).toEqual([MIEMBRO]);
  });

  it("si ya se había dado (la misma llave), no cuenta de nuevo", async () => {
    const { db } = baseConRpc(sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 2, repetible: true }), { otorgado: false, motivo: "ya-otorgado" });
    expect(await regalarSellosDeBienvenidaCore({ db, ranchoId: RANCHO, miembroId: MIEMBRO })).toBe(0);
    expect(avisos).toEqual([]);
  });

  it("sin regalo, o en una tarjeta de otro negocio, ni llama al RPC", async () => {
    const sinRegalo = baseConRpc(sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 0, repetible: true }));
    expect(await regalarSellosDeBienvenidaCore({ db: sinRegalo.db, ranchoId: RANCHO, miembroId: MIEMBRO })).toBe(0);
    expect(sinRegalo.rpc).toEqual([]);
    const ajeno = baseConRpc({ ...sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 2, repetible: true }), rancho_id: "otro" });
    expect(await regalarSellosDeBienvenidaCore({ db: ajeno.db, ranchoId: RANCHO, miembroId: MIEMBRO })).toBe(0);
    expect(ajeno.rpc).toEqual([]);
  });
});

/** La base del alta: lee el negocio, la tarjeta, el miembro, el ledger y la meta. */
function baseDelAlta(programa: Record<string, unknown>, ledger: { puntos: number }[]) {
  return {
    from(tabla: string) {
      let escribe = false;
      const q = {
        select: () => q,
        update: () => {
          escribe = true;
          return q;
        },
        eq: () => q,
        gte: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: () =>
          Promise.resolve({
            data:
              tabla === "ranchos"
                ? { id: RANCHO, nombre: "Donde George", plan_lealtad: "impulso" }
                : tabla === "programa_lealtad"
                  ? programa
                  : tabla === "miembros"
                    ? { id: MIEMBRO, programa_id: PROGRAMA, estado: "activa" }
                    : tabla === "recompensas"
                      ? { nombre: "Café", costo_puntos: 10 }
                      : null,
            error: null,
          }),
        then: (ok: (r: unknown) => unknown) =>
          Promise.resolve(escribe ? { data: null, error: null } : { data: tabla === "transacciones_puntos" ? ledger : [], error: null }).then(ok),
      };
      return q;
    },
  } as never;
}

const PEDIDO = {
  ranchoId: RANCHO,
  programaId: PROGRAMA,
  nombre: "Ana Ruiz",
  correo: "ana@ejemplo.com",
  whatsapp: null,
  aceptaPromos: false,
  consentimiento: { texto: "Sí, quiero mi tarjeta de Donde George en Foorkie Lealtad.", version: "foorkie-lealtad-v1" },
  origen: "foorkie_web" as const,
  ip: null,
  userAgent: null,
};

async function afiliar(programa: Record<string, unknown>, miembroNuevo: boolean) {
  const ledger: { puntos: number }[] = [];
  const regalos: unknown[] = [];
  const respuesta: ResultadoAltaSinSesion = { estado: "listo", personaId: PERSONA, miembroId: MIEMBRO, miembroNuevo } as ResultadoAltaSinSesion;
  const r = await afiliarDesdeFoorkie(baseDelAlta(programa, ledger), PEDIDO, { base: "https://www.bookea.lat", secreto: "s" }, {
    alta: async () => respuesta,
    regalo: async (_db, d) => {
      regalos.push(d);
      ledger.push({ puntos: 2 });
      return 2;
    },
  });
  return { r, regalos };
}

describe("afiliarDesdeFoorkie — el regalo al unirse", () => {
  const conRegalo = sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 2, repetible: true });

  it("a la membresía NUEVA, antes de leer el saldo: la tarjeta que vuelve ya los trae", async () => {
    const { r, regalos } = await afiliar(conRegalo, true);
    expect(regalos).toEqual([{ ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO }]);
    expect(r.ok && r.tarjeta.saldo).toBe(2);
  });

  it("quien ya era miembro no recibe otro regalo", async () => {
    const { regalos } = await afiliar(conRegalo, false);
    expect(regalos).toEqual([]);
  });

  it("una tarjeta sin regalo ni lo intenta", async () => {
    const { regalos } = await afiliar(sellos({ tipo: "sellos", requeridos: 10, recompensa: "Café", inicial: 0, repetible: true }), true);
    expect(regalos).toEqual([]);
  });
});
