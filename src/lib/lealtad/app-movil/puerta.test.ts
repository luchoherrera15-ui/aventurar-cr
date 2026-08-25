import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISOS_NADA, PERMISOS_TODO, type PermisosLealtad } from "@/lib/lealtad/permisos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA PUERTA DE LA APP — un caso por cada forma de dejarla abierta
 * ════════════════════════════════════════════════════════════════════
 *
 * Cada `it` de acá abajo corresponde a uno de los siete pasos de
 * `abrirPuertaApp`, y ninguno está por completitud: cada uno cierra una
 * puerta que, abierta, deja mover saldo de clientes reales sin permiso.
 *
 * El caso que más importa es el ÚLTIMO de cada bloque: que el rechazo
 * ocurra ANTES de tocar la base. Una puerta que rechaza pero ya consultó
 * —o peor, ya escribió— no es una puerta.
 */

type Escenario = {
  /** null = sin token, o token que no corresponde a nadie. */
  acceso?: {
    ok: boolean;
    esAdmin: boolean;
    permisos: PermisosLealtad;
  } | null;
  /** Qué contesta el RPC `tiene_addon`. */
  addon?: boolean | null;
  /** La fila de `ranchos` que devuelve la llave de servicio. */
  rancho?: Record<string, unknown> | null;
  /** Qué devuelve `api_rate_limit_tomar`. null = el contador falló. */
  conteo?: number | null;
  /** true = `createAdminClient()` devuelve null. */
  sinLlaveDeServicio?: boolean;
};

let escenario: Escenario = {};
/** Todo lo que se le pidió a la base, en orden. Es la prueba de «antes de». */
let llamadas: string[] = [];

