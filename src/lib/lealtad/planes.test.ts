import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  definicionDe,
  esPlan,
  esPlanOfrecido,
  esPlanSinCosto,
  estadoDelLimite,
  etiquetaTiposDe,
  etiquetasDeCapacidades,
  descuentoAnualPct,
  mesesDeAhorroAnual,
  planIncluyeTipo,
  planQueDesbloquea,
  precioDe,
  tiposDelPlan,
  CAPACIDADES_SIN_PRODUCTO,
  ETIQUETAS_CAPACIDAD,
  ETIQUETAS_LIMITE,
  PLANES,
  PLANES_ID,
  PLANES_OFRECIDOS,
  PLANES_RETIRADOS,
  PLANES_VIGENTES,
  PLAN_DESTACADO,
  puede,
  type Capacidad,
  type DefinicionPlan,
  type LimitesPlan,
  type PlanId,
} from "./planes";
import { TIPOS_TARJETA_ID } from "./tipos-tarjeta";

describe("esPlan", () => {
  it("acepta los vigentes y los retirados", () => {
    for (const p of PLANES_ID) expect(esPlan(p)).toBe(true);
    expect(esPlan(null)).toBe(false);
    expect(esPlan("premium")).toBe(false);
    // Nombres del catálogo viejo que nunca existieron en la base.
    expect(esPlan("starter")).toBe(false);
    expect(esPlan("growth")).toBe(false);
  });
});

// ── LOS PAQUETES RETIRADOS QUE HOY NO EXISTEN ───────────────────────
/**
 * EL CATÁLOGO SE QUEDÓ SIN RETIRADOS, Y LA MECÁNICA DEL RETIRO NO SE
 * PUEDE QUEDAR SIN PRUEBA.
 *
 * Hasta el 2026-08-17 este archivo tenía ocho paquetes retirados
 * arrastrados de tres catálogos anteriores, y este bloque los recorría
 * para comprobar las DOS MITADES de la regla —no se pueden elegir, pero
 * se siguen respetando—. Los ocho se borraron después de comprobar en
 * producción que ninguna fila los tenía puestos, y el bloque se quedó
 * sin datos con los que probar.
 *
 * Borrarlo habría sido lo peor: la regla que vigila sigue viva y es
 * cara. Las dos mitades cuestan distinto y las dos hay que probarlas:
 *
 *   · si se cae la primera —«no se puede elegir»— una petición armada a
 *     mano con el id de un retirado se lleva un paquete SIN TOPES sin
 *     pagar un colón. Fue un agujero real;
 *   · si se cae la segunda —«se sigue respetando»— el negocio que ya lo
 *     tiene se queda sin definición, y con plan desconocido TODOS los
 *     topes quedan en null. Retirar mal no apaga: vuelve infinito.
 *
 * Así que los paquetes se inventan acá. Es el mismo criterio que
 * `prueba.test.ts`, que conservó la mecánica del vencimiento con un
 * paquete de prueba propio cuando el catálogo se quedó sin ninguno: la
 * lógica que protege plata no se queda sin red porque cambió un número
 * de producto.
 *
 * La diferencia con `prueba.test.ts` es CÓMO se inyectan, y es forzada:
 * allá el módulo bajo prueba (`prueba.ts`) LLAMA a `definicionDe`, así
 * que alcanzaba con mockear `./planes`. Acá el módulo bajo prueba ES
 * `planes.ts`: sus funciones leen `PLANES` y `PLANES_ID` por referencia
 * interna, y un mock del módulo no las rewirea —se quedarían mirando el
 * catálogo de verdad—. La única forma de que `esPlanOfrecido` de verdad
 * vea un paquete retirado es que el catálogo de verdad lo tenga, así
 * que se le mete en el `beforeAll` y se le saca en el `afterAll`.
 *
 * Son DOS y no uno porque el precio cambia lo que hay que probar:
 * `gratis` costaba $0 (y por eso podía saltarse el depósito) y `empresa`
 * se cotizaba caso por caso (`precioMensual: null`, que NO es gratis).
 */
const ID_SIN_COSTO = "retirado-sin-costo-solo-del-test";
const ID_A_CONVENIR = "retirado-a-convenir-solo-del-test";

/** Todo ilimitado: es lo que llevaba cada paquete retirado del catálogo. */
const SIN_TOPES: LimitesPlan = {
  clientesActivos: null,
  programas: null,
  notificacionesMes: null,
  administradores: null,
  sedes: null,
  automatizaciones: null,
};

/**
 * Lo que se le vendió a alguien en su momento, viñetas sin producto
 * incluidas: un paquete retirado es el registro de una venta y no se
 * reescribe. Que `api` y `webhooks` estén acá es a propósito — la
 * segunda mitad de la regla es justamente que eso se siga respetando.
 */
const VENDIDO_EN_SU_MOMENTO: readonly Capacidad[] = [
  "wallet",
  "tipos_de_tarjeta",
  "reglas_y_vencimientos",
  "analitica",
  "notificaciones",
  "api",
  "webhooks",
];

/** El $0 retirado: el que abría el camino automático sin comprobante. */
const RETIRADO_SIN_COSTO: DefinicionPlan = {
  // El cast es LA INYECCIÓN: este id no está en `PLANES_ID` hasta que
  // el `beforeAll` lo mete, así que el tipo todavía no lo conoce.
  id: ID_SIN_COSTO as PlanId,
  nombre: "Retirado Sin Costo Del Test",
  descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
  precioMensual: 0,
  precioAnual: null,
  limites: { ...SIN_TOPES, clientesActivos: 5 },
  capacidades: VENDIDO_EN_SU_MOMENTO,
  tipos: null,
  diasPrueba: 0,
  vigente: false,
};

/** El de precio negociado: `null` NO es gratis, es «a convenir». */
const RETIRADO_A_CONVENIR: DefinicionPlan = {
  id: ID_A_CONVENIR as PlanId,
  nombre: "Retirado A Convenir Del Test",
  descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
  precioMensual: null,
  precioAnual: null,
  limites: SIN_TOPES,
  capacidades: VENDIDO_EN_SU_MOMENTO,
  tipos: null,
  diasPrueba: 0,
  vigente: false,
};

const RETIRADOS_DEL_TEST = [RETIRADO_SIN_COSTO, RETIRADO_A_CONVENIR] as const;

/**
 * Meter y sacar del catálogo de verdad.
 *
 * Los casts son el precio de llegar a la mecánica y están acotados a
 * estas dos funciones. `PLANES_ID` es un `as const` para TypeScript
 * pero un array común en tiempo de ejecución, y `PLANES` un objeto
 * común: por eso esto funciona.
 *
 * El `afterAll` no es cortesía. Vitest aísla el registro de módulos por
 * ARCHIVO, así que `checks-de-planes.test.ts` —que compara `PLANES_ID`
 * contra los `.sql` de la base— no ve esta inyección. Pero los demás
 * bloques de ESTE archivo sí la verían, y varios recorren `PLANES_ID`
 * entero.
 */
