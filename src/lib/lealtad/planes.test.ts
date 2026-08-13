import { describe, expect, it } from "vitest";
import {
  definicionDe,
  esPlan,
  estadoDelLimite,
  mesesDeAhorroAnual,
  precioDe,
  ETIQUETAS_LIMITE,
  PLANES,
  PLANES_ID,
  PLANES_OFRECIDOS,
  PLANES_RETIRADOS,
  PLAN_DESTACADO,
  puede,
  type Capacidad,
  type LimitesPlan,
} from "./planes";

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

  it("no se les baja el tope por un cambio de catálogo", () => {
    // Quitarle capacidad a quien ya compró sería cobrarle lo mismo por
    // menos. Los retirados quedan sin topes a propósito.
    for (const id of ["basico", "estandar", "enterprise"] as const) {
      expect(PLANES[id].limites.clientesActivos).toBeNull();
      expect(PLANES[id].limites.programas).toBeNull();
    }
  });

  it("no se ofrecen", () => {
    for (const id of PLANES_RETIRADOS) {
      expect(PLANES_OFRECIDOS as readonly string[]).not.toContain(id);
    }
  });
});

describe("el catálogo de Lealtad", () => {
  it("tiene los precios acordados", () => {
    expect(PLANES.prueba.precioMensual).toBe(0);
    expect(PLANES.esencial.precioMensual).toBe(9);
    expect(PLANES.crece.precioMensual).toBe(27);
    expect(PLANES.pro.precioMensual).toBe(69);
    // Empresa se cotiza caso por caso: sin cifra inventada.
    expect(PLANES.empresa.precioMensual).toBeNull();
  });

  it("el anual regala exactamente dos meses", () => {
    // El copy dice «Ahorrá 2 meses» y ese 2 sale del cálculo, no de un
    // texto escrito a mano que se desincroniza al cambiar un precio.
    for (const id of ["esencial", "crece", "pro"] as const) {
      expect(mesesDeAhorroAnual(PLANES[id])).toBe(2);
    }
  });

  it("la prueba es de 14 días y es el único plan de prueba", () => {
    expect(PLANES.prueba.diasPrueba).toBe(14);
    for (const id of PLANES_OFRECIDOS) {
      if (id !== "prueba") expect(PLANES[id].diasPrueba).toBe(0);
    }
  });

  it("«Crece» es el destacado", () => {
    expect(PLAN_DESTACADO).toBe("crece");
    expect(PLANES[PLAN_DESTACADO].vigente).toBe(true);
  });

  it("los ocho tipos de tarjeta vienen desde el primer plan", () => {
    // Decisión de producto: lo que se cobra es la ESCALA, no desbloquear
    // una funcionalidad que ya está escrita.
    for (const id of PLANES_OFRECIDOS) {
      expect(puede(id, "tipos_de_tarjeta")).toBe(true);
      expect(puede(id, "reglas_y_vencimientos")).toBe(true);
    }
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
      notificacionesMes: 200,
      administradores: 1,
      sedes: 1,
    });
    expect(PLANES.esencial.limites).toMatchObject({
      clientesActivos: 75,
      programas: 2,
      notificacionesMes: 1_000,
      administradores: 3,
      sedes: 1,
      automatizaciones: 2,
    });
    expect(PLANES.crece.limites).toMatchObject({
      clientesActivos: 225,
      programas: 6,
      notificacionesMes: 3_500,
      administradores: 6,
      sedes: 3,
      automatizaciones: 10,
    });
    expect(PLANES.pro.limites).toMatchObject({
      clientesActivos: 750,
      programas: 15,
      notificacionesMes: 12_000,
      administradores: 15,
      sedes: 10,
    });
    // Empresa: sin techo en nada.
    for (const v of Object.values(PLANES.empresa.limites)) expect(v).toBeNull();
  });
});

describe("precioDe", () => {
  it("escribe dólares con símbolo y sin centavos de relleno", () => {
    expect(precioDe(PLANES.esencial)).toBe("$9");
    expect(precioDe(PLANES.crece)).toBe("$27");
    expect(precioDe(PLANES.pro)).toBe("$69");
  });

  it("da el precio anual cuando se lo piden", () => {
    expect(precioDe(PLANES.esencial, "año")).toBe("$90");
    expect(precioDe(PLANES.crece, "año")).toBe("$270");
    expect(precioDe(PLANES.pro, "año")).toBe("$690");
  });

  it("la prueba es cero y el negociado no tiene cifra", () => {
    expect(precioDe(PLANES.prueba)).toBe("$0");
    expect(precioDe(PLANES.empresa)).toBeNull();
    // Tampoco inventa un anual donde no lo hay.
    expect(precioDe(PLANES.prueba, "año")).toBeNull();
  });
});

