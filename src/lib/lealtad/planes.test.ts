import { describe, expect, it } from "vitest";
import {
  definicionDe,
  esPlan,
  esPlanOfrecido,
  esPlanSinCosto,
  estadoDelLimite,
  etiquetaTiposDe,
  etiquetasDeCapacidades,
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
  type LimitesPlan,
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

describe("UN PAQUETE RETIRADO NO SE PUEDE ELEGIR, PERO SE SIGUE RESPETANDO", () => {
  /**
   * Las dos mitades de la misma regla, y hay que probar LAS DOS: quitar
   * cualquiera de ellas rompe algo caro.
   *
   * El agujero que esto cierra: las altas validaban con `esPlan`, que
   * incluye los retirados a propósito. Una petición armada a mano con
   * `plan: "gratis"` pasaba, y `gratis` lleva `SIN_TOPES` — o sea
   * tarjetas ilimitadas, equipo ilimitado y los ocho tipos de tarjeta
   * (incluidos los que solo trae el paquete de $42), sin pagar nada.
   *
   * Pero cerrarlo con `PLANES_ID = solo los vigentes` habría sido peor:
   * `definicionDe('basico')` daría null, y con plan null TODOS los topes
   * quedan null. Retirar mal un plan no lo apaga: lo vuelve infinito.
   */
  it("ningún retirado se puede ELEGIR", () => {
    for (const id of PLANES_RETIRADOS) {
      expect(esPlanOfrecido(id), `${id} no se puede elegir`).toBe(false);
      expect(esPlanSinCosto(id), `${id} no puede saltarse el depósito`).toBe(false);
    }
    // El caso puntual de la auditoría: `gratis` cuesta $0 y lleva
    // SIN_TOPES. Es el que abría el camino instantáneo sin comprobante.
    expect(PLANES.gratis.precioMensual).toBe(0);
    expect(PLANES.gratis.limites.programas).toBeNull();
    expect(esPlanOfrecido("gratis")).toBe(false);
    expect(esPlanSinCosto("gratis")).toBe(false);
  });

  it("pero el que ya lo TIENE conserva todo, exactamente igual", () => {
    for (const id of PLANES_RETIRADOS) {
      // Sigue resolviendo: nombre, capacidades, topes y tipos.
      expect(esPlan(id), `${id} sigue siendo un valor válido de la base`).toBe(true);
      expect(definicionDe(id), `${id} sigue teniendo definición`).not.toBeNull();
      expect(tiposDelPlan(id)).toHaveLength(TIPOS_TARJETA_ID.length);
    }
    expect(puede("basico", "wallet")).toBe(true);
    expect(puede("empresa", "marca_blanca")).toBe(true);
    expect(estadoDelLimite("gratis", "programas", 500).lleno).toBe(false);
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

  it("el único paquete sin costo que se puede elegir es una PRUEBA", () => {
    // Un paquete que se contrata sin pagar y que no vence es un regalo
    // permanente. Si mañana alguien agrega uno así, este test lo frena
    // antes de que se cree el primer negocio.
    const sinCosto = PLANES_OFRECIDOS.filter((id) => esPlanSinCosto(id));
    expect(sinCosto).toEqual(["prueba"]);
    for (const id of sinCosto) {
      expect(PLANES[id].diasPrueba, `${id} no tiene fecha de corte`).toBeGreaterThan(0);
    }
  });
});

describe("los planes viejos no se rompen", () => {
  // Esto es lo que protege a los negocios que YA pagaron: sacar
  // 'basico' del catálogo los dejaría sin plan, sin topes y sin
  // capacidades de un día para otro.
  it("los retirados siguen resolviendo", () => {
    for (const id of PLANES_RETIRADOS) {
      const def = definicionDe(id);
      expect(def).not.toBeNull();
      expect(def!.vigente).toBe(false);
    }
    expect(definicionDe("basico")?.nombre).toBe("Básico");
    expect(puede("basico", "wallet")).toBe(true);
  });

  it("los cinco del catálogo 0133 se RETIRARON, no se borraron", () => {
    // La 0141 los sacó de la venta. Borrarlos habría dejado a quien los
    // tiene sin plan — y con plan null todos los topes quedan null, o
    // sea ilimitado: el bug que ya se tuvo una vez.
    for (const id of ["esencial", "crece", "pro", "empresa"] as const) {
      expect(esPlan(id)).toBe(true);
      expect(definicionDe(id)).not.toBeNull();
      expect(PLANES[id].vigente).toBe(false);
      expect(PLANES_RETIRADOS as readonly string[]).toContain(id);
    }
    // 'prueba' es el único del catálogo viejo que SIGUE ofreciéndose.
    expect(PLANES.prueba.vigente).toBe(true);
  });

  it("no se les baja el tope por un cambio de catálogo", () => {
    // Quitarle capacidad a quien ya compró sería cobrarle lo mismo por
    // menos. Los retirados quedan sin topes a propósito — incluidos los
    // cinco que la 0141 acaba de retirar, que ANTES sí tenían tope.
    for (const id of PLANES_RETIRADOS) {
      if (id === "gratis") continue; // el único con tope histórico propio
      expect(PLANES[id].limites.clientesActivos, `${id} conserva su tope`).toBeNull();
      expect(PLANES[id].limites.programas, `${id} conserva su tope`).toBeNull();
    }
  });

  it("no se ofrecen", () => {
    for (const id of PLANES_RETIRADOS) {
      expect(PLANES_OFRECIDOS as readonly string[]).not.toContain(id);
    }
  });

  it("un negocio real con plan viejo sigue funcionando", () => {
    // Rancho Las Torres está en 'basico' en producción. Este es el caso
    // concreto que la separación ofrecidos/retirados protege.
    const def = definicionDe("basico");
    expect(def?.nombre).toBe("Básico");
    expect(estadoDelLimite("basico", "clientesActivos", 5_000).lleno).toBe(false);
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
      expect(mesesDeAhorroAnual(PLANES[id])).toBe(2);
    }
  });

  it("la prueba es de 14 días y es el único plan de prueba", () => {
    expect(PLANES.prueba.diasPrueba).toBe(14);
    for (const id of PLANES_OFRECIDOS) {
      if (id !== "prueba") expect(PLANES[id].diasPrueba).toBe(0);
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

  it("los retirados conservan los ocho: no se le quita a quien ya pagó", () => {
    for (const id of PLANES_RETIRADOS) {
      expect(PLANES[id].tipos, `${id}`).toBeNull();
      expect(tiposDelPlan(id)).toHaveLength(TIPOS_TARJETA_ID.length);
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
      clientesActivos: 25,
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
    expect(precioDe(PLANES.arranque, "año")).toBe("$120");
    expect(precioDe(PLANES.impulso, "año")).toBe("$420");
    expect(precioDe(PLANES.ilimitado, "año")).toBe("$890");
  });

  it("la prueba es cero y el negociado no tiene cifra", () => {
    expect(precioDe(PLANES.prueba)).toBe("$0");
    // «Empresa», retirado, se cotizaba caso por caso: sin cifra inventada.
    expect(precioDe(PLANES.empresa)).toBeNull();
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

  it("los retirados conservan lo que en su momento se les vendió", () => {
    // No se les reescribe la lista aunque varias de esas viñetas no
    // tengan producto: es el registro de lo que esa cuenta compró.
    expect(puede("crece", "segmentacion")).toBe(true);
    expect(puede("pro", "api")).toBe(true);
    expect(puede("empresa", "marca_blanca")).toBe(true);
    expect(puede("empresa", "soporte_dedicado")).toBe(true);
    expect(puede("basico", "wallet")).toBe(true);
  });

  it("sin plan no puede nada", () => {
    for (const cap of PLANES.empresa.capacidades) {
      expect(puede(null, cap)).toBe(false);
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
    expect(puede("pro", "cercania", [])).toBe(true);
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
    expect(definicionDe("prueba")?.limites.clientesActivos).toBe(25);
    expect(definicionDe("arranque")?.nombre).toBe("Arranque");
    expect(definicionDe("impulso")?.nombre).toBe("Impulso");
    expect(definicionDe("ilimitado")?.nombre).toBe("Ilimitado");
    // Los retirados siguen resolviendo, que es todo el punto.
    expect(definicionDe("empresa")?.nombre).toBe("Empresa");
  });
});

describe("el plan sin costo tiene tope de programas", () => {
  /**
   * El agujero que esto cierra: el alta automática guardaba
   * `plan_lealtad: "gratis"` a mano. `gratis` es un plan RETIRADO, y los
   * retirados llevan SIN_TOPES a propósito. Entonces
   * `definicionDe(plan).limites.programas` daba null, el tope de
   * `crear-actions.ts` ni se ejecutaba, y una cuenta gratis podía crear
   * pases ilimitados.
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

  it("los retirados conservan SIN_TOPES: no se le quita a quien ya lo tenía", () => {
    expect(PLANES.gratis.limites.programas).toBeNull();
  });
});