function inyectarLosRetirados(): void {
  const ids = PLANES_ID as unknown as string[];
  const catalogo = PLANES as unknown as Record<string, DefinicionPlan>;
  for (const def of RETIRADOS_DEL_TEST) {
    ids.push(def.id);
    catalogo[def.id] = def;
  }
}

function sacarLosRetirados(): void {
  const ids = PLANES_ID as unknown as string[];
  const catalogo = PLANES as unknown as Record<string, DefinicionPlan | undefined>;
  for (const def of RETIRADOS_DEL_TEST) {
    ids.splice(ids.indexOf(def.id), 1);
    delete catalogo[def.id];
  }
}

describe("UN PAQUETE RETIRADO NO SE PUEDE ELEGIR, PERO SE SIGUE RESPETANDO", () => {
  /**
   * Las dos mitades de la misma regla, probadas sobre los paquetes
   * inventados de arriba. Quitar cualquiera de las dos rompe algo caro
   * — ver la nota larga junto a las definiciones.
   */
  beforeAll(inyectarLosRetirados);
  afterAll(sacarLosRetirados);

  it("la inyección es de verdad: el catálogo los tiene puestos", () => {
    // Si esto fallara, todo el bloque estaría probando el vacío y
    // pasaría igual — que es exactamente el modo de fallar silencioso
    // que este archivo acaba de tener.
    for (const def of RETIRADOS_DEL_TEST) {
      expect(PLANES_ID as readonly string[], `${def.id} no entró al catálogo`).toContain(def.id);
      expect(definicionDe(def.id)).toBe(def);
      expect(def.vigente).toBe(false);
    }
  });

  it("ningún retirado se puede ELEGIR", () => {
    for (const def of RETIRADOS_DEL_TEST) {
      expect(esPlanOfrecido(def.id), `${def.id} no se puede elegir`).toBe(false);
      expect(esPlanSinCosto(def.id), `${def.id} no puede saltarse el depósito`).toBe(false);
    }
    // EL CASO PUNTUAL DE LA AUDITORÍA, y el más caro de los dos: un
    // retirado que cuesta $0 y viene sin topes. `esPlanSinCosto` decide
    // si el alta salta el depósito, así que si preguntara solo por el
    // precio, este paquete crearía negocios ilimitados y gratis.
    expect(RETIRADO_SIN_COSTO.precioMensual).toBe(0);
    expect(RETIRADO_SIN_COSTO.limites.programas).toBeNull();
    expect(esPlanSinCosto(ID_SIN_COSTO)).toBe(false);
    // Y no se cuela en el camino automático por la puerta de al lado.
    expect(PLANES_OFRECIDOS.filter((id) => esPlanSinCosto(id))).toEqual(["prueba"]);
  });

  it("no aparece en nada de lo que se ofrece", () => {
    for (const def of RETIRADOS_DEL_TEST) {
      expect(PLANES_OFRECIDOS as readonly string[]).not.toContain(def.id);
      expect(PLANES_VIGENTES.map((p) => p.id)).not.toContain(def.id);
    }
    // La grilla no se mueve por tener un paquete apagado en el catálogo.
    expect(PLANES_VIGENTES).toHaveLength(PLANES_OFRECIDOS.length);
  });

  it("pero el que ya lo TIENE conserva todo, exactamente igual", () => {
    for (const def of RETIRADOS_DEL_TEST) {
      // Sigue resolviendo: es un valor válido de la base, tiene
      // definición, y los topes y tipos son los que se le vendieron.
      expect(esPlan(def.id), `${def.id} sigue siendo un valor válido de la base`).toBe(true);
      expect(definicionDe(def.id), `${def.id} sigue teniendo definición`).not.toBeNull();
      expect(definicionDe(def.id)?.nombre).toBe(def.nombre);
      // `tipos: null` = los ocho. No se le quita a quien ya pagó.
      expect(tiposDelPlan(def.id)).toHaveLength(TIPOS_TARJETA_ID.length);
      // El tope que se guarda es EL SUYO, no el del catálogo de hoy:
      // bajárselo por un cambio de catálogo sería quitarle lo comprado,
      // y subírselo sería regalarle lo que no pagó.
      expect(estadoDelLimite(def.id, "programas", 500).lleno).toBe(false);
      expect(estadoDelLimite(def.id, "clientesActivos", 0).limite).toBe(
        def.limites.clientesActivos,
      );
    }
    // El de precio negociado iba sin ningún tope…
    expect(estadoDelLimite(ID_A_CONVENIR, "clientesActivos", 999_999).lleno).toBe(false);
    // …y el gratis con el tope chico que tenía. Los dos se respetan tal
    // cual estaban.
    expect(estadoDelLimite(ID_SIN_COSTO, "clientesActivos", 5).lleno).toBe(true);
  });

  it("conserva hasta las viñetas que hoy no se pueden vender", () => {
    // No se le reescribe la lista aunque varias no tengan producto: es
    // el registro de lo que esa cuenta compró. Lo que se arregla hacia
    // adelante es no volver a OFRECERLAS, y de eso se encarga el bloque
    // «no se promete lo que no existe».
    expect(puede(ID_A_CONVENIR, "wallet")).toBe(true);
    expect(puede(ID_A_CONVENIR, "api")).toBe(true);
    expect(puede(ID_A_CONVENIR, "webhooks")).toBe(true);
    expect(puede(ID_SIN_COSTO, "notificaciones")).toBe(true);
    // Y un complemento apagado no le quita lo que el paquete incluía.
    expect(puede(ID_A_CONVENIR, "api", [])).toBe(true);
  });

  it("un paquete retirado se retira poniendo `vigente: false`, y nada más", () => {
    // LA MECÁNICA, en una línea: la puerta se decide con `vigente` y no
    // con `PLANES_OFRECIDOS.includes`. Por eso alcanza con ese campo
    // para que un paquete deje de venderse en TODAS las pantallas a la
    // vez, sin ir a buscar dónde más se pintaba.
    for (const def of RETIRADOS_DEL_TEST) {
      expect(esPlan(def.id)).toBe(true);
      expect(definicionDe(def.id)?.vigente).toBe(false);
      expect(esPlanOfrecido(def.id)).toBe(false);
    }
    // Y al revés: lo vigente pasa por la misma puerta.
    for (const id of PLANES_OFRECIDOS) {
      expect(definicionDe(id)?.vigente, id).toBe(true);
      expect(esPlanOfrecido(id), id).toBe(true);
    }
  });
});

