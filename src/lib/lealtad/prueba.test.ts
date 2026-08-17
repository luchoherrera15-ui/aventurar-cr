import { describe, expect, it, vi } from "vitest";

/**
 * EL PAQUETE GRATIS YA NO VENCE — Y LA MAQUINARIA DEL CORTE SIGUE ENTERA.
 *
 * ------------------------------------------------------------------
 * LO QUE CAMBIÓ, Y POR QUÉ ESTO NO SE BORRA
 * ------------------------------------------------------------------
 * El paquete gratis era una prueba de 14 días. Ahora es gratis y
 * PERMANENTE: topes chicos (5 clientes, 1 tarjeta, 1 persona) pero sin
 * fecha de corte. En el catálogo eso es `diasPrueba: 0`, y con ese cero
 * el módulo entero se apaga solo — `finDePrueba` devuelve null, o sea
 * `vence_en: null`, que es lo que `tiene_addon()` (0077) lee como «para
 * siempre».
 *
 * Con eso NINGÚN paquete del catálogo tiene días de prueba, así que
 * `estadoDePrueba` no puede contestar `esPrueba: true` para ningún plan
 * real: la puerta de entrada es `definicionDe(plan).diasPrueba > 0`.
 *
 * Por eso las pruebas de este archivo son de DOS clases, y la diferencia
 * es la que manda:
 *
 *   1. LA DECISIÓN DE PRODUCTO — «el gratis no vence». Se comprueba
 *      contra el catálogo DE VERDAD, porque lo que se está fijando es
 *      justamente lo que el catálogo dice.
 *
 *   2. LA MECÁNICA DEL VENCIMIENTO — que el corte caiga en el minuto
 *      exacto, que los días se redondeen hacia abajo, que el aviso se
 *      encienda en su ventana, que el texto diga «1 día» y no «1 días».
 *      Ese código sigue en producción, es correcto, y va a hacer falta
 *      el día que exista un paquete PAGO con prueba. Se comprueba con un
 *      paquete inventado acá abajo, no con uno del catálogo: es lógica
 *      de fechas y de plata, y quedarse sin esa red de seguridad porque
 *      cambió un número de producto sería el peor negocio posible.
 */

// ── EL PAQUETE CON PRUEBA QUE HOY NO EXISTE ─────────────────────────
/**
 * `estadoDePrueba` recibe el `venceEn` directo, pero eso NO alcanza para
 * llegar a la mecánica: antes de mirar la fecha le pregunta al catálogo
 * si el plan tiene días de prueba, y hoy ninguno los tiene. Sin un plan
 * con días, media función es inalcanzable desde afuera.
 *
 * Por eso se inyecta lo MÍNIMO —`definicionDe` y `esPlanSinCosto`, y
 * solo para un id que no existe en ninguna parte—: todo el resto de
 * `planes.ts` sigue siendo el de verdad, y los casos que hablan del
 * catálogo lo consultan sin intermediarios.
 *
 * Es el camino que menos ata estas pruebas al catálogo, que es la única
 * lección que dejó este cambio: las pruebas de la mecánica apuntaban a
 * `"prueba"` con sus 14 días, y el día que el dueño movió un número de
 * PRODUCTO se cayeron nueve pruebas de MECÁNICA que seguían siendo
 * ciertas. Con la entrada escrita acá, mover días, precios o topes no
 * las toca.
 */
const { PLAN_CON_PRUEBA, DIAS_DE_LA_PRUEBA } = vi.hoisted(() => ({
  PLAN_CON_PRUEBA: "paquete-con-prueba-solo-del-test",
  DIAS_DE_LA_PRUEBA: 14,
}));

vi.mock("./planes", async (importOriginal) => {
  const real = await importOriginal<typeof import("./planes")>();
  // El paquete gratis con los días que tenía antes de la decisión: la
  // forma exacta que va a tener un paquete con prueba el día que exista.
  // De todo el objeto, `prueba.ts` solo lee `diasPrueba`.
  const conPrueba = { ...real.PLANES.prueba, diasPrueba: DIAS_DE_LA_PRUEBA };
  return {
    ...real,
    definicionDe: (plan: string | null) =>
      plan === PLAN_CON_PRUEBA ? conPrueba : real.definicionDe(plan),
    esPlanSinCosto: (plan: string | null) =>
      plan === PLAN_CON_PRUEBA ? true : real.esPlanSinCosto(plan),
  };
});

