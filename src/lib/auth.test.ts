import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Autorización sobre un negocio: quién entra al panel y quién no.
 *
 * Lo que estas pruebas cuidan es la SEPARACIÓN entre las dos funciones.
 * `verificarAccesoOperativo` suma al encargado; `verificarAccesoRancho`
 * no, y no debe sumarlo nunca — protege cosas como la cuenta bancaria
 * del negocio. Si alguien las unifica "para simplificar", varias de
 * estas pruebas se ponen en rojo.
 */

const DUENO = "d0000000-0000-4000-8000-00000000000a";
const ADMIN = "d0000000-0000-4000-8000-00000000000b";
const ENCARGADO = "d0000000-0000-4000-8000-00000000000c";
const AJENO = "d0000000-0000-4000-8000-00000000000d";
const RANCHO = "e0000000-0000-4000-8000-000000000001";
const OTRO_RANCHO = "e0000000-0000-4000-8000-000000000002";

type Escenario = {
  /** null = sin sesión. */
  usuario?: string | null;
  /** null = el rancho no existe. */
  dueno?: string | null;
  rol?: string;
  /** Filas de rancho_colaboradores visibles para este usuario. */
  colaboraciones?: { rancho_id: string; usuario_id: string }[];
  /** Simula que la consulta de colaboradores falla. */
  fallaColaboradores?: boolean;
  /** Simula que la consulta del rancho falla. */
  fallaRancho?: boolean;
};

let escenario: Escenario = {};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: escenario.usuario === null ? null : { id: escenario.usuario ?? DUENO } },
      }),
    },
    from(tabla: string) {
      const filtros: Record<string, string> = {};
      const constructor = {
        select: () => constructor,
        eq(col: string, val: string) {
          filtros[col] = val;
          return constructor;
        },
        async maybeSingle() {
          if (tabla === "ranchos") {
            if (escenario.fallaRancho) return { data: null, error: { message: "boom" } };
            return {
              data: escenario.dueno === null ? null : { owner_id: escenario.dueno ?? DUENO },
              error: null,
            };
          }
          if (tabla === "perfiles") {
            return { data: { rol: escenario.rol ?? "dueno_rancho" }, error: null };
          }
          if (tabla === "rancho_colaboradores") {
            if (escenario.fallaColaboradores) {
              return { data: null, error: { message: "relation does not exist" } };
            }
            const fila = (escenario.colaboraciones ?? []).find(
              (c) => c.rancho_id === filtros.rancho_id && c.usuario_id === filtros.usuario_id,
            );
            return { data: fila ?? null, error: null };
          }
          return { data: null, error: null };
        },
        async single() {
          return constructor.maybeSingle();
        },
      };
      return constructor;
    },
  }),
}));

vi.mock("@/lib/supabase/bearer", () => ({ sesionDesdeBearer: async () => null }));

import { verificarAccesoOperativo, verificarAccesoRancho } from "./auth";

beforeEach(() => {
  escenario = {};
});

// ============================================================
// Quién SÍ entra al panel operativo
// ============================================================

describe("acceso operativo: quién entra", () => {
  it("el dueño entra, y no se lo trata como encargado", async () => {
    escenario = { usuario: DUENO, dueno: DUENO };
    const r = await verificarAccesoOperativo(RANCHO);
    expect(r.ok).toBe(true);
    expect(r.esColaborador).toBe(false);
    expect(r.esAdmin).toBe(false);
  });

  it("un admin de plataforma entra a cualquier negocio", async () => {
    escenario = { usuario: ADMIN, dueno: DUENO, rol: "admin" };
    const r = await verificarAccesoOperativo(RANCHO);
    expect(r.ok).toBe(true);
    expect(r.esAdmin).toBe(true);
    expect(r.esColaborador).toBe(false);
  });

  it("un encargado del negocio entra, y queda marcado como tal", async () => {
    escenario = {
      usuario: ENCARGADO,
      dueno: DUENO,
      rol: "cliente",
      colaboraciones: [{ rancho_id: RANCHO, usuario_id: ENCARGADO }],
    };
    const r = await verificarAccesoOperativo(RANCHO);
    expect(r.ok).toBe(true);
    expect(r.esColaborador).toBe(true);
    // Ser encargado NO lo convierte en admin de plataforma.
    expect(r.esAdmin).toBe(false);
  });

  it("al dueño no se le consulta la tabla de encargados", async () => {
    // No es una optimización cosmética: si el dueño dependiera de esa
    // consulta, un fallo ahí lo dejaría afuera de su propio negocio.
    escenario = { usuario: DUENO, dueno: DUENO, fallaColaboradores: true };
    const r = await verificarAccesoOperativo(RANCHO);
    expect(r.ok).toBe(true);
  });
});

// ============================================================
// Quién NO entra
// ============================================================

