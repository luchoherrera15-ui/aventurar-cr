import { describe, expect, it } from "vitest";
import { describirCondicion, evaluarCondiciones, validarCondicion, valorDeCampo } from "./condiciones";
import { condicionesParaModo } from "./catalogo";
import { contextoDeEjemplo } from "./mensaje";
import type { Condicion, ContextoCliente } from "./tipos";

const ctx = (extra: Partial<ContextoCliente> = {}): ContextoCliente => ({ ...contextoDeEjemplo("sellos"), ...extra });

describe("valorDeCampo", () => {
  it("lee datos reales del cliente", () => {
    const c = ctx({ visitas: 7, saldo: 3, canjes: 2, diasSinActividad: 12, antiguedadDias: 90, plataformas: ["apple"] });
    expect(valorDeCampo("visitas", c)).toBe(7);
    expect(valorDeCampo("saldo", c)).toBe(3);
    expect(valorDeCampo("canjes", c)).toBe(2);
    expect(valorDeCampo("dias_sin_actividad", c)).toBe(12);
    expect(valorDeCampo("antiguedad_dias", c)).toBe(90);
    expect(valorDeCampo("tiene_pase", c)).toBe(true);
  });
  it("nuevo hasta una visita, recurrente desde dos", () => {
    expect(valorDeCampo("cliente", ctx({ visitas: 0 }))).toBe("nuevo");
    expect(valorDeCampo("cliente", ctx({ visitas: 1 }))).toBe("nuevo");
    expect(valorDeCampo("cliente", ctx({ visitas: 2 }))).toBe("recurrente");
  });
  it("premio listo = el saldo alcanza para la meta", () => {
    expect(valorDeCampo("recompensa_disponible", ctx({ saldo: 5, meta: 5 }))).toBe(true);
    expect(valorDeCampo("recompensa_disponible", ctx({ saldo: 4, meta: 5 }))).toBe(false);
    expect(valorDeCampo("recompensa_disponible", ctx({ saldo: 99, meta: null }))).toBe(false);
  });
  it("sin pase en el Wallet", () => {
    expect(valorDeCampo("tiene_pase", ctx({ plataformas: [] }))).toBe(false);
  });
});

describe("evaluarCondiciones", () => {
  const c = ctx({ visitas: 4, saldo: 3 });
  it("sin condiciones siempre cumple", () => {
    expect(evaluarCondiciones([], c)).toEqual({ cumple: true });
  });
  it("todas tienen que cumplirse (Y)", () => {
    const a: Condicion = { campo: "visitas", op: "gte", valor: 3 };
    const b: Condicion = { campo: "saldo", op: "lte", valor: 3 };
    expect(evaluarCondiciones([a, b], c).cumple).toBe(true);
    const r = evaluarCondiciones([a, { campo: "saldo", op: "gte", valor: 4 }], c);
    expect(r.cumple).toBe(false);
    if (!r.cumple) expect(r.motivo).toBe("Sellos actuales es al menos 4");
  });
  it("igual y comparaciones de borde", () => {
    expect(evaluarCondiciones([{ campo: "visitas", op: "eq", valor: 4 }], c).cumple).toBe(true);
    expect(evaluarCondiciones([{ campo: "visitas", op: "gte", valor: 4 }], c).cumple).toBe(true);
    expect(evaluarCondiciones([{ campo: "visitas", op: "lte", valor: 3 }], c).cumple).toBe(false);
  });
  it("lo que no se puede saber NO se cumple (quien nunca vino no tiene días sin venir)", () => {
    expect(evaluarCondiciones([{ campo: "dias_sin_actividad", op: "gte", valor: 0 }], ctx({ diasSinActividad: null })).cumple).toBe(false);
  });
  it("booleanos y opciones", () => {
    expect(evaluarCondiciones([{ campo: "tiene_pase", op: "es", valor: true }], ctx({ plataformas: ["google"] })).cumple).toBe(true);
    expect(evaluarCondiciones([{ campo: "tiene_pase", op: "es", valor: true }], ctx({ plataformas: [] })).cumple).toBe(false);
    expect(evaluarCondiciones([{ campo: "cliente", op: "es", valor: "recurrente" }], ctx({ visitas: 5 })).cumple).toBe(true);
  });
  it("un tipo equivocado no cumple en vez de lanzar", () => {
    expect(evaluarCondiciones([{ campo: "visitas", op: "gte", valor: "mucho" }], c).cumple).toBe(false);
  });
});

describe("describirCondicion", () => {
  it("usa el nombre según el tipo de tarjeta", () => {
    expect(describirCondicion({ campo: "saldo", op: "gte", valor: 3 }, "sellos")).toBe("Sellos actuales es al menos 3");
    expect(describirCondicion({ campo: "saldo", op: "gte", valor: 3 }, "puntos")).toBe("Puntos disponibles es al menos 3");
    expect(describirCondicion({ campo: "tiene_pase", op: "es", valor: true }, "sellos")).toBe("Tiene la tarjeta en el Wallet es sí");
    expect(describirCondicion({ campo: "cliente", op: "es", valor: "nuevo" }, "sellos")).toBe("Tipo de cliente es Cliente nuevo");
  });
});

describe("validarCondicion", () => {
  it("acepta una bien formada", () => {
    expect(validarCondicion({ campo: "visitas", op: "gte", valor: 3 }, "sellos")).toBeNull();
  });
  it("rechaza lo que no existe, lo mal tipado y lo fuera de rango", () => {
    expect(validarCondicion({ campo: "nivel" as never, op: "gte", valor: 1 }, "sellos")).toMatch(/no existe/);
    expect(validarCondicion({ campo: "visitas", op: "es", valor: 3 }, "sellos")).toMatch(/comparación/);
    expect(validarCondicion({ campo: "visitas", op: "gte", valor: 1.5 }, "sellos")).toMatch(/entero/);
    expect(validarCondicion({ campo: "visitas", op: "gte", valor: -1 }, "sellos")).toMatch(/menor/);
    expect(validarCondicion({ campo: "tiene_pase", op: "es", valor: "si" }, "sellos")).toMatch(/sí o no/);
    expect(validarCondicion({ campo: "cliente", op: "es", valor: "vip" }, "sellos")).toMatch(/opción/);
  });
});

describe("el catálogo no ofrece condiciones que no se pueden evaluar", () => {
  it("no hay nivel, gasto total ni ticket promedio", () => {
    const ids = condicionesParaModo("sellos").map((c) => c.id as string);
    for (const prohibida of ["nivel", "gasto_total", "ticket_promedio", "cercania"]) {
      expect(ids).not.toContain(prohibida);
    }
  });
  it("todas las que se ofrecen se pueden evaluar", () => {
    for (const def of condicionesParaModo("sellos")) {
      expect(valorDeCampo(def.id, ctx())).not.toBeUndefined();
    }
  });
});
