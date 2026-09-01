import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ESTADOS_SUSCRIPCION,
  PLANES_CON_COBRO,
  daDerechoAlPlan,
  esPeriodo,
  esPlanConCobro,
  estadoDesdeStripe,
  mapaDePrecios,
  planDePrecio,
  planesConPrecio,
  precioDePlan,
  variableDePrecio,
  type Entorno,
} from "./precios";
import { PLANES } from "@/lib/lealtad/planes";

/**
 * El mapeo price→plan es lo que decide QUÉ paquete se le activa a
 * alguien que acaba de pagar. Un error acá no se ve en pantalla: se ve
 * en la factura de otro.
 */

const ENTORNO: Entorno = {
  STRIPE_PRICE_ARRANQUE_MENSUAL: "price_arranque_mes",
  STRIPE_PRICE_ARRANQUE_ANUAL: "price_arranque_anio",
  STRIPE_PRICE_IMPULSO_MENSUAL: "price_impulso_mes",
  STRIPE_PRICE_ILIMITADO_MENSUAL: "  price_ilimitado_mes  ",
  // Declarada y vacía, como la deja .env.example sin llenar.
  STRIPE_PRICE_ILIMITADO_ANUAL: "",
};

describe("el catálogo de lo que se cobra", () => {
  it("son los paquetes ofrecidos que cuestan algo", () => {
    // «ilimitado» salió el 1 sep 2026: al retirarlo de
    // `PLANES_OFRECIDOS`, deja de cobrarse solo — este catálogo se
    // deriva de ahí y no de una lista propia.
    expect([...PLANES_CON_COBRO]).toEqual(["arranque", "impulso"]);
  });

  it("el plan de $0 NUNCA entra: se activa solo, sin pasar por Stripe", () => {
    // Es una regla explícita del dueño y el alta automática de
    // /lealtad/nuevo depende de ella (`crearGratisAlInstante` se
    // dispara con precioMensual === 0).
    expect(PLANES.prueba.precioMensual).toBe(0);
    expect(esPlanConCobro("prueba")).toBe(false);
    for (const id of PLANES_CON_COBRO) {
      expect(PLANES[id].precioMensual ?? 0).toBeGreaterThan(0);
    }
  });

  it("lo que no está en el catálogo tampoco se puede comprar", () => {
    // Los ocho paquetes retirados de catálogos anteriores se borraron
    // en la 0179: hoy son ids desconocidos como cualquier otro. Si
    // alguno volviera —o se retirara uno de los tres de pago— el que
    // decide sigue siendo `PLANES_CON_COBRO`, y por eso se prueban acá
    // con nombre y apellido.
    expect(esPlanConCobro("pro")).toBe(false);
    expect(esPlanConCobro("empresa")).toBe(false);
    expect(esPlanConCobro("gratis")).toBe(false);
    expect(esPlanConCobro("basico")).toBe(false);
    expect(esPlanConCobro("no-existe")).toBe(false);
    expect(esPlanConCobro(null)).toBe(false);
  });
});

describe("los nombres de las variables", () => {
  it("son los seis que dice .env.example", () => {
    expect(variableDePrecio("arranque", "mensual")).toBe("STRIPE_PRICE_ARRANQUE_MENSUAL");
    expect(variableDePrecio("ilimitado", "anual")).toBe("STRIPE_PRICE_ILIMITADO_ANUAL");
  });

  it("el archivo de ejemplo declara exactamente esas seis", () => {
    // Si mañana se agrega un paquete de pago, este test obliga a
    // declarar su variable donde el dueño la va a buscar.
    const ejemplo = readFileSync(path.join(raizDelRepo(), ".env.example"), "utf8");
    for (const plan of PLANES_CON_COBRO) {
      for (const periodo of ["mensual", "anual"] as const) {
        expect(ejemplo).toContain(`${variableDePrecio(plan, periodo)}=`);
      }
    }
  });
});