import {
  DIAS_AVISO_PREVIO,
  estadoDePrueba,
  esPruebaSinCosto,
  finDePrueba,
  textoRestante,
} from "./prueba";
import { PLANES, PLANES_OFRECIDOS } from "./planes";

const UN_DIA = 24 * 60 * 60 * 1000;

/** Un instante fijo, para que las pruebas no dependan del reloj. */
const ALTA = new Date("2026-08-13T15:30:00.000Z");

describe("finDePrueba", () => {
  it("el paquete gratis NO nace con fecha de corte: es gratis y punto", () => {
    // LA DECISIÓN, escrita como prueba: «el plan gratuito no tiene
    // vencimiento». Ese null es el que se guarda en
    // `addons_negocio.vence_en`, y null ahí significa «para siempre»
    // para `tiene_addon()`. O sea que el alta nueva nace sin corte sin
    // que haga falta un `if` en ninguna pantalla.
    expect(PLANES.prueba.diasPrueba).toBe(0);
    expect(finDePrueba("prueba", ALTA)).toBeNull();
  });

  it("HOY no vence ninguno: el catálogo entero nace sin corte", () => {
    for (const id of PLANES_OFRECIDOS) {
      expect(finDePrueba(id, ALTA), `${id} nace con fecha de corte`).toBeNull();
    }
  });

  it("los paquetes de PAGO no vencen por tiempo", () => {
    // `null` es lo que `tiene_addon()` lee como «sin vencimiento», que
    // es lo correcto para algo que se cobra por mes.
    for (const id of ["arranque", "impulso", "ilimitado"] as const) {
      expect(finDePrueba(id, ALTA), id).toBeNull();
    }
  });

  it("un plan que el catálogo no conoce tampoco vence", () => {
    // Sin definición no hay días de prueba, así que no hay corte que
    // escribir. Es la doctrina de siempre —un dato raro no apaga a
    // nadie— y desde la 0179 incluye a los ocho paquetes que se
    // borraron: hoy son ids desconocidos como cualquier otro.
    expect(finDePrueba("gratis", ALTA)).toBeNull();
    expect(finDePrueba("basico", ALTA)).toBeNull();
    expect(finDePrueba(null, ALTA)).toBeNull();
    expect(finDePrueba("premium", ALTA)).toBeNull();
  });

  it("un paquete CON días corta a la MISMA HORA del reloj, N días después", () => {
    // MECÁNICA. Se suman milisegundos y no «meses de calendario» a
    // propósito: Costa Rica no tiene horario de verano, así que 14 × 24 h
    // son exactamente 14 días y el corte cae a la misma hora en que se
    // dio de alta. Quien se registró a las 11 de la noche no pierde ni
    // gana medio día.
    const fin = finDePrueba(PLAN_CON_PRUEBA, ALTA);
    expect(fin).not.toBeNull();
    expect(new Date(fin!).getTime() - ALTA.getTime()).toBe(DIAS_DE_LA_PRUEBA * UN_DIA);
    expect(fin).toBe("2026-08-27T15:30:00.000Z");
  });

  it("el catálogo entero está de acuerdo con esta función", () => {
    // Hoy la primera rama no se ejecuta para ningún paquete, y está
    // bien: el día que el catálogo vuelva a tener uno con días, esta
    // prueba exige que nazca con corte sin que haya que tocarla.
    for (const id of PLANES_OFRECIDOS) {
      const fin = finDePrueba(id, ALTA);
      if (PLANES[id].diasPrueba > 0) {
        expect(fin, `${id} promete días de prueba y no vence`).not.toBeNull();
      } else {
        expect(fin, `${id} no es una prueba y sin embargo vence`).toBeNull();
      }
    }
  });
});