describe("hoy el catálogo no arrastra ningún paquete retirado", () => {
  it("las dos listas coinciden, y por eso `PLANES_ID` son los cuatro", () => {
    // No es que la separación sobre: es que está vacía. El día que se
    // retire uno, su id se mueve a `PLANES_RETIRADOS` y `PLANES_ID`
    // vuelve a ser más largo que `PLANES_OFRECIDOS`.
    expect(PLANES_RETIRADOS).toHaveLength(0);
    expect([...PLANES_ID]).toEqual([...PLANES_OFRECIDOS]);
    expect(Object.keys(PLANES).sort()).toEqual([...PLANES_ID].sort());
  });

  it("ninguna definición quedó apagada dentro del catálogo", () => {
    for (const def of Object.values(PLANES)) {
      expect(def.vigente, `${def.id} está en el catálogo pero apagado`).toBe(true);
    }
  });

  it("los cuatro ofrecidos SÍ se pueden elegir", () => {
    for (const id of PLANES_OFRECIDOS) {
      expect(esPlanOfrecido(id), `${id} se ofrece`).toBe(true);
    }
    expect(esPlanOfrecido(null)).toBe(false);
    expect(esPlanOfrecido("premium")).toBe(false);
  });

  it("`vigente` y `PLANES_OFRECIDOS` dicen lo MISMO", () => {
    // `esPlanOfrecido` decide con `vigente`; media pantalla decide con
    // `PLANES_OFRECIDOS`. El día que las dos listas discrepen, un
    // paquete se podría elegir sin aparecer en ninguna grilla (o al
    // revés). Una sola verdad, comprobada acá.
    for (const id of PLANES_ID) {
      expect(
        PLANES[id].vigente,
        `${id}: «vigente» y PLANES_OFRECIDOS no coinciden`,
      ).toBe((PLANES_OFRECIDOS as readonly string[]).includes(id));
    }
  });

  it("el paquete sin costo puede no vencer, pero NO puede ser ILIMITADO", () => {
    /**
     * LA INVARIANTE QUE REEMPLAZA A LA DE «SIN COSTO = PRUEBA».
     *
     * Acá vivía la regla de que el único paquete gratis tenía que ser una
     * prueba con fecha de corte: un paquete que se contrata sin pagar y
     * que no vence era, por definición, un regalo permanente.
     *
     * Ese regalo es AHORA LA DECISIÓN DEL DUEÑO —«el plan gratuito no
     * tiene vencimiento»— así que la regla vieja ya no aplica. Pero lo
     * que la hacía valiosa sí: sin nada en su lugar, «gratis y sin
     * vencimiento» se puede convertir sin querer en «gratis, ilimitado y
     * para siempre» con una sola línea distraída.
     *
     * Lo que sostiene al paquete gratis ya no es el reloj: son los topes.
     * Entonces la regla nueva es que estén, y que sean CHICOS —más
     * chicos que los del paquete más barato que sí se cobra—. Si el
     * gratis diera lo mismo que el de $12, nadie pagaría $12; y si diera
     * `null` en cualquiera de los tres, daría infinito.
     *
     * Son estos tres y no los seis a propósito: son los que el servidor
     * hace cumplir de verdad (el cupo en las puertas de Wallet, las
     * tarjetas en `crear-actions.ts`, el equipo en `equipo-actions.ts`).
     * Un tope declarado y no exigido no protege nada.
     */
    const sinCosto = PLANES_OFRECIDOS.filter((id) => esPlanSinCosto(id));
    expect(sinCosto).toEqual(["prueba"]);

    // El más barato de los que SÍ se cobran, calculado y no escrito a
    // mano: el día que se muevan los precios, la comparación sigue
    // apuntando al escalón que corresponde.
    const conPrecio = PLANES_OFRECIDOS.map((id) => PLANES[id]).filter(
      (p) => (p.precioMensual ?? 0) > 0,
    );
    expect(conPrecio.length, "no hay ningún paquete de pago contra el cual comparar")
      .toBeGreaterThan(0);
    const masBarato = conPrecio.reduce((a, b) =>
      (a.precioMensual ?? 0) <= (b.precioMensual ?? 0) ? a : b,
    );

    const QUE_SE_EXIGEN = ["clientesActivos", "programas", "administradores"] as const;
    for (const id of sinCosto) {
      for (const clave of QUE_SE_EXIGEN) {
        const tope = PLANES[id].limites[clave];
        expect(tope, `${id} regala «${ETIQUETAS_LIMITE[clave]}» sin tope`).not.toBeNull();
        expect(
          tope ?? Infinity,
          `${id} da tanto «${ETIQUETAS_LIMITE[clave]}» como «${masBarato.nombre}», que se paga`,
        ).toBeLessThan(masBarato.limites[clave] ?? Infinity);
      }
    }
  });
});

