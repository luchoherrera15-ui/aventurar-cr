import { describe, expect, it, vi } from "vitest";

/**
 * LO QUE ESTAS PRUEBAS DEFIENDEN
 *
 * Dos cosas que, si se rompen, no fallan ruidosamente — fallan callando:
 *
 *   1. QUE UNA REGALÍA NO PUEDA GUARDARSE SIN MOTIVO. Una cortesía sin
 *      explicación es plata que se fue y que nadie va a poder justificar
 *      tres meses después.
 *
 *   2. QUE BAJAR DE PAQUETE AVISE CON NÚMEROS. El caso del encargo —«si
 *      el negocio tiene 300 clientes y lo bajás a uno de 100, ¿qué
 *      pasa?»— tiene que producir un aviso con el 300 y el 100 adentro,
 *      no un texto genérico. Y el caso que PARECE inofensivo —dejarlo
 *      «Sin plan»— tiene que avisar todavía más fuerte, porque quitar el
 *      paquete no apaga nada: lo deja sin ningún tope.
 */

// ── EL PAQUETE RETIRADO QUE HOY NO EXISTE ───────────────────────────
/**
 * `avisosDeCambioDePlan` tiene una rama propia para los paquetes
 * RETIRADOS: avisan que vienen SIN CANDADOS, porque un retirado va sin
 * topes a propósito (a quien ya lo tenía no se le quita lo comprado).
 * Sin ese aviso, un admin le pone «Empresa» a un negocio creyendo que
 * lo sube de categoría y en realidad le suelta todos los topes.
 *
 * El catálogo se quedó sin paquetes retirados el 2026-08-17, así que
 * esa rama ya no se puede alcanzar con un id de verdad. Se inyecta uno
 * inventado —mismo criterio que `prueba.test.ts`— y acá alcanza con
 * mockear `definicionDe`, que es la función que `regalias.ts` LLAMA
 * para mirar `vigente`.
 */
const { PLAN_RETIRADO } = vi.hoisted(() => ({
  PLAN_RETIRADO: "paquete-retirado-solo-del-test",
}));

vi.mock("./planes", async (importOriginal) => {
  const real = await importOriginal<typeof import("./planes")>();
  // Un paquete de los de antes: sin ningún tope y apagado. De todo el
  // objeto, `avisosDeCambioDePlan` lee `nombre`, `vigente`, `limites` y
  // `tipos`.
  const retirado: import("./planes").DefinicionPlan = {
    ...real.PLANES.ilimitado,
    id: PLAN_RETIRADO as import("./planes").PlanId,
    nombre: "Paquete Retirado Del Test",
    vigente: false,
  };
  return {
    ...real,
    definicionDe: (plan: string | null) =>
      plan === PLAN_RETIRADO ? retirado : real.definicionDe(plan),
  };
});

import {
  avisosDeCambioDePlan,
  esConceptoPlan,
  estadoDeCortesia,
  motivoObligatorio,
} from "./regalias";

describe("el concepto de un movimiento de plan", () => {
  it("solo acepta los cuatro que la base acepta", () => {
    expect(esConceptoPlan("venta")).toBe(true);
    expect(esConceptoPlan("cortesia")).toBe(true);
    expect(esConceptoPlan("correccion")).toBe(true);
    expect(esConceptoPlan("baja")).toBe(true);
    // Un valor fuera del CHECK de la 0171 haría fallar el insert entero.
    expect(esConceptoPlan("regalo")).toBe(false);
    expect(esConceptoPlan("")).toBe(false);
  });

  it("la regalía es el único concepto que EXIGE motivo", () => {
    expect(motivoObligatorio("cortesia")).toBe(true);
    expect(motivoObligatorio("venta")).toBe(false);
    expect(motivoObligatorio("correccion")).toBe(false);
    expect(motivoObligatorio("baja")).toBe(false);
  });
});

describe("el estado de una regalía", () => {
  const ahora = new Date("2026-08-17T12:00:00Z");

  it("sin fecha es indefinida y nunca vence", () => {
    expect(estadoDeCortesia(null, ahora)).toEqual({
      indefinida: true,
      vencida: false,
      diasRestantes: null,
    });
  });

  it("cuenta los días que faltan, redondeando hacia abajo", () => {
    // Faltan 3 días y medio: dice 3, nunca 4.
    const e = estadoDeCortesia("2026-08-21T00:00:00Z", ahora);
    expect(e.vencida).toBe(false);
    expect(e.diasRestantes).toBe(3);
  });

  it("una fecha pasada queda vencida", () => {
    expect(estadoDeCortesia("2026-08-01T00:00:00Z", ahora).vencida).toBe(true);
  });

  it("una fecha ilegible NO se convierte en vencida", () => {
    // Sin dato confiable no se toma ninguna decisión: tratarla como
    // vencida haría aparecer un negocio en la bandeja de «hay que
    // cortarle esto» por un dato roto.
    expect(estadoDeCortesia("no es una fecha", ahora)).toEqual({
      indefinida: true,
      vencida: false,
      diasRestantes: null,
    });
  });
});

