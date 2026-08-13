import { describe, expect, it } from "vitest";
import { contextoDeCuenta, planEfectivo, programaActivoDe } from "./cuenta";

/**
 * Lo que se protege acá es la VENTANA DE TRANSICIÓN de la 0134: entre
 * que este código se despliega y que el dueño pega la migración, el
 * servidor corre código nuevo contra base vieja.
 *
 * Si algo de esto se rompe, el síntoma en producción es que nadie
 * puede agregar su tarjeta al teléfono.
 */

/** Un doble del cliente admin, con solo lo que estas funciones usan. */
function dbFalso(respuestas: {
  cuentas?: { plan: string | null } | null;
  /** Fila por (columna, valor) de programa_lealtad. */
  programaPorCuenta?: Record<string, unknown> | null;
  programaPorRancho?: Record<string, unknown> | null;
}) {
  const consultas: string[] = [];
  const db = {
    from(tabla: string) {
      const filtros: Record<string, unknown> = {};
      const encadenable = {
        select() {
          return encadenable;
        },
        eq(col: string, val: unknown) {
          filtros[col] = val;
          return encadenable;
        },
        async maybeSingle() {
          if (tabla === "cuentas") {
            consultas.push("cuentas");
            return { data: respuestas.cuentas ?? null };
          }
          if ("cuenta_id" in filtros) {
            consultas.push("programa:cuenta");
            return { data: respuestas.programaPorCuenta ?? null };
          }
          consultas.push("programa:rancho");
          return { data: respuestas.programaPorRancho ?? null };
        },
      };
      return encadenable;
    },
  };
  // El doble implementa solo lo que se usa; el cast lo declara.
  return { db: db as never, consultas };
}

describe("planEfectivo", () => {
  it("la cuenta manda sobre el rancho", () => {
    expect(planEfectivo({ planCuenta: "crece", planRancho: "basico" })).toBe("crece");
  });

  it("sin cuenta, cae al rancho — el respaldo de la transición", () => {
    expect(planEfectivo({ planRancho: "basico" })).toBe("basico");
    expect(planEfectivo({ planCuenta: null, planRancho: "basico" })).toBe("basico");
  });

  it("una cuenta SIN plan no deja al negocio sin plan", () => {
    // Es el caso sutil: la cuenta ya existe (0134 corrida) pero todavía
    // no se le asignó plan. Quedarse en null lo dejaría sin topes ni
    // capacidades de un momento a otro, y el dueño no hizo nada.
    expect(planEfectivo({ planCuenta: null, planRancho: "estandar" })).toBe("estandar");
  });

  it("sin nada, null", () => {
    expect(planEfectivo({})).toBeNull();
    expect(planEfectivo({ planCuenta: null, planRancho: null })).toBeNull();
  });
});

describe("contextoDeCuenta", () => {
  it("con la migración corrida, lee el plan de la cuenta", async () => {
    const { db, consultas } = dbFalso({ cuentas: { plan: "pro" } });
    const ctx = await contextoDeCuenta(db, { cuenta_id: "c-1" }, { planRancho: "basico" });
    expect(ctx).toEqual({ cuentaId: "c-1", plan: "pro" });
    expect(consultas).toContain("cuentas");
  });

  it("SIN la migración corrida, no consulta cuentas y usa el rancho", async () => {
    // La fila no trae `cuenta_id` porque la columna no existe todavía.
    const { db, consultas } = dbFalso({});
    const ctx = await contextoDeCuenta(db, { id: "p-1" }, { planRancho: "basico" });
    expect(ctx).toEqual({ cuentaId: null, plan: "basico" });
    expect(consultas).toHaveLength(0);
  });

  it("si la tabla `cuentas` no existe, no revienta: cae al respaldo", async () => {
    // Base a medio migrar: la columna existe, la tabla no responde.
    const { db } = dbFalso({ cuentas: null });
    const ctx = await contextoDeCuenta(db, { cuenta_id: "c-1" }, { planRancho: "basico" });
    expect(ctx.plan).toBe("basico");
    expect(ctx.cuentaId).toBe("c-1");
  });

  it("ignora un cuenta_id vacío o de otro tipo", async () => {
    const { db } = dbFalso({ cuentas: { plan: "pro" } });
    for (const valor of ["", null, undefined, 0, {}]) {
      const ctx = await contextoDeCuenta(db, { cuenta_id: valor }, { planRancho: "basico" });
      expect(ctx.cuentaId).toBeNull();
      expect(ctx.plan).toBe("basico");
    }
  });
});

describe("programaActivoDe", () => {
  it("prefiere la cuenta cuando la hay", async () => {
    const { db, consultas } = dbFalso({
      programaPorCuenta: { id: "p-cuenta" },
      programaPorRancho: { id: "p-rancho" },
    });
    const p = await programaActivoDe(db, { cuentaId: "c-1", ranchoId: "r-1" });
    expect(p).toEqual({ id: "p-cuenta" });
    // Y no gasta una segunda consulta.
    expect(consultas).toEqual(["programa:cuenta"]);
  });

  it("cae al rancho si la cuenta no tiene programa todavía", async () => {
    const { db, consultas } = dbFalso({
      programaPorCuenta: null,
      programaPorRancho: { id: "p-rancho" },
    });
    const p = await programaActivoDe(db, { cuentaId: "c-1", ranchoId: "r-1" });
    expect(p).toEqual({ id: "p-rancho" });
    expect(consultas).toEqual(["programa:cuenta", "programa:rancho"]);
  });

  it("sin cuenta, busca directo por rancho", async () => {
    const { db, consultas } = dbFalso({ programaPorRancho: { id: "p-rancho" } });
    const p = await programaActivoDe(db, { ranchoId: "r-1" });
    expect(p).toEqual({ id: "p-rancho" });
    expect(consultas).toEqual(["programa:rancho"]);
  });

  it("sin cuenta ni rancho, null y sin consultar nada", async () => {
    const { db, consultas } = dbFalso({});
    expect(await programaActivoDe(db, {})).toBeNull();
    expect(consultas).toHaveLength(0);
  });
});