describe("un plan que el catálogo no conoce no bloquea: DESBLOQUEA", () => {
  /**
   * EL FILO DE TODA ESTA DOCTRINA, Y LA RAZÓN DE QUE BORRAR LOS OCHO
   * PAQUETES HAYA PEDIDO MIRAR LA BASE PRIMERO.
   *
   * `definicionDe` devuelve null para un id desconocido, y con null
   * TODOS los topes quedan en null y `tiposDelPlan` devuelve los ocho.
   * O sea que un negocio cuya fila tenga un id que el catálogo no
   * conoce no queda apagado: queda ILIMITADO Y GRATIS.
   *
   * Eso es deliberado —bloquear castigaría a un negocio sin paquete
   * asignado, que no hizo nada, y lo dejaría sin poder tocar la tarjeta
   * que ya tiene— y por eso mismo es lo que convierte «borrar un plan
   * que alguien tiene puesto» en un regalo silencioso y no en un error.
   * Nadie se entera hasta la factura.
   *
   * Antes esto se probaba con 'basico', que era un plan retirado de
   * verdad. Ahora se prueba con ids que no existen en ninguna parte, que
   * es exactamente el estado en que quedaría una fila huérfana.
   */
  it("con un id desconocido no hay tope: ilimitado, no bloqueado", () => {
    for (const id of ["basico", "empresa", "premium", "lo-que-sea"]) {
      expect(esPlan(id), `${id} no está en el catálogo`).toBe(false);
      expect(definicionDe(id), `${id} no tiene definición`).toBeNull();
      expect(estadoDelLimite(id, "clientesActivos", 5_000).limite).toBeNull();
      expect(estadoDelLimite(id, "clientesActivos", 5_000).lleno).toBe(false);
      expect(estadoDelLimite(id, "programas", 500).lleno).toBe(false);
      // Y con los ocho tipos abiertos, que es el otro medio regalo.
      expect(tiposDelPlan(id)).toHaveLength(TIPOS_TARJETA_ID.length);
    }
  });

  it("pero no le concede ninguna CAPACIDAD, que es la otra mitad", () => {
    // Los topes se aflojan; las capacidades no se regalan. Son dos
    // doctrinas distintas y conviene que se vean juntas: `puede()` sin
    // definición dice que no a todo.
    for (const cap of Object.keys(ETIQUETAS_CAPACIDAD) as Capacidad[]) {
      expect(puede("basico", cap), `basico → ${cap}`).toBe(false);
      expect(puede(null, cap), `sin plan → ${cap}`).toBe(false);
    }
  });

  it("los ocho paquetes viejos ya no están, y la base tampoco los tiene", () => {
    // Se borraron el 2026-08-17 después de comprobar en producción que
    // ninguna de las cuatro columnas de plan tenía una sola fila con
    // ellos. Este test es el recordatorio de que la condición para
    // borrar un paquete es esa comprobación, y no que «ya no se venda».
    for (const id of [
      "esencial",
      "crece",
      "pro",
      "empresa",
      "gratis",
      "basico",
      "estandar",
      "enterprise",
    ]) {
      expect(esPlan(id), `${id} volvió al catálogo`).toBe(false);
      expect(PLANES_ID as readonly string[]).not.toContain(id);
    }
  });

  /**
   * El tope de la Prueba, atado al COMPORTAMIENTO y no solo al número.
   *
   * Este 5 no es una etiqueta de la pantalla de paquetes: es lo que
   * frena a un cliente real parado en la caja. Lo hacen cumplir las tres
   * puertas por las que entra alguien —el pase de Apple (generar.ts), el
   * de Google (google.ts) y el alta por QR sin cuenta (personas.ts)—,
   * las tres comparando contra `personasActivasDe`.
   *
   * Si alguien sube el número «para probar» y se olvida, el paquete
   * gratis pasa a afiliar de más y nadie se entera hasta la factura.
   */
  it("la Prueba se llena en 5 clientes, ni antes ni después", () => {
    expect(PLANES.prueba.limites.clientesActivos).toBe(5);
    expect(estadoDelLimite("prueba", "clientesActivos", 4).lleno).toBe(false);
    expect(estadoDelLimite("prueba", "clientesActivos", 5).lleno).toBe(true);
    // Por encima del tope sigue lleno: un negocio que quedó con más
    // clientes de los que su paquete permite —porque bajó de plan— no
    // puede seguir sumando.
    expect(estadoDelLimite("prueba", "clientesActivos", 6).lleno).toBe(true);
  });
});

describe("el catálogo de Lealtad", () => {
  it("son cuatro: la prueba y los tres de pago", () => {
    expect(PLANES_OFRECIDOS).toEqual(["prueba", "arranque", "impulso", "ilimitado"]);
    expect(PLANES_VIGENTES).toHaveLength(4);
    for (const def of PLANES_VIGENTES) expect(def.vigente).toBe(true);
  });

  it("tiene los precios acordados", () => {
    expect(PLANES.prueba.precioMensual).toBe(0);
    expect(PLANES.arranque.precioMensual).toBe(12);
    expect(PLANES.impulso.precioMensual).toBe(42);
    expect(PLANES.ilimitado.precioMensual).toBe(89);
  });

  it("tiene los topes de clientes acordados", () => {
    expect(PLANES.arranque.limites.clientesActivos).toBe(200);
    expect(PLANES.impulso.limites.clientesActivos).toBe(1_150);
    // El de $89 es ILIMITADO: sin tope, no un número muy grande.
    expect(PLANES.ilimitado.limites.clientesActivos).toBeNull();
  });

  it("el anual regala exactamente dos meses", () => {
    // El copy dice «Ahorrá 2 meses» y ese 2 sale del cálculo, no de un
    // texto escrito a mano que se desincroniza al cambiar un precio.
    for (const id of ["arranque", "impulso", "ilimitado"] as const) {
    // (la función quedó sin uso en producción: el anual se anuncia por
    // porcentaje, no contando meses. Se conserva por si alguna pantalla
    // futura quiere el dato en meses.)
    expect(mesesDeAhorroAnual(PLANES[id])).toBe(2);
    }
  });

  it("el paquete gratis NO VENCE, y ningún otro tampoco", () => {
    // Decisión del dueño: «el plan gratuito no tiene vencimiento». Era
    // una prueba de 14 días y hoy es un paquete gratis PERMANENTE — lo
    // que lo sostiene son los topes chicos, no un reloj.
    //
    // Este cero no es decorativo: `finDePrueba()` lo lee y devuelve
    // null, y ese null es lo que se guarda en `addons_negocio.vence_en`,
    // que es «para siempre» para `tiene_addon()`. Poner un número acá
    // vuelve a encender el corte en la base para todas las altas nuevas,
    // sin tocar una línea más — por eso la decisión se comprueba acá y
    // no en una pantalla.
    //
    // La maquinaria del vencimiento sigue entera y probada (prueba.ts +
    // prueba.test.ts), esperando el día que exista un paquete PAGO con
    // prueba. Lo que no hay hoy es ninguno.
    expect(PLANES.prueba.diasPrueba).toBe(0);
    for (const id of PLANES_OFRECIDOS) {
      expect(PLANES[id].diasPrueba, `${id} vence por tiempo`).toBe(0);
    }
  });

  it("«Impulso» es el destacado", () => {
    expect(PLAN_DESTACADO).toBe("impulso");
    expect(PLANES[PLAN_DESTACADO].vigente).toBe(true);
    // El destacado tiene que ser algo que se pueda comprar.
    expect(PLANES_OFRECIDOS as readonly string[]).toContain(PLAN_DESTACADO);
  });

  it("todos pueden armar tarjetas y ponerles reglas", () => {
    // La capacidad la tienen los cuatro; lo que cambia por paquete es
    // CUÁLES tipos (ver el bloque «el reparto de tipos»).
    for (const id of PLANES_OFRECIDOS) {
      expect(puede(id, "tipos_de_tarjeta")).toBe(true);
      expect(puede(id, "reglas_y_vencimientos")).toBe(true);
    }
  });

  it("el paquete de $89 no esconde un techo en las tarjetas", () => {
    expect(PLANES.ilimitado.limites.programas).toBeNull();
    expect(PLANES.ilimitado.limites.clientesActivos).toBeNull();
    expect(PLANES.ilimitado.limites.administradores).toBeNull();
  });

  it("tiene las tarjetas acordadas: 1 · 2 · 5 · sin tope", () => {
    expect(PLANES.prueba.limites.programas).toBe(1);
    expect(PLANES.arranque.limites.programas).toBe(2);
    expect(PLANES.impulso.limites.programas).toBe(5);
    expect(PLANES.ilimitado.limites.programas).toBeNull();
  });

  it("tiene el equipo acordado: 1 · 3 · 10 · sin tope", () => {
    // El tope INCLUYE al dueño, y por eso la Prueba va en 1.
    expect(PLANES.prueba.limites.administradores).toBe(1);
    expect(PLANES.arranque.limites.administradores).toBe(3);
    expect(PLANES.impulso.limites.administradores).toBe(10);
    expect(PLANES.ilimitado.limites.administradores).toBeNull();
  });
});