describe("puede", () => {
  it("Esencial trae lo básico y nada de lo que se cobra arriba", () => {
    expect(puede("esencial", "wallet")).toBe(true);
    expect(puede("esencial", "analitica")).toBe(true);
    expect(puede("esencial", "segmentacion")).toBe(false);
    expect(puede("esencial", "api")).toBe(false);
    expect(puede("esencial", "webhooks")).toBe(false);
  });

  it("Crece suma segmentación, campañas programadas y webhooks", () => {
    expect(puede("crece", "segmentacion")).toBe(true);
    expect(puede("crece", "campanas_programadas")).toBe(true);
    expect(puede("crece", "analitica_avanzada")).toBe(true);
    expect(puede("crece", "webhooks")).toBe(true);
    // La API se reserva para Pro.
    expect(puede("crece", "api")).toBe(false);
  });

  it("Pro abre la API, el POS y los roles avanzados", () => {
    expect(puede("pro", "api")).toBe(true);
    expect(puede("pro", "pos")).toBe(true);
    expect(puede("pro", "exportacion")).toBe(true);
    expect(puede("pro", "roles_avanzados")).toBe(true);
    // Lo de franquicia y marca blanca queda para Empresa.
    expect(puede("pro", "marca_blanca")).toBe(false);
  });

  it("Empresa trae todo", () => {
    expect(puede("empresa", "franquicias")).toBe(true);
    expect(puede("empresa", "sla")).toBe(true);
    expect(puede("empresa", "marca_blanca")).toBe(true);
    expect(puede("empresa", "soporte_dedicado")).toBe(true);
  });

  it("sin plan no puede nada", () => {
    for (const cap of PLANES.empresa.capacidades) {
      expect(puede(null, cap)).toBe(false);
    }
  });

  it("un complemento regalado abre una capacidad sin subir de plan", () => {
    expect(puede("esencial", "cercania")).toBe(false);
    expect(puede("esencial", "cercania", ["pases_cercania"])).toBe(true);
  });

  it("un complemento de otra cosa no abre la capacidad pedida", () => {
    expect(puede("esencial", "cercania", ["pases_api", "agenda_ia"])).toBe(false);
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
    const e = estadoDelLimite("esencial", "clientesActivos", 30);
    expect(e).toMatchObject({ limite: 75, disponibles: 45, lleno: false, cerca: false });
    expect(e.porcentaje).toBe(40);
  });

  it("avisa al 80%, no al 95%", () => {
    // Enterarse cuando ya casi no entra nadie no deja tiempo de decidir.
    expect(estadoDelLimite("esencial", "clientesActivos", 59).cerca).toBe(false);
    expect(estadoDelLimite("esencial", "clientesActivos", 60).cerca).toBe(true);
    expect(estadoDelLimite("esencial", "clientesActivos", 60).lleno).toBe(false);
  });

  it("marca lleno justo en el tope, no después", () => {
    expect(estadoDelLimite("esencial", "clientesActivos", 74).lleno).toBe(false);
    expect(estadoDelLimite("esencial", "clientesActivos", 75).lleno).toBe(true);
  });

  it("pasado el tope no muestra disponibles negativos ni pasa de 100%", () => {
    const e = estadoDelLimite("esencial", "clientesActivos", 200);
    expect(e.disponibles).toBe(0);
    expect(e.lleno).toBe(true);
    expect(e.porcentaje).toBe(100);
  });

  it("sirve para cualquier tope, no solo clientes", () => {
    expect(estadoDelLimite("esencial", "programas", 2).lleno).toBe(true);
    expect(estadoDelLimite("crece", "programas", 2).lleno).toBe(false);
    expect(estadoDelLimite("esencial", "notificacionesMes", 1_000).lleno).toBe(true);
    expect(estadoDelLimite("pro", "sedes", 3).lleno).toBe(false);
  });

  it("sin tope nunca está lleno ni cerca", () => {
    const e = estadoDelLimite("empresa", "clientesActivos", 999_999);
    expect(e.limite).toBeNull();
    expect(e.lleno).toBe(false);
    expect(e.cerca).toBe(false);
    expect(e.porcentaje).toBe(0);
  });

  it("sin plan no hay tope declarado", () => {
    expect(estadoDelLimite(null, "clientesActivos", 10).limite).toBeNull();
  });
});

describe("definicionDe", () => {
  it("devuelve null para lo que no es plan", () => {
    expect(definicionDe(null)).toBeNull();
    expect(definicionDe("premium")).toBeNull();
    expect(definicionDe("prueba")?.limites.clientesActivos).toBe(25);
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