describe("esPruebaSinCosto", () => {
  it("hoy NADIE nace con corte: el gratis es gratis, no una prueba", () => {
    // La función pregunta dos cosas a la vez —sin costo Y con días— y
    // el paquete gratis ya solo cumple la primera. Que conteste `false`
    // es lo que hace que el alta automática lo guarde sin vencimiento.
    expect(esPruebaSinCosto("prueba")).toBe(false);
    expect(esPruebaSinCosto("arranque")).toBe(false);
    // Un id que el catálogo no conoce tampoco: no tiene definición, así
    // que no tiene ni precio ni días que mirar.
    expect(esPruebaSinCosto("gratis")).toBe(false);
    expect(esPruebaSinCosto(null)).toBe(false);
  });

  it("un paquete sin costo Y con días sí nace con corte", () => {
    // MECÁNICA: la otra fila de la tabla de verdad, la que ningún
    // paquete real puede cubrir hoy. Es la que seguirá describiendo qué
    // hace esta función el día que se ofrezca una prueba de verdad —una
    // que empieza gratis y después se cobra.
    expect(esPruebaSinCosto(PLAN_CON_PRUEBA)).toBe(true);
    expect(finDePrueba(PLAN_CON_PRUEBA, ALTA)).not.toBeNull();
  });
});

describe("estadoDePrueba: vence cuando corresponde y NI UN DÍA ANTES", () => {
  // Todo este bloque es MECÁNICA, y corre sobre el paquete inventado:
  // ningún paquete del catálogo vence hoy.
  const vence = finDePrueba(PLAN_CON_PRUEBA, ALTA)!;

  it("el día del alta quedan los 14 días completos", () => {
    const e = estadoDePrueba({ plan: PLAN_CON_PRUEBA, venceEn: vence, ahora: ALTA });
    expect(e.esPrueba).toBe(true);
    expect(e.vencida).toBe(false);
    expect(e.diasRestantes).toBe(DIAS_DE_LA_PRUEBA);
    expect(e.porVencer).toBe(false);
  });

  it("un minuto ANTES del corte todavía no venció", () => {
    const casi = new Date(new Date(vence).getTime() - 60_000);
    const e = estadoDePrueba({ plan: PLAN_CON_PRUEBA, venceEn: vence, ahora: casi });
    expect(e.vencida).toBe(false);
    expect(e.diasRestantes).toBe(0);
    expect(textoRestante(e)).toBe("Tu prueba termina hoy");
  });

  it("en el minuto EXACTO ya venció — igual que `tiene_addon()`", () => {
    // La base corta con `vence_en > now()`: al llegar el instante, la
    // condición es falsa. Si esta función dijera otra cosa, la pantalla
    // y el panel se contradirían justo ese minuto.
    const e = estadoDePrueba({
      plan: PLAN_CON_PRUEBA,
      venceEn: vence,
      ahora: new Date(vence),
    });
    expect(e.vencida).toBe(true);
    expect(e.diasRestantes).toBe(0);
    expect(textoRestante(e)).toBe("Tu prueba terminó");
  });

  it("un día después sigue vencida (no vuelve a la vida)", () => {
    const despues = new Date(new Date(vence).getTime() + UN_DIA);
    expect(
      estadoDePrueba({ plan: PLAN_CON_PRUEBA, venceEn: vence, ahora: despues }).vencida,
    ).toBe(true);
  });

  it("redondea hacia ABAJO: 3 días y medio son «3», nunca «4»", () => {
    const ahora = new Date(new Date(vence).getTime() - 3.5 * UN_DIA);
    const e = estadoDePrueba({ plan: PLAN_CON_PRUEBA, venceEn: vence, ahora });
    expect(e.diasRestantes).toBe(3);
    expect(textoRestante(e)).toBe("Te quedan 3 días de prueba");
  });

  it("«porVencer» se enciende justo en la ventana del aviso", () => {
    const enDias = (d: number) =>
      estadoDePrueba({
        plan: PLAN_CON_PRUEBA,
        venceEn: vence,
        ahora: new Date(new Date(vence).getTime() - d * UN_DIA),
      });
    expect(enDias(DIAS_AVISO_PREVIO + 1).porVencer).toBe(false);
    expect(enDias(DIAS_AVISO_PREVIO).porVencer).toBe(true);
    expect(enDias(1).porVencer).toBe(true);
    // Vencida ya no es «por vencer»: son dos correos distintos.
    expect(
      estadoDePrueba({ plan: PLAN_CON_PRUEBA, venceEn: vence, ahora: new Date(vence) })
        .porVencer,
    ).toBe(false);
  });
});