describe("EL CUPO NO SE MULTIPLICA POR LAS TARJETAS", () => {
  /**
   * ES EL BUG QUE LA 0142 VIENE A CERRAR, escrito como prueba.
   *
   * `generar.ts` y `google.ts` contaban los miembros POR `programa_id`,
   * así que cada tarjeta traía su propio cupo: Arranque con 2 tarjetas
   * habría afiliado 400 cobrando por 200, e Impulso con 5 habría
   * afiliado 5.750 cobrando por 1.150. Por eso los paquetes de pago
   * iban con UNA tarjeta — un candado puesto para tapar el agujero.
   *
   * El conteo por cuenta (`personasActivasDe`, cupo.ts) es lo que
   * permite subir el escalón de tarjetas. Si alguien volviera a contar
   * por programa, ESTE es el número que quedaría mal.
   */
  it("el tope de clientes es el del paquete, no el del paquete por tarjeta", () => {
    for (const id of PLANES_OFRECIDOS) {
      const { clientesActivos, programas } = PLANES[id].limites;
      if (clientesActivos === null) continue;

      // Justo en el tope está lleno, tenga las tarjetas que tenga.
      expect(estadoDelLimite(id, "clientesActivos", clientesActivos).lleno).toBe(true);

      // Y lo que el conteo viejo habría permitido —el tope multiplicado
      // por las tarjetas— sigue estando por encima del tope.
      const conElBugViejo = clientesActivos * (programas ?? 1);
      expect(estadoDelLimite(id, "clientesActivos", conElBugViejo).lleno).toBe(true);
    }
  });

  it("Impulso son 1.150 clientes con sus 5 tarjetas, no 5.750", () => {
    expect(PLANES.impulso.limites.programas).toBe(5);
    expect(PLANES.impulso.limites.clientesActivos).toBe(1_150);
    expect(estadoDelLimite("impulso", "clientesActivos", 1_150).lleno).toBe(true);
    expect(estadoDelLimite("impulso", "clientesActivos", 5_750).disponibles).toBe(0);
  });

  it("Arranque son 200 con sus 2 tarjetas, no 400", () => {
    expect(PLANES.arranque.limites.programas).toBe(2);
    expect(estadoDelLimite("arranque", "clientesActivos", 400).lleno).toBe(true);
  });
});

describe("el reparto de tipos de tarjeta", () => {
  it("es el acordado: 3 · 5 · 8 · 8", () => {
    expect(PLANES.prueba.tipos).toEqual(["sellos", "puntos", "cashback"]);
    expect(PLANES.arranque.tipos).toEqual([
      "sellos",
      "puntos",
      "cashback",
      "cupon",
      "descuento",
    ]);
    // null = los ocho, sin repetir la lista.
    expect(PLANES.impulso.tipos).toBeNull();
    expect(PLANES.ilimitado.tipos).toBeNull();
  });

  it("ningún paquete pierde un tipo al subir de precio", () => {
    for (let i = 1; i < PLANES_OFRECIDOS.length; i++) {
      const menor = tiposDelPlan(PLANES_OFRECIDOS[i - 1]);
      const mayor = tiposDelPlan(PLANES_OFRECIDOS[i]);
      for (const t of menor) expect(mayor, `${PLANES_OFRECIDOS[i]}`).toContain(t);
    }
  });

  it("los ocho tipos existen en algún paquete: ninguno queda invendible", () => {
    for (const t of TIPOS_TARJETA_ID) {
      expect(planQueDesbloquea(t), `${t} no lo trae ningún paquete`).not.toBeNull();
    }
  });

  it("dice cuál es el paquete MÁS BARATO que abre cada tipo", () => {
    expect(planQueDesbloquea("sellos")?.id).toBe("prueba");
    expect(planQueDesbloquea("cashback")?.id).toBe("prueba");
    expect(planQueDesbloquea("cupon")?.id).toBe("arranque");
    expect(planQueDesbloquea("evento")?.id).toBe("impulso");
    expect(planQueDesbloquea("giftcard")?.id).toBe("impulso");
    expect(planQueDesbloquea("membresia")?.id).toBe("impulso");
  });

  it("la Prueba no arma gift cards ni eventos", () => {
    expect(planIncluyeTipo("prueba", "sellos")).toBe(true);
    expect(planIncluyeTipo("prueba", "puntos")).toBe(true);
    expect(planIncluyeTipo("prueba", "cashback")).toBe(true);
    expect(planIncluyeTipo("prueba", "giftcard")).toBe(false);
    expect(planIncluyeTipo("prueba", "evento")).toBe(false);
    expect(planIncluyeTipo("arranque", "cupon")).toBe(true);
    expect(planIncluyeTipo("arranque", "membresia")).toBe(false);
  });

  it("un paquete retirado conserva sus tipos: no se le quita a quien ya pagó", () => {
    // Con los paquetes inventados, porque el catálogo ya no arrastra
    // ninguno de verdad. Los dos van con `tipos: null` —los ocho— que es
    // lo que tenían los ocho que se borraron: el reparto por escalón de
    // la 0142 no se les aplica hacia atrás.
    inyectarLosRetirados();
    try {
      for (const def of RETIRADOS_DEL_TEST) {
        expect(def.tipos, `${def.id}`).toBeNull();
        expect(tiposDelPlan(def.id)).toHaveLength(TIPOS_TARJETA_ID.length);
        expect(planIncluyeTipo(def.id, "giftcard"), `${def.id}`).toBe(true);
      }
    } finally {
      sacarLosRetirados();
    }
  });

  it("sin plan conocido no bloquea nada", () => {
    // Misma doctrina que `estadoDelLimite`: sin definición no hay tope.
    // Bloquear castigaría a un negocio sin paquete asignado, que no hizo
    // nada — y lo dejaría sin poder tocar la tarjeta que ya tiene.
    expect(tiposDelPlan(null)).toHaveLength(TIPOS_TARJETA_ID.length);
    expect(planIncluyeTipo("premium", "evento")).toBe(true);
  });

  it("la viñeta dice CUÁLES, no un «ocho» que sería mentira", () => {
    expect(etiquetaTiposDe(PLANES.prueba)).toBe(
      "3 tipos de tarjeta: sellos, puntos y cashback",
    );
    expect(etiquetaTiposDe(PLANES.arranque)).toBe(
      "5 tipos de tarjeta: sellos, puntos, cashback, cupón y descuento",
    );
    expect(etiquetaTiposDe(PLANES.impulso)).toBe("Los 8 tipos de tarjeta");
    // La etiqueta ESTÁTICA es neutra a propósito: cualquier pantalla que
    // la pinte sola no puede quedar mintiendo.
    expect(ETIQUETAS_CAPACIDAD.tipos_de_tarjeta).not.toMatch(/ocho|\b8\b/i);
  });

  it("`etiquetasDeCapacidades` sustituye la de los tipos y deja el resto", () => {
    const prueba = etiquetasDeCapacidades(PLANES.prueba);
    expect(prueba).toContain("3 tipos de tarjeta: sellos, puntos y cashback");
    expect(prueba).not.toContain(ETIQUETAS_CAPACIDAD.tipos_de_tarjeta);
    expect(prueba).toContain(ETIQUETAS_CAPACIDAD.wallet);
    expect(prueba).toHaveLength(PLANES.prueba.capacidades.length);
  });
});