describe("avisos al cambiar de paquete", () => {
  it("no dice nada si el paquete no cambia", () => {
    expect(
      avisosDeCambioDePlan({
        planActual: "impulso",
        planNuevo: "impulso",
        clientes: 900,
        tarjetas: 2,
      }),
    ).toEqual([]);
  });

  it("el caso del encargo: 300 clientes bajando a un paquete de 100", () => {
    const avisos = avisosDeCambioDePlan({
      planActual: "impulso",
      planNuevo: "arranque",
      clientes: 300,
      tarjetas: 1,
    });
    const clientes = avisos.find((a) => a.id === "clientes");
    expect(clientes).toBeDefined();
    // Los dos números CONCRETOS de este negocio, en el texto.
    expect(clientes?.texto).toContain("300");
    expect(clientes?.texto).toContain("100");
    // Y lo que de verdad pasa: nadie pierde nada, no entran nuevos.
    expect(clientes?.texto).toContain("Nadie pierde su tarjeta");
  });

  it("«Sin plan» avisa que AFLOJA los topes, no que apaga", () => {
    const avisos = avisosDeCambioDePlan({
      planActual: "arranque",
      planNuevo: null,
      clientes: 10,
      tarjetas: 1,
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.id).toBe("sin_plan");
    expect(avisos[0]?.clase).toBe("sin_candado");
    expect(avisos[0]?.texto).toContain("SIN TOPES");
  });

  it("un paquete retirado avisa que viene sin topes", () => {
    const avisos = avisosDeCambioDePlan({
      planActual: "arranque",
      planNuevo: PLAN_RETIRADO,
      clientes: 10,
      tarjetas: 1,
    });
    const retirado = avisos.find((a) => a.id === "retirado");
    expect(retirado, "el aviso de paquete retirado no salió").toBeDefined();
    expect(retirado?.clase).toBe("sin_candado");
    // Con el nombre adentro: «viene sin topes» a secas no le dice a un
    // admin cuál de los dos paquetes de la pantalla es el problema.
    expect(retirado?.texto).toContain("Paquete Retirado Del Test");
  });

  it("y NO lo confunde con «Sin plan», que es otro aviso", () => {
    // Los dos avisan que no hay candados, pero por motivos distintos y
    // con textos distintos: uno es «no le asignaste paquete», el otro es
    // «ese paquete existe pero ya no se vende y viene sin topes».
    const conRetirado = avisosDeCambioDePlan({
      planActual: "arranque",
      planNuevo: PLAN_RETIRADO,
      clientes: 10,
      tarjetas: 1,
    });
    expect(conRetirado.map((a) => a.id)).not.toContain("sin_plan");
    const sinPlan = avisosDeCambioDePlan({
      planActual: "arranque",
      planNuevo: null,
      clientes: 10,
      tarjetas: 1,
    });
    expect(sinPlan.map((a) => a.id)).not.toContain("retirado");
  });

  it("avisa de las tarjetas que sobran y de cuántas hay que archivar", () => {
    const avisos = avisosDeCambioDePlan({
      planActual: "impulso",
      planNuevo: "arranque",
      clientes: 0,
      tarjetas: 5,
    });
    const t = avisos.find((a) => a.id === "tarjetas");
    expect(t?.texto).toContain("5");
    expect(t?.texto).toContain("archivar 3");
  });

  it("no inventa un número de tarjetas cuando no se pudo contar", () => {
    const avisos = avisosDeCambioDePlan({
      planActual: "impulso",
      planNuevo: "arranque",
      clientes: 0,
      tarjetas: null,
    });
    expect(avisos.some((a) => a.id === "tarjetas")).toBe(false);
  });

  it("nombra los tipos de tarjeta que el paquete nuevo ya no arma", () => {
    const avisos = avisosDeCambioDePlan({
      planActual: "impulso",
      planNuevo: "prueba",
      clientes: 0,
      tarjetas: 1,
    });
    const tipos = avisos.find((a) => a.id === "tipos");
    expect(tipos).toBeDefined();
    // Prueba trae sellos, puntos y cashback; los otros cinco se pierden.
    expect(tipos?.texto).toContain("cupón");
  });

  it("subir de paquete no dispara avisos de tope", () => {
    const avisos = avisosDeCambioDePlan({
      planActual: "arranque",
      planNuevo: "ilimitado",
      clientes: 190,
      tarjetas: 2,
    });
    expect(avisos.filter((a) => a.clase === "tope")).toEqual([]);
  });
});