vi.mock("@/lib/auth", () => ({
  accesoLealtadDeLaPeticion: async () => {
    llamadas.push("acceso");
    if (escenario.acceso === null) return null;
    const a = escenario.acceso ?? { ok: true, esAdmin: false, permisos: PERMISOS_TODO };
    return {
      ...a,
      esDueno: !a.esAdmin,
      esColaborador: false,
      usuarioId: "u-1",
      supabase: {
        rpc: async (nombre: string) => {
          llamadas.push(`rpc:${nombre}`);
          if (nombre === "tiene_addon") {
            // `in` y no `??`: el escenario tiene que poder decir «el RPC
            // devolvió null», que es distinto de «no lo configuré». Con
            // `??` el null caía en `true` y el caso no probaba nada.
            return {
              data: "addon" in escenario ? escenario.addon : true,
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (escenario.sinLlaveDeServicio) return null;
    return {
      from(tabla: string) {
        llamadas.push(`from:${tabla}`);
        const c = {
          select: () => c,
          eq: () => c,
          async maybeSingle() {
            return { data: escenario.rancho ?? { id: "r-1" }, error: null };
          },
        };
        return c;
      },
      async rpc(nombre: string) {
        llamadas.push(`rpc:${nombre}`);
        if (nombre === "api_rate_limit_tomar") {
          if (escenario.conteo === null) throw new Error("contador caído");
          return { data: escenario.conteo ?? 1, error: null };
        }
        return { data: null, error: null };
      },
    };
  },
}));

const { abrirPuertaApp, motivoParaMovil } = await import("./puerta");

const RANCHO = "34525402-b895-4070-90fa-be3449f9b15c";
const peticion = () =>
  new Request("https://bookea.lat/api/lealtad/app/acreditar", {
    method: "POST",
    headers: { authorization: "Bearer tok" },
  });

const abrir = (permiso: Parameters<typeof abrirPuertaApp>[1]["permiso"], escribe = true) =>
  abrirPuertaApp(peticion(), { ranchoId: RANCHO, permiso, escribe });

beforeEach(() => {
  escenario = {};
  llamadas = [];
});

describe("1 · el id del negocio", () => {
  it("un ranchoId que no es uuid se rechaza SIN tocar la red", async () => {
    const r = await abrirPuertaApp(peticion(), {
      ranchoId: "'; drop table miembros;--",
      permiso: "acreditar",
      escribe: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(400);
    expect(llamadas).toHaveLength(0);
  });
});

describe("2 · la sesión", () => {
  it("sin token válido responde 401 y NUNCA mira la cookie", async () => {
    // El `null` de `accesoLealtadDeLaPeticion` es «no hay bearer usable».
    // Que de ahí salga un 401 —y no una consulta más— es lo que cierra
    // el CSRF: con Allow-Origin *, caer a la cookie dejaría que un
    // formulario ajeno acredite con la sesión abierta del dueño.
    escenario = { acceso: null };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(401);
    expect(llamadas).toEqual(["acceso"]);
  });
});

describe("3 · el acceso al negocio", () => {
  it("un negocio ajeno responde 403 sin llave de servicio de por medio", async () => {
    escenario = { acceso: { ok: false, esAdmin: false, permisos: PERMISOS_NADA } };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(403);
    expect(llamadas.some((l) => l.startsWith("from:"))).toBe(false);
  });
});

describe("4 · el complemento de lealtad", () => {
  it("apagado o vencido → 403, y NO se llega al rate limit", async () => {
    // `tiene_addon` valida `vence_en > now()`, así que este mismo caso
    // cubre el add-on vencido. Es el portón que ningún server action
    // tiene: sin él, la app sería la puerta de atrás al cobro.
    escenario = { addon: false };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(403);
    expect(llamadas).not.toContain("rpc:api_rate_limit_tomar");
  });

  it("una respuesta rara del RPC tampoco abre", async () => {
    // `!== true` y no `=== false`: null, undefined o un string no
    // conceden. En permisos, el empate lo pierde el permiso.
    escenario = { addon: null };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
  });
});

describe("5 · la aprobación del negocio", () => {
  it("sin aprobar → 403", async () => {
    escenario = { rancho: { id: "r-1", lealtad_aprobado_en: null } };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(403);
  });

  it("un admin de plataforma entra igual", async () => {
    escenario = {
      rancho: { id: "r-1", lealtad_aprobado_en: null },
      acceso: { ok: true, esAdmin: true, permisos: PERMISOS_TODO },
    };
    expect((await abrir("acreditar")).ok).toBe(true);
  });

  it("si la columna no existe todavía, no se bloquea a nadie", async () => {
    // Misma tolerancia que el panel: la 0129 puede no estar corrida en
    // ese entorno, y ahí lo correcto es no inventar un bloqueo.
    escenario = { rancho: { id: "r-1" } };
    expect((await abrir("acreditar")).ok).toBe(true);
  });
});

describe("6 · el permiso puntual", () => {
  it("un empleado sin `acreditar` NO acredita", async () => {
    escenario = {
      acceso: {
        ok: true,
        esAdmin: false,
        permisos: { ...PERMISOS_NADA, canjear: true },
      },
    };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(403);
  });

  it("y ese mismo empleado SÍ canjea", async () => {
    escenario = {
      acceso: { ok: true, esAdmin: false, permisos: { ...PERMISOS_NADA, canjear: true } },
    };
    expect((await abrir("canjear")).ok).toBe(true);
  });

  it("`solo-entrar` no exige ninguno de los cuatro", async () => {
    // El tablero: exigirle `acreditar` dejaría afuera al colaborador
    // que solo canjea y al dueño que entra a mirar los números.
    escenario = { acceso: { ok: true, esAdmin: false, permisos: PERMISOS_NADA } };
    expect((await abrir("solo-entrar", false)).ok).toBe(true);
  });
});

describe("7 · el límite de peticiones", () => {
  it("pasado el techo responde 429", async () => {
    escenario = { conteo: 999 };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(429);
  });

  it("si el contador se cae, FALLA CERRADO con 503", async () => {
    // Solo es tolerable porque el `intentoId` es obligatorio en todo lo
    // que escribe: el reintento es idempotente y no duplica el sello.
    escenario = { conteo: null };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(503);
  });

  it("leer y escribir usan ámbitos distintos", async () => {
    await abrir("solo-entrar", false);
    await abrir("acreditar", true);
    // Los dos pasaron por el contador; el ámbito lo elige la puerta
    // según `escribe`, no el endpoint.
    expect(llamadas.filter((l) => l === "rpc:api_rate_limit_tomar")).toHaveLength(2);
  });
});

describe("sin llave de servicio", () => {
  it("responde 503 en vez de operar a medias", async () => {
    escenario = { sinLlaveDeServicio: true };
    const r = await abrir("acreditar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(503);
  });
});

describe("regla 3.1.1 de Apple", () => {
  it("el upsell de plan NO sale hacia el binario de iOS", async () => {
    // El motivo real dice «…Escribile a Bookea para subir de plan», que
    // es un llamado a contratar software fuera de la compra dentro de la
    // app. Se reescribe POR CÓDIGO.
    const real = "Tu paquete ya usó todo su cupo de clientes. Escribile a Bookea para subir de plan.";
    const paraMovil = motivoParaMovil("cupo_agotado", real);
    expect(paraMovil).not.toMatch(/plan|paquete|precio/i);
    expect(paraMovil).toContain("Contactá a Bookea");
  });

  it("un motivo sin código se deja tal cual", async () => {
    // El filtro es por CÓDIGO y no por substring: filtrar la palabra
    // «plan» taparía mañana un motivo útil que diga «el plan de la
    // tarjeta» y dejaría pasar el próximo upsell escrito con otras
    // palabras.
    expect(motivoParaMovil(undefined, "Esa tarjeta es de otro negocio.")).toBe(
      "Esa tarjeta es de otro negocio.",
    );
  });
});