describe("no se promete lo que no existe", () => {
  /**
   * La auditoría previa a la 0141: campañas, automatizaciones, sedes,
   * webhooks, API, exportación, POS, analítica avanzada, segmentación,
   * franquicias, SLA, marca blanca y soporte dedicado NO tienen tabla,
   * endpoint ni pantalla. El catálogo viejo las vendía igual.
   *
   * Estas pruebas son el candado: no alcanzan para construirlas, pero sí
   * para que no se vuelvan a vender por accidente.
   */
  it("ningún paquete ofrecido lista una capacidad sin producto", () => {
    for (const def of PLANES_VIGENTES) {
      for (const cap of CAPACIDADES_SIN_PRODUCTO) {
        expect(
          def.capacidades,
          `«${def.nombre}» promete «${ETIQUETAS_CAPACIDAD[cap]}», que no existe`,
        ).not.toContain(cap);
      }
    }
  });

  it("`puede()` dice que no para todo lo que no existe", () => {
    for (const id of PLANES_OFRECIDOS) {
      for (const cap of CAPACIDADES_SIN_PRODUCTO) {
        expect(puede(id, cap), `${id} → ${cap}`).toBe(false);
      }
    }
  });

  it("los topes sin producto detrás no prometen nada", () => {
    // No hay envío de notificaciones ni automatizaciones: un número
    // acá sería una bolsa que nadie puede gastar. Y no hay modelo de
    // sedes: cada negocio es una.
    for (const id of PLANES_OFRECIDOS) {
      expect(PLANES[id].limites.notificacionesMes, `${id}`).toBe(0);
      expect(PLANES[id].limites.automatizaciones, `${id}`).toBe(0);
      expect(PLANES[id].limites.sedes, `${id}`).toBe(1);
    }
  });

  it("toda capacidad tiene etiqueta, exista o no el producto", () => {
    // Sin etiqueta, «Tu plan actual» de un retirado pintaría `undefined`.
    for (const def of Object.values(PLANES)) {
      for (const cap of def.capacidades) {
        expect(ETIQUETAS_CAPACIDAD[cap], `falta la etiqueta de ${cap}`).toBeTruthy();
      }
    }
  });

  it("los TRES primeros paquetes traen la misma lista de capacidades", () => {
    /**
     * No es un olvido: entre Prueba, Arranque e Impulso la diferencia
     * es de ESCALA —clientes, tarjetas, tipos, equipo— y nada más.
     *
     * El catálogo anterior fingía lo contrario —«Crece» ($27) sumaba
     * cuatro capacidades sobre «Esencial» ($9) y las cuatro eran
     * humo—, y quien pagaba el triple recibía lo mismo. Este test es el
     * recordatorio: un escalón de capacidad solo se agrega si el código
     * LO HACE CUMPLIR, y este test se cambia a mano sabiendo por qué.
     * Así se agregaron las dos de Ilimitado.
     */
    const referencia = [...PLANES.prueba.capacidades].sort();
    for (const id of ["prueba", "arranque", "impulso"] as const) {
      expect([...PLANES[id].capacidades].sort(), `«${PLANES[id].nombre}»`).toEqual(referencia);
    }
  });

  it("Ilimitado suma exactamente dos, y las dos existen de verdad", () => {
    const extra = PLANES.ilimitado.capacidades.filter(
      (c) => !PLANES.impulso.capacidades.includes(c),
    );
    expect([...extra].sort()).toEqual(["cercania", "diseno_a_medida"]);
    for (const cap of extra) {
      // Nada de `CAPACIDADES_SIN_PRODUCTO` puede subir de escalón: si no
      // hay código detrás, cobrarlo es vender humo.
      expect(CAPACIDADES_SIN_PRODUCTO).not.toContain(cap);
      expect(ETIQUETAS_CAPACIDAD[cap]).toBeTruthy();
    }
  });

  it("cercanía y diseño a medida SOLO en el de $89", () => {
    for (const cap of ["cercania", "diseno_a_medida"] as const) {
      expect(puede("ilimitado", cap)).toBe(true);
      for (const id of ["prueba", "arranque", "impulso"] as const) {
        expect(puede(id, cap), `${id} → ${cap}`).toBe(false);
      }
    }
  });

  it("el complemento suelto de cercanía sigue valiendo lo mismo que antes", () => {
    // `pases_cercania` (0123) se vendió por separado. Meter `cercania`
    // en un paquete NO le puede apagar el aviso a quien ya lo compró:
    // sería quitarle lo pagado por un cambio de catálogo.
    expect(puede("prueba", "cercania", ["pases_cercania"])).toBe(true);
    expect(puede("arranque", "cercania", ["pases_cercania"])).toBe(true);
    expect(puede("impulso", "cercania", ["pases_cercania"])).toBe(true);
    // Y a quien ya lo tiene por el paquete, apagar el add-on no se lo quita.
    expect(puede("ilimitado", "cercania", [])).toBe(true);
  });

  it("la etiqueta de cercanía dice que es solo en iPhone", () => {
    // `google.ts` no escribe `locations` en el objeto del pase: en
    // Android el aviso no sale. Prometerlo entero sería vender medio
    // producto, y ahora que va dentro de un paquete se cobra.
    expect(ETIQUETAS_CAPACIDAD.cercania).toMatch(/iPhone/);
  });
});