describe("del plan al precio", () => {
  it("lee la variable que toca", () => {
    expect(precioDePlan("arranque", "mensual", ENTORNO)).toBe("price_arranque_mes");
    expect(precioDePlan("arranque", "anual", ENTORNO)).toBe("price_arranque_anio");
  });

  it("limpia los espacios de un copiar y pegar", () => {
    expect(precioDePlan("ilimitado", "mensual", ENTORNO)).toBe("price_ilimitado_mes");
  });

  it("una variable declarada pero VACÍA es como si no estuviera", () => {
    // .env.example las deja todas vacías. Sin esto, la sesión de
    // Checkout se crearía con un precio "" y el mapa de vuelta haría
    // calzar cualquier evento sin precio con el primer paquete.
    expect(precioDePlan("ilimitado", "anual", ENTORNO)).toBeNull();
    expect(precioDePlan("impulso", "anual", ENTORNO)).toBeNull();
  });
});

describe("del precio al plan — el camino que activa", () => {
  it("devuelve el paquete y el período", () => {
    expect(planDePrecio("price_impulso_mes", ENTORNO)).toEqual({
      plan: "impulso",
      periodo: "mensual",
    });
    expect(planDePrecio("price_arranque_anio", ENTORNO)).toEqual({
      plan: "arranque",
      periodo: "anual",
    });
  });

  it("un precio desconocido no calza con nada", () => {
    // El caso real: el dueño crea un precio en Stripe y todavía no
    // puso la variable. NO puede terminar activando un paquete al azar.
    expect(planDePrecio("price_que_nadie_configuro", ENTORNO)).toBeNull();
  });

  it("ni el vacío, ni el null, ni los espacios", () => {
    expect(planDePrecio("", ENTORNO)).toBeNull();
    expect(planDePrecio(null, ENTORNO)).toBeNull();
    expect(planDePrecio(undefined, ENTORNO)).toBeNull();
    expect(planDePrecio("   ", ENTORNO)).toBeNull();
  });

  it("el mapa solo tiene los precios de verdad", () => {
    expect([...mapaDePrecios(ENTORNO).keys()].sort()).toEqual([
      "price_arranque_anio",
      "price_arranque_mes",
      "price_impulso_mes",
    ]);
  });

  it("ida y vuelta: todo precio configurado vuelve a su propio plan", () => {
    for (const { plan, periodos } of planesConPrecio(ENTORNO)) {
      for (const periodo of periodos) {
        const precio = precioDePlan(plan, periodo, ENTORNO);
        expect(planDePrecio(precio, ENTORNO)).toEqual({ plan, periodo });
      }
    }
  });
});

describe("SIN NINGUNA LLAVE CONFIGURADA — el SINPE tiene que seguir", () => {
  const vacio: Entorno = {};

  it("no hay nada que cobrar con tarjeta, y nada explota", () => {
    expect(planesConPrecio(vacio)).toEqual([]);
    expect(mapaDePrecios(vacio).size).toBe(0);
    expect(planDePrecio("price_lo_que_sea", vacio)).toBeNull();
    expect(precioDePlan("impulso", "mensual", vacio)).toBeNull();
  });

  it("el catálogo de paquetes sigue existiendo igual", () => {
    // Que no se pueda pagar con tarjeta no puede borrar los paquetes:
    // se siguen mostrando y se siguen pidiendo por SINPE.
    expect(PLANES_CON_COBRO.length).toBe(2);
  });

  it("/lealtad/planes no le pasa NI UN período a ningún paquete", () => {
    // Es lo que apaga el bloque de tarjeta de la página de paquetes:
    // `periodosConTarjeta` llega vacío para los cuatro y la pantalla
    // queda exactamente como era antes de Stripe — solo SINPE, sin
    // botones muertos.
    const porPlan = new Map(planesConPrecio(vacio).map((p) => [p.plan, p.periodos]));
    for (const plan of PLANES_CON_COBRO) {
      expect(porPlan.get(plan) ?? []).toEqual([]);
    }
  });
});

describe("qué paquetes muestran botón de tarjeta", () => {
  it("solo los que tienen precio, con los períodos que tengan", () => {
    expect(planesConPrecio(ENTORNO)).toEqual([
      { plan: "arranque", periodos: ["mensual", "anual"] },
      { plan: "impulso", periodos: ["mensual"] },
    ]);
  });
});