describe("nadie se queda cortado por sorpresa", () => {
  it("un negocio del plan gratis dado de alta hace DOS AÑOS sigue sin vencer", () => {
    // EL CASO QUE MÁS IMPORTA de toda la decisión, y recorrido entero:
    // se da de alta como se da de alta de verdad —el corte sale de
    // `finDePrueba`— y se lo mira dos años después.
    const haceDosAnos = new Date("2024-08-13T15:30:00.000Z");
    const venceEn = finDePrueba("prueba", haceDosAnos);
    expect(venceEn).toBeNull();

    const e = estadoDePrueba({ plan: "prueba", venceEn, ahora: ALTA });
    expect(e.vencida).toBe(false);
    expect(e.esPrueba).toBe(false);
    expect(e.diasRestantes).toBeNull();
    // Y no le cuenta días a nadie: no hay cuenta regresiva que mostrar.
    expect(textoRestante(e)).toBeNull();
  });

  it("un negocio en prueba SIN fecha guardada no está vencido", () => {
    // Los que se dieron de alta antes de que esto existiera tienen
    // `vence_en: null`. No están vencidos: están sin corte. Tratarlos
    // como vencidos sería apagarles el programa de un día para otro por
    // un cambio de código — que es exactamente lo que no se hace acá.
    const e = estadoDePrueba({ plan: "prueba", venceEn: null });
    expect(e.esPrueba).toBe(false);
    expect(e.vencida).toBe(false);
    expect(e.diasRestantes).toBeNull();
    expect(textoRestante(e)).toBeNull();
  });

  it("a las altas VIEJAS ya no les pinta la cuenta regresiva", () => {
    // Las que se crearon cuando el gratis SÍ vencía tienen su fecha
    // escrita en `addons_negocio`. Para esta función ya no son una
    // prueba —el paquete no tiene días— así que el panel no les dice
    // «se te terminó».
    //
    // ⚠️ La BASE sí las sigue cortando: `tiene_addon()` compara esa
    // columna con `now()` y no le pregunta al catálogo. Esas filas se
    // limpian a mano — el SQL está en
    // docs/pegar-quitar-vencimiento-prueba.sql. Esta prueba fija que la
    // pantalla no invente un vencimiento por su cuenta, no que el
    // negocio esté servido.
    const e = estadoDePrueba({ plan: "prueba", venceEn: "2026-01-01T00:00:00.000Z" });
    expect(e.esPrueba).toBe(false);
    expect(e.vencida).toBe(false);
    expect(e.diasRestantes).toBeNull();
  });

  it("un paquete de PAGO con fecha vieja no se marca como prueba vencida", () => {
    // Un complemento de cortesía con vencimiento (DURACIONES, addons.ts)
    // vence por su cuenta, pero no es una prueba y no debe pintar la
    // pantalla de «se terminaron tus días».
    const e = estadoDePrueba({
      plan: "impulso",
      venceEn: "2020-01-01T00:00:00.000Z",
    });
    expect(e.esPrueba).toBe(false);
    expect(e.vencida).toBe(false);
  });

  it("un plan que el catálogo no conoce nunca cae en la cuenta regresiva", () => {
    // Con fecha vieja guardada y todo: sin definición no hay días de
    // prueba, así que no se le pinta «se te terminó» a un negocio cuya
    // fila quedó con un id que ya no está en el catálogo. Los tres son
    // paquetes que existieron y se borraron en la 0179.
    for (const id of ["gratis", "basico", "empresa"] as const) {
      const e = estadoDePrueba({ plan: id, venceEn: "2020-01-01T00:00:00.000Z" });
      expect(e.esPrueba, id).toBe(false);
      expect(e.vencida, id).toBe(false);
    }
  });

  it("una fecha ilegible no apaga a nadie", () => {
    // MECÁNICA, y por eso va con el paquete inventado: con un plan sin
    // días la función sale antes de mirar la fecha, así que la guarda
    // del `NaN` quedaría sin probar. Sin dato confiable el negocio sigue
    // trabajando y alguien lo mira a mano.
    const e = estadoDePrueba({ plan: PLAN_CON_PRUEBA, venceEn: "no-es-una-fecha" });
    expect(e.vencida).toBe(false);
    expect(e.esPrueba).toBe(false);
  });
});

describe("textoRestante", () => {
  it("escribe el singular sin «1 días»", () => {
    const vence = finDePrueba(PLAN_CON_PRUEBA, ALTA)!;
    const aUnDia = new Date(new Date(vence).getTime() - 1.2 * UN_DIA);
    expect(
      textoRestante(estadoDePrueba({ plan: PLAN_CON_PRUEBA, venceEn: vence, ahora: aUnDia })),
    ).toBe("Te queda 1 día de prueba");
  });
});