describe("los planes crecen", () => {
  it("cada plan ofrecido incluye todo lo del anterior", () => {
    // Se escriben completos en vez de heredar, así que un olvido al
    // agregar una capacidad nueva se ve acá y no en producción.
    for (let i = 1; i < PLANES_OFRECIDOS.length; i++) {
      const menor = PLANES[PLANES_OFRECIDOS[i - 1]].capacidades;
      const mayor = PLANES[PLANES_OFRECIDOS[i]].capacidades;
      for (const cap of menor) expect(mayor).toContain(cap);
    }
  });

  it("ningún tope baja al subir de plan", () => {
    const claves = Object.keys(ETIQUETAS_LIMITE) as (keyof LimitesPlan)[];
    for (const clave of claves) {
      let vistoIlimitado = false;
      let anterior = 0;
      for (const id of PLANES_OFRECIDOS) {
        const tope = PLANES[id].limites[clave];
        if (tope === null) {
          vistoIlimitado = true;
          continue;
        }
        // Un tope con número después de uno ilimitado sería un plan más
        // caro y más chico.
        expect(vistoIlimitado).toBe(false);
        expect(tope).toBeGreaterThanOrEqual(anterior);
        anterior = tope;
      }
    }
  });

  it("los topes son los acordados", () => {
    expect(PLANES.prueba.limites).toMatchObject({
      clientesActivos: 5,
      programas: 1,
      administradores: 1,
    });
    expect(PLANES.arranque.limites).toMatchObject({
      clientesActivos: 200,
      programas: 2,
      administradores: 3,
    });
    expect(PLANES.impulso.limites).toMatchObject({
      clientesActivos: 1_150,
      programas: 5,
      administradores: 10,
    });
    expect(PLANES.ilimitado.limites).toMatchObject({
      clientesActivos: null,
      programas: null,
      administradores: null,
    });
  });
});

describe("precioDe", () => {
  it("escribe dólares con símbolo y sin centavos de relleno", () => {
    expect(precioDe(PLANES.arranque)).toBe("$12");
    expect(precioDe(PLANES.impulso)).toBe("$42");
    expect(precioDe(PLANES.ilimitado)).toBe("$89");
  });

  it("da el precio anual cuando se lo piden", () => {
    expect(precioDe(PLANES.arranque, "año")).toBe("$115");
    expect(precioDe(PLANES.impulso, "año")).toBe("$400");
    expect(precioDe(PLANES.ilimitado, "año")).toBe("$850");
  });

  it("la prueba es cero y el negociado no tiene cifra", () => {
    expect(precioDe(PLANES.prueba)).toBe("$0");
    // `precioMensual: null` es «a convenir», y NO se le inventa un
    // monto. Hoy ningún paquete del catálogo se cotiza caso por caso
    // —los que lo hacían eran retirados y se borraron— así que la rama
    // se prueba con el paquete inventado. `precioDe` recibe la
    // definición entera, o sea que acá no hace falta inyectar nada.
    expect(precioDe(RETIRADO_A_CONVENIR)).toBeNull();
    expect(precioDe(RETIRADO_A_CONVENIR, "año")).toBeNull();
    // Tampoco inventa un anual donde no lo hay.
    expect(precioDe(PLANES.prueba, "año")).toBeNull();
  });
});

describe("puede", () => {
  it("los paquetes de hoy traen lo que existe y nada más", () => {
    for (const id of PLANES_OFRECIDOS) {
      expect(puede(id, "wallet"), `${id}`).toBe(true);
      expect(puede(id, "analitica"), `${id}`).toBe(true);
      expect(puede(id, "poster_qr"), `${id}`).toBe(true);
      expect(puede(id, "modo_mostrador"), `${id}`).toBe(true);
      expect(puede(id, "personalizacion_tarjeta"), `${id}`).toBe(true);
      expect(puede(id, "equipo_con_permisos"), `${id}`).toBe(true);
      // Lo que no existe no lo trae ni el más caro.
      expect(puede(id, "segmentacion"), `${id}`).toBe(false);
      expect(puede(id, "api"), `${id}`).toBe(false);
      expect(puede(id, "webhooks"), `${id}`).toBe(false);
    }
  });

  it("sin plan no puede nada", () => {
    // TODAS las capacidades, no las de un paquete concreto: sin
    // definición no se concede ni una.
    for (const cap of Object.keys(ETIQUETAS_CAPACIDAD) as Capacidad[]) {
      expect(puede(null, cap), cap).toBe(false);
    }
  });

  it("un complemento regalado abre una capacidad sin subir de plan", () => {
    expect(puede("impulso", "cercania")).toBe(false);
    expect(puede("impulso", "cercania", ["pases_cercania"])).toBe(true);
  });

  it("un complemento de otra cosa no abre la capacidad pedida", () => {
    expect(puede("impulso", "cercania", ["pases_api", "agenda_ia"])).toBe(false);
  });

  it("un complemento NO puede quitar lo que el plan incluye", () => {
    // Apagar un add-on por error no debe degradar a quien pagó el plan.
    expect(puede("ilimitado", "cercania", [])).toBe(true);
    expect(puede("ilimitado", "cercania", ["agenda_ia"])).toBe(true);
  });

  it("un plan inventado no concede nada", () => {
    expect(puede("premium", "wallet" as Capacidad)).toBe(false);
  });
});

describe("estadoDelLimite", () => {
  it("cuenta lo que queda", () => {
    const e = estadoDelLimite("arranque", "clientesActivos", 80);
    expect(e).toMatchObject({ limite: 200, disponibles: 120, lleno: false, cerca: false });
    expect(e.porcentaje).toBe(40);
  });

  it("avisa al 80%, no al 95%", () => {
    // Enterarse cuando ya casi no entra nadie no deja tiempo de decidir.
    expect(estadoDelLimite("arranque", "clientesActivos", 159).cerca).toBe(false);
    expect(estadoDelLimite("arranque", "clientesActivos", 160).cerca).toBe(true);
    expect(estadoDelLimite("arranque", "clientesActivos", 160).lleno).toBe(false);
  });

  it("marca lleno justo en el tope, no después", () => {
    expect(estadoDelLimite("arranque", "clientesActivos", 199).lleno).toBe(false);
    expect(estadoDelLimite("arranque", "clientesActivos", 200).lleno).toBe(true);
    expect(estadoDelLimite("impulso", "clientesActivos", 1_149).lleno).toBe(false);
    expect(estadoDelLimite("impulso", "clientesActivos", 1_150).lleno).toBe(true);
  });

  it("pasado el tope no muestra disponibles negativos ni pasa de 100%", () => {
    const e = estadoDelLimite("arranque", "clientesActivos", 500);
    expect(e.disponibles).toBe(0);
    expect(e.lleno).toBe(true);
    expect(e.porcentaje).toBe(100);
  });

  it("sirve para cualquier tope, no solo clientes", () => {
    expect(estadoDelLimite("prueba", "programas", 1).lleno).toBe(true);
    expect(estadoDelLimite("arranque", "programas", 1).lleno).toBe(false);
    expect(estadoDelLimite("arranque", "programas", 2).lleno).toBe(true);
    expect(estadoDelLimite("ilimitado", "programas", 40).lleno).toBe(false);
    expect(estadoDelLimite("arranque", "sedes", 1).lleno).toBe(true);
    // El equipo ya es un tope de verdad (lo hace cumplir equipo-actions).
    expect(estadoDelLimite("arranque", "administradores", 3).lleno).toBe(true);
  });

  it("sin tope nunca está lleno ni cerca", () => {
    const e = estadoDelLimite("ilimitado", "clientesActivos", 999_999);
    expect(e.limite).toBeNull();
    expect(e.lleno).toBe(false);
    expect(e.cerca).toBe(false);
    expect(e.porcentaje).toBe(0);
  });

  it("sin plan no hay tope declarado", () => {
    // Y esto es justo el peligro de borrar un plan en vez de retirarlo:
    // sin definición, «sin tope» significa ILIMITADO, no «bloqueado».
    expect(estadoDelLimite(null, "clientesActivos", 10).limite).toBeNull();
    expect(estadoDelLimite("premium", "clientesActivos", 10).lleno).toBe(false);
  });
});