describe("acceso operativo: quién queda afuera", () => {
  it("sin sesión, no entra", async () => {
    escenario = { usuario: null };
    const r = await verificarAccesoOperativo(RANCHO);
    expect(r.ok).toBe(false);
    expect(r.esColaborador).toBe(false);
  });

  it("un usuario sin ninguna relación no entra", async () => {
    escenario = { usuario: AJENO, dueno: DUENO, rol: "cliente", colaboraciones: [] };
    const r = await verificarAccesoOperativo(RANCHO);
    expect(r.ok).toBe(false);
  });

  it("un encargado de OTRO negocio no entra a este", async () => {
    escenario = {
      usuario: ENCARGADO,
      dueno: DUENO,
      rol: "cliente",
      colaboraciones: [{ rancho_id: OTRO_RANCHO, usuario_id: ENCARGADO }],
    };
    const r = await verificarAccesoOperativo(RANCHO);
    expect(r.ok).toBe(false);
    expect(r.esColaborador).toBe(false);
  });

  it("quitar a un encargado le corta el acceso de inmediato", async () => {
    // Revocar es borrar la fila: no hay estado intermedio que limpiar.
    escenario = {
      usuario: ENCARGADO,
      dueno: DUENO,
      rol: "cliente",
      colaboraciones: [{ rancho_id: RANCHO, usuario_id: ENCARGADO }],
    };
    expect((await verificarAccesoOperativo(RANCHO)).ok).toBe(true);

    escenario.colaboraciones = [];
    expect((await verificarAccesoOperativo(RANCHO)).ok).toBe(false);
  });

  it("si el negocio no existe, nadie entra", async () => {
    escenario = { usuario: ENCARGADO, dueno: null, rol: "cliente", colaboraciones: [] };
    expect((await verificarAccesoOperativo(RANCHO)).ok).toBe(false);
  });
});

// ============================================================
// Falla cerrada
// ============================================================

describe("ante un error, se niega el acceso", () => {
  it("si la consulta de encargados falla, NO se concede", async () => {
    // Cubre el caso real de que la 0116 no se haya corrido en ese
    // entorno: la tabla no existe, la consulta devuelve error, y la
    // respuesta correcta es "no" y no "no pude comprobarlo, pasá".
    escenario = {
      usuario: ENCARGADO,
      dueno: DUENO,
      rol: "cliente",
      fallaColaboradores: true,
      colaboraciones: [{ rancho_id: RANCHO, usuario_id: ENCARGADO }],
    };
    const r = await verificarAccesoOperativo(RANCHO);
    expect(r.ok).toBe(false);
    expect(r.esColaborador).toBe(false);
  });

  it("si la consulta del negocio falla, tampoco se concede", async () => {
    escenario = { usuario: DUENO, dueno: DUENO, fallaRancho: true };
    expect((await verificarAccesoOperativo(RANCHO)).ok).toBe(false);
  });
});

// ============================================================
// Lo exclusivo sigue siendo exclusivo
// ============================================================

describe("operaciones reservadas al dueño", () => {
  it("un encargado NO pasa verificarAccesoRancho", async () => {
    // Esta es la prueba que impide la escalada de privilegios. Esa
    // función protege, entre otras, `guardarCuentasPagoPropio` — la
    // cuenta bancaria donde entra la plata del negocio.
    escenario = {
      usuario: ENCARGADO,
      dueno: DUENO,
      rol: "cliente",
      colaboraciones: [{ rancho_id: RANCHO, usuario_id: ENCARGADO }],
    };
    const exclusiva = await verificarAccesoRancho(RANCHO);
    expect(exclusiva.ok).toBe(false);

    // Y el mismo usuario, en el mismo negocio, SÍ pasa la operativa.
    const operativa = await verificarAccesoOperativo(RANCHO);
    expect(operativa.ok).toBe(true);
  });

  it("el dueño y el admin sí pasan la exclusiva", async () => {
    escenario = { usuario: DUENO, dueno: DUENO };
    expect((await verificarAccesoRancho(RANCHO)).ok).toBe(true);

    escenario = { usuario: ADMIN, dueno: DUENO, rol: "admin" };
    expect((await verificarAccesoRancho(RANCHO)).ok).toBe(true);
  });

  it("la frontera del depósito: confirmarlo sí, tocar la plata no", async () => {
    // Regla del dueño: «pueden revisar y confirmar depósitos pero no
    // cambiar métodos de pago».
    //
    // Confirmar un adelanto (`marcarDepositoRecibido`, finanzas, y
    // `marcarDepositoValidadoRancho`, reservas) usa la OPERATIVA.
    // Registrar el pago final, devolver un adelanto, cargar gastos y
    // cambiar las cuentas de cobro usan la EXCLUSIVA.
    escenario = {
      usuario: ENCARGADO,
      dueno: DUENO,
      rol: "cliente",
      colaboraciones: [{ rancho_id: RANCHO, usuario_id: ENCARGADO }],
    };

    // Lo que el encargado SÍ puede hacer.
    expect((await verificarAccesoOperativo(RANCHO)).ok).toBe(true);
    // Lo que NO: es la misma comprobación que usan cuentas de pago,
    // precios, gastos y el pago final.
    expect((await verificarAccesoRancho(RANCHO)).ok).toBe(false);
  });

  it("verificarAccesoRancho ni siquiera consulta la tabla de encargados", async () => {
    // Si algún día alguien le agrega el encargado a ESTA función, este
    // escenario —consulta rota pero colaboración existente— empezaría a
    // conceder acceso y la prueba se pondría en rojo.
    escenario = {
      usuario: ENCARGADO,
      dueno: DUENO,
      rol: "cliente",
      fallaColaboradores: true,
      colaboraciones: [{ rancho_id: RANCHO, usuario_id: ENCARGADO }],
    };
    expect((await verificarAccesoRancho(RANCHO)).ok).toBe(false);
  });
});