describe("los estados de Stripe, traducidos", () => {
  it("los que dan derecho al plan", () => {
    expect(estadoDesdeStripe("active")).toBe("activa");
    expect(estadoDesdeStripe("trialing")).toBe("en_prueba");
    expect(daDerechoAlPlan("activa")).toBe(true);
    expect(daDerechoAlPlan("en_prueba")).toBe(true);
  });

  it("los que no", () => {
    expect(estadoDesdeStripe("past_due")).toBe("morosa");
    expect(estadoDesdeStripe("unpaid")).toBe("morosa");
    expect(estadoDesdeStripe("incomplete")).toBe("morosa");
    expect(estadoDesdeStripe("canceled")).toBe("cancelada");
    expect(estadoDesdeStripe("incomplete_expired")).toBe("cancelada");
    expect(estadoDesdeStripe("paused")).toBe("cancelada");
    expect(daDerechoAlPlan("morosa")).toBe(false);
    expect(daDerechoAlPlan("cancelada")).toBe(false);
  });

  it("un estado que Stripe invente mañana NO activa nada", () => {
    // Cuando la duda cuesta plata, la duda no activa.
    expect(estadoDesdeStripe("algo_nuevo_de_stripe")).toBe("morosa");
    expect(estadoDesdeStripe(null)).toBe("morosa");
    expect(estadoDesdeStripe(undefined)).toBe("morosa");
    expect(daDerechoAlPlan(estadoDesdeStripe("algo_nuevo_de_stripe"))).toBe(false);
  });

  it("los cuatro estados son los que la base acepta", () => {
    const sql = leerMigracion("0143_suscripciones_stripe.sql");
    const permitidos = idsDelCheck(sql, "suscripciones_estado_check");
    expect([...ESTADOS_SUSCRIPCION].sort()).toEqual(permitidos.sort());
  });
});

describe("periodos", () => {
  it("son dos y nada más", () => {
    expect(esPeriodo("mensual")).toBe(true);
    expect(esPeriodo("anual")).toBe(true);
    expect(esPeriodo("semanal")).toBe(false);
    expect(esPeriodo(null)).toBe(false);
  });

  it("los que la base acepta", () => {
    const permitidos = idsDelCheck(
      leerMigracion("0143_suscripciones_stripe.sql"),
      "suscripciones_periodo_check",
    );
    expect(permitidos.sort()).toEqual(["anual", "mensual"]);
  });
});

/**
 * ------------------------------------------------------------------
 * EL PLAN QUE SE ESCRIBE TIENE QUE PASAR EL CHECK DE LA BASE
 * ------------------------------------------------------------------
 * El webhook toma el plan del mapeo y lo escribe en
 * `ranchos.plan_lealtad` y `cuentas.plan`. Si el mapeo pudiera
 * devolver un id que el CHECK no acepta, el update fallaría DESPUÉS de
 * que el cobro entró: plata cobrada y paquete sin activar, que es el
 * peor de los dos mundos.
 *
 * Por eso los ids se leen del SQL de verdad y no de una copia.
 */
describe("el plan mapeado entra en la base", () => {
  const idsDeRanchos = idsDelCheck(
    leerMigracion("0141_paquetes_de_lealtad.sql"),
    "ranchos_plan_lealtad_check",
  );
  const idsDeSuscripciones = idsDelCheck(
    leerMigracion("0143_suscripciones_stripe.sql"),
    "suscripciones_plan_check",
  );

  it("todo lo cobrable lo acepta `ranchos.plan_lealtad` (0141)", () => {
    for (const plan of PLANES_CON_COBRO) expect(idsDeRanchos).toContain(plan);
  });

  it("todo lo cobrable lo acepta `suscripciones.plan` (0143)", () => {
    for (const plan of PLANES_CON_COBRO) expect(idsDeSuscripciones).toContain(plan);
  });

  it("las dos listas son la MISMA — si se desincronizan, se cobra sin activar", () => {
    expect(idsDeSuscripciones.sort()).toEqual(idsDeRanchos.sort());
  });
});

// ── Utilidades del test ───────────────────────────────────────────────

function raizDelRepo(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function leerMigracion(nombre: string): string {
  return readFileSync(path.join(raizDelRepo(), "supabase", "migrations", nombre), "utf8");
}

/**
 * Los valores entre comillas de un `add constraint <nombre> check (…)`.
 * Se corta en el `;` que cierra la sentencia.
 */
function idsDelCheck(sql: string, constraint: string): string[] {
  const desde = sql.indexOf(`add constraint ${constraint}`);
  if (desde < 0) throw new Error(`No se encontró el CHECK ${constraint} en la migración.`);
  const hasta = sql.indexOf(";", desde);
  const bloque = sql.slice(desde, hasta);
  return [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}