describe("definicionDe", () => {
  it("devuelve null para lo que no es plan", () => {
    expect(definicionDe(null)).toBeNull();
    expect(definicionDe("premium")).toBeNull();
    expect(definicionDe("prueba")?.limites.clientesActivos).toBe(5);
    expect(definicionDe("arranque")?.nombre).toBe("Starter");
    expect(definicionDe("impulso")?.nombre).toBe("Impulso");
    expect(definicionDe("ilimitado")?.nombre).toBe("Ilimitado");
  });

  it("un paquete retirado sigue resolviendo, que es todo el punto", () => {
    inyectarLosRetirados();
    try {
      expect(definicionDe(ID_A_CONVENIR)?.nombre).toBe(RETIRADO_A_CONVENIR.nombre);
      expect(definicionDe(ID_SIN_COSTO)?.nombre).toBe(RETIRADO_SIN_COSTO.nombre);
    } finally {
      sacarLosRetirados();
    }
    // Y en cuanto se lo saca del catálogo, deja de resolver: es la
    // diferencia entre RETIRAR y BORRAR, y la que hay que mirar en la
    // base antes de borrar nada.
    expect(definicionDe(ID_A_CONVENIR)).toBeNull();
  });
});

describe("el plan sin costo tiene tope de programas", () => {
  /**
   * El agujero que esto cierra: el alta automática guardaba a mano el
   * id de un paquete RETIRADO que costaba $0, y los retirados van sin
   * topes a propósito. Entonces `definicionDe(plan).limites.programas`
   * daba null, el tope de `crear-actions.ts` ni se ejecutaba, y una
   * cuenta gratis podía crear pases ilimitados.
   *
   * La regla del dueño es «el acceso automático solo permite crear UN
   * pase». Eso no se cumple con un `if` en una pantalla: se cumple si el
   * plan que se OFRECE sin costo tiene tope. Si mañana alguien agrega un
   * plan gratis sin límite de programas, este test lo frena.
   */
  it("ningún plan ofrecido sin costo puede tener programas ilimitados", () => {
    const sinCosto = PLANES_OFRECIDOS.map((id) => PLANES[id]).filter(
      (p) => p.precioMensual === 0,
    );
    expect(sinCosto.length).toBeGreaterThan(0);
    for (const p of sinCosto) {
      expect(p.limites.programas, `${p.id} no tiene tope de programas`).not.toBeNull();
    }
  });

  it("el plan de prueba permite exactamente un programa", () => {
    expect(PLANES.prueba.limites.programas).toBe(1);
  });

  it("un retirado sin costo conserva sus topes abiertos — y por eso no se puede ELEGIR", () => {
    // Las dos mitades juntas, que es donde se ve por qué la puerta de
    // `esPlanSinCosto` pregunta primero si el paquete se ofrece: el
    // paquete existe, cuesta $0 y no tiene tope de programas. Lo único
    // que impide que alguien se lo pida es `vigente: false`.
    inyectarLosRetirados();
    try {
      expect(definicionDe(ID_SIN_COSTO)?.precioMensual).toBe(0);
      expect(definicionDe(ID_SIN_COSTO)?.limites.programas).toBeNull();
      expect(esPlanSinCosto(ID_SIN_COSTO)).toBe(false);
    } finally {
      sacarLosRetirados();
    }
  });
});

describe("EL ANUAL ES 20% MENOS, y eso es una promesa que se comprueba con calculadora", () => {
  /**
   * El descuento anual dejó de ser «dos meses de regalo» (16,7%) y pasó
   * a ser 20%. Los precios se redondearon HACIA ABAJO justamente para
   * que el descuento real nunca quede por debajo de lo que la página
   * anuncia: prometer 20% y cobrar 19,8% es la clase de detalle que un
   * cliente verifica.
   *
   * Y el número que se MUESTRA se redondea hacia abajo también, así que
   * nunca puede anunciar más de lo que el precio cumple.
   */
  it("ningún paquete de pago da menos del 20% al año", () => {
    for (const id of PLANES_OFRECIDOS) {
      const def = PLANES[id];
      if (!def.precioMensual || !def.precioAnual) continue;
      const real = ((def.precioMensual * 12 - def.precioAnual) / (def.precioMensual * 12)) * 100;
      expect(real, `${id} promete 20% y da ${real.toFixed(1)}%`).toBeGreaterThanOrEqual(20);
    }
  });

  it("lo que se anuncia nunca es MÁS que lo que se cobra", () => {
    for (const id of PLANES_OFRECIDOS) {
      const def = PLANES[id];
      if (!def.precioMensual || !def.precioAnual) continue;
      const real = ((def.precioMensual * 12 - def.precioAnual) / (def.precioMensual * 12)) * 100;
      expect(descuentoAnualPct(def), `${id} anuncia de más`).toBeLessThanOrEqual(real);
    }
  });

  it("los tres de pago anuncian 20%", () => {
    expect(descuentoAnualPct(PLANES.arranque)).toBe(20);
    expect(descuentoAnualPct(PLANES.impulso)).toBe(20);
    expect(descuentoAnualPct(PLANES.ilimitado)).toBe(20);
  });

  it("un paquete sin precio anual no anuncia ningún descuento", () => {
    // El de $0 y el de precio a convenir: en los dos, dividir por el
    // precio mensual daría 0 o NaN, y un «NaN% menos» en la landing es
    // peor que no decir nada. Como `descuentoAnualPct` recibe la
    // definición entera, el «a convenir» se prueba con el paquete
    // inventado sin tocar el catálogo.
    expect(descuentoAnualPct(PLANES.prueba)).toBe(0);
    expect(descuentoAnualPct(RETIRADO_A_CONVENIR)).toBe(0);
    expect(descuentoAnualPct(RETIRADO_SIN_COSTO)).toBe(0);
  });
});
