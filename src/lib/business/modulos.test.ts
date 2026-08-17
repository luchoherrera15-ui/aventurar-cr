import { describe, expect, it } from "vitest";
import {
  MODULOS,
  MODULOS_BASE,
  TIPOS_NEGOCIO,
  definicionModulo,
  definicionTipo,
  esModulo,
  modulosPorDefecto,
  modulosProximamente,
  resolverModulos,
  tipoNegocioEfectivo,
  tiposDeVertical,
  usaAgendaPorHoras,
  type ModuloId,
  type TipoNegocioId,
} from "./modulos";
import { palabraReserva, widgetsDashboard } from "./widgets";
import { contextoDesdeDatos } from "./contexto";

describe("tipoNegocioEfectivo", () => {
  it("deriva el tipo de la categoría cuando el negocio no eligió ninguno", () => {
    expect(tipoNegocioEfectivo("citas", "barberia", null)).toBe("barberia");
    expect(tipoNegocioEfectivo("citas", "belleza", null)).toBe("salon_belleza");
    expect(tipoNegocioEfectivo("citas", "unas", null)).toBe("unas");
    expect(tipoNegocioEfectivo("citas", "spa", null)).toBe("spa");
    expect(tipoNegocioEfectivo("citas", "consultorio", null)).toBe("consultorio");
    expect(tipoNegocioEfectivo("eventos", "lugares", null)).toBe("eventos_lugar");
    expect(tipoNegocioEfectivo("eventos", "alimentacion", null)).toBe("eventos_proveedor");
    expect(tipoNegocioEfectivo("hospedajes", "casa", null)).toBe("hospedaje");
    expect(tipoNegocioEfectivo("restaurantes", "pizza", null)).toBe("restaurante");
  });

  it("cae en algo razonable con datos raros o ausentes", () => {
    expect(tipoNegocioEfectivo("citas", "loquesea", null)).toBe("otro");
    expect(tipoNegocioEfectivo(null, null, null)).toBe("eventos_proveedor");
    expect(tipoNegocioEfectivo("vertical_futura", "x", null)).toBe("eventos_proveedor");
  });

  it("el tipo elegido por el dueño le gana a la categoría", () => {
    // El caso que motiva todo esto: un gimnasio publicado en la
    // categoría 'otros' del directorio de Citas.
    expect(tipoNegocioEfectivo("citas", "otros", "gimnasio")).toBe("gimnasio");
    expect(tipoNegocioEfectivo("citas", "barberia", "pilates")).toBe("pilates");
  });

  it("ignora un tipo guardado que el código no conoce", () => {
    expect(tipoNegocioEfectivo("citas", "barberia", "tipo_inventado")).toBe("barberia");
  });
});

describe("usaAgendaPorHoras", () => {
  it("toda la vertical de Citas agenda por horas", () => {
    for (const categoria of ["barberia", "belleza", "unas", "spa", "consultorio", "otros"]) {
      expect(usaAgendaPorHoras("citas", categoria), categoria).toBe(true);
    }
  });

  it("los proveedores de eventos también: un DJ toca a las 3 y a las 9", () => {
    for (const categoria of [
      "alimentacion",
      "animacion",
      "organizacion",
      "decoracion",
      "otros",
    ]) {
      expect(usaAgendaPorHoras("eventos", categoria), categoria).toBe(true);
    }
  });

  it("los LUGARES no: su fecha se alquila entera", () => {
    expect(usaAgendaPorHoras("eventos", "lugares")).toBe(false);
    // Ni siquiera cuando la vertical llega en null (fila vieja sin
    // migrar): lo que manda para un lugar es su categoría.
    expect(usaAgendaPorHoras(null, "lugares")).toBe(false);
    expect(usaAgendaPorHoras(undefined, "lugares")).toBe(false);
  });

  it("la frontera es la misma que parte eventos_lugar de eventos_proveedor", () => {
    for (const categoria of ["lugares", "alimentacion", "animacion", "otros", "loquesea"]) {
      const esProveedor =
        tipoNegocioEfectivo("eventos", categoria, null) === "eventos_proveedor";
      expect(usaAgendaPorHoras("eventos", categoria), categoria).toBe(esProveedor);
    }
  });

  it("Hospedajes y Restaurantes quedan fuera hasta que se decida su panel", () => {
    expect(usaAgendaPorHoras("hospedajes", "casa")).toBe(false);
    expect(usaAgendaPorHoras("restaurantes", "pizza")).toBe(false);
    expect(usaAgendaPorHoras("vertical_futura", "x")).toBe(false);
  });
});

describe("el menú de un negocio que ya existía no pierde nada", () => {
  /**
   * La regla VIEJA, tal cual estaba cableada en page.tsx antes de la
   * Fase 1: `esVerticalCitas ? [...] : [...]`.
   */
  function menuViejo(vertical: string, categoria: string): string[] {
    const esLugar = categoria === "lugares";
    return vertical === "citas"
      ? ["inicio", "citas", "finanzas", "config"]
      : ["inicio", ...(!esLugar ? ["catalogo"] : []), "finanzas", "config"];
  }

  /** La regla NUEVA, la misma que arma el menú en page.tsx. */
  function menuNuevo(vertical: string, categoria: string): string[] {
    const tipo = tipoNegocioEfectivo(vertical, categoria, null);
    const modulos = resolverModulos({ tipo });
    return [
      "inicio",
      ...(usaAgendaPorHoras(vertical, categoria) && modulos.has("agenda") ? ["citas"] : []),
      ...(vertical !== "citas" && modulos.has("servicios") ? ["catalogo"] : []),
      ...(modulos.has("pagos") ? ["finanzas"] : []),
      "config",
    ];
  }

  /**
   * Lo ÚNICO que cambió: el proveedor de eventos gana la pantalla de
   * agenda del día que antes solo veía Citas. Nadie PIERDE un ítem —
   * que es lo que este bloque cuida desde la Fase 1.
   */
  function menuEsperado(vertical: string, categoria: string): string[] {
    const viejo = menuViejo(vertical, categoria);
    if (usaAgendaPorHoras(vertical, categoria) && !viejo.includes("citas")) {
      viejo.splice(1, 0, "citas");
    }
    return viejo;
  }

  const CASOS: [string, string][] = [
    ["citas", "barberia"],
    ["citas", "belleza"],
    ["citas", "unas"],
    ["citas", "spa"],
    ["citas", "consultorio"],
    ["citas", "otros"],
    ["eventos", "lugares"],
    ["eventos", "alimentacion"],
    ["eventos", "animacion"],
    ["eventos", "organizacion"],
    ["eventos", "decoracion"],
    ["eventos", "otros"],
    ["hospedajes", "casa"],
    ["hospedajes", "villa"],
    ["restaurantes", "pizza"],
    ["restaurantes", "tipica"],
  ];

  for (const [vertical, categoria] of CASOS) {
    it(`${vertical}/${categoria} conserva todo su menú`, () => {
      expect(menuNuevo(vertical, categoria)).toEqual(menuEsperado(vertical, categoria));
    });
  }

  it("citas y los lugares de eventos ven EXACTAMENTE el menú de antes", () => {
    for (const [vertical, categoria] of CASOS) {
      if (vertical === "citas" || !usaAgendaPorHoras(vertical, categoria)) {
        expect(menuNuevo(vertical, categoria), `${vertical}/${categoria}`).toEqual(
          menuViejo(vertical, categoria),
        );
      }
    }
  });

  it("un proveedor de eventos suma la agenda del día, y un lugar no", () => {
    expect(menuNuevo("eventos", "animacion")).toContain("citas");
    expect(menuNuevo("eventos", "lugares")).not.toContain("citas");
  });
});

describe("resolverModulos", () => {
  /**
   * El default del tipo SIN lo que todavía no tiene pantalla: es contra
   * esto que se compara el conjunto activo, porque un tipo declara
   * también lo que va a tener (ver "declarar no es construir").
   */
  const defaultAbierto = (tipo: TipoNegocioId): ModuloId[] =>
    modulosPorDefecto(tipo)
      .filter((m) => definicionModulo(m).disponible)
      .sort();

  it("sin filas guardadas usa el default del tipo", () => {
    const activos = resolverModulos({ tipo: "barberia" });
    expect([...activos].sort()).toEqual(defaultAbierto("barberia"));
  });

  it("un proveedor de eventos trae Equipo; un lugar no", () => {
    // Quien agenda por horas necesita decir quién atiende y cuándo. El
    // lugar alquila el salón entero: no tiene a quién asignarle nada.
    expect(modulosPorDefecto("eventos_proveedor")).toContain("equipo" as ModuloId);
    expect(modulosPorDefecto("eventos_lugar")).not.toContain("equipo" as ModuloId);
    expect(resolverModulos({ tipo: "eventos_proveedor" }).has("equipo")).toBe(true);
    // Y se puede apagar, como cualquier módulo: el pintacaritas que
    // trabaja solo no ve la sección.
    expect(
      resolverModulos({ tipo: "eventos_proveedor", overrides: { equipo: false } }).has("equipo"),
    ).toBe(false);
  });

  it("una fila apagada quita el módulo", () => {
    const activos = resolverModulos({ tipo: "barberia", overrides: { equipo: false } });
    expect(activos.has("equipo")).toBe(false);
    expect(activos.has("agenda")).toBe(true);
  });

  it("una fila encendida agrega un módulo que el tipo no traía", () => {
    expect(resolverModulos({ tipo: "barberia" }).has("clientes")).toBe(true);
    const sinClientes = resolverModulos({ tipo: "eventos_lugar", overrides: { servicios: true } });
    expect(sinClientes.has("servicios")).toBe(true);
  });

  it("ignora ids de módulo que el código no conoce", () => {
    const activos = resolverModulos({
      tipo: "barberia",
      overrides: { sitio_web: true, inventado: true },
    });
    expect([...activos].sort()).toEqual(defaultAbierto("barberia"));
  });

  it("nunca activa un módulo que todavía no tiene pantalla", () => {
    // 'clases' viene por defecto en pilates, pero llega en la Fase 4.
    expect(modulosPorDefecto("pilates")).toContain("clases" as ModuloId);
    const activos = resolverModulos({ tipo: "pilates", overrides: { membresias: true } });
    expect(activos.has("clases")).toBe(false);
    expect(activos.has("membresias")).toBe(false);
    // Lo que sí existe hoy sigue encendido.
    expect(activos.has("agenda")).toBe(true);
    expect(activos.has("pagos")).toBe(true);
  });
});

describe("integridad de los registros", () => {
  it("todos los módulos por defecto de cada tipo existen", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      for (const modulo of tipo.modulos) {
        expect(esModulo(modulo), `${tipo.id} → ${modulo}`).toBe(true);
      }
    }
  });

  it("no hay ids repetidos", () => {
    expect(new Set(MODULOS.map((m) => m.id)).size).toBe(MODULOS.length);
    expect(new Set(TIPOS_NEGOCIO.map((t) => t.id)).size).toBe(TIPOS_NEGOCIO.length);
  });

  it("cada vertical tiene al menos un tipo para elegir", () => {
    for (const vertical of ["citas", "eventos", "hospedajes", "restaurantes"]) {
      expect(tiposDeVertical(vertical).length, vertical).toBeGreaterThan(0);
    }
  });

  it("todo tipo cobra por algo: ninguno se queda sin Pagos", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      expect(definicionTipo(tipo.id).modulos, tipo.id).toContain("pagos");
    }
  });

  it("todo tipo trae el piso: agenda, clientes, pagos y reportes", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      for (const base of MODULOS_BASE) {
        expect(tipo.modulos, `${tipo.id} → ${base}`).toContain(base);
      }
    }
  });

  it("no hay definiciones muertas: todo módulo lo declara algún tipo", () => {
    // Un módulo que ningún tipo declara no se puede encender (los que
    // no tienen pantalla ni siquiera con un override), así que sería
    // una fila de "próximamente" que nadie ve nunca.
    const declarados = new Set(TIPOS_NEGOCIO.flatMap((t) => [...t.modulos] as ModuloId[]));
    for (const modulo of MODULOS) {
      expect(declarados.has(modulo.id), modulo.id).toBe(true);
    }
  });
});

describe("los tipos se diferencian de verdad", () => {
  /** Belleza y salud: las familias que esta tanda tenía que separar. */
  const AFINADOS = TIPOS_NEGOCIO.filter(
    (t) => t.familia === "belleza" || t.familia === "salud",
  );

  it("una barbería y un consultorio no ven lo mismo", () => {
    const barberia = new Set(modulosPorDefecto("barberia"));
    const consultorio = new Set(modulosPorDefecto("consultorio"));
    // Lo clínico es del consultorio; la comisión y el inventario, de la
    // barbería. Si algún día esto se cruza, es un error de catálogo.
    expect(consultorio.has("expediente")).toBe(true);
    expect(barberia.has("expediente")).toBe(false);
    expect(barberia.has("comisiones")).toBe(true);
    expect(consultorio.has("comisiones")).toBe(false);
  });

  it("ningún par de belleza o salud termina con la misma lista", () => {
    const huellas = new Map<string, TipoNegocioId>();
    for (const tipo of AFINADOS) {
      const huella = [...tipo.modulos].sort().join("|");
      const previo = huellas.get(huella);
      expect(previo, `${tipo.id} declara lo mismo que ${previo}`).toBeUndefined();
      huellas.set(huella, tipo.id);
    }
  });

  it("ninguno se quedó en la lista genérica de antes", () => {
    // Antes de esta tanda los siete declaraban los mismos seis módulos.
    // Cada uno tiene que aportar ahora al menos una herramienta que lo
    // explique — si no, el panel sigue sin saber qué negocio es.
    const GENERICA: ModuloId[] = [
      "agenda",
      "clientes",
      "servicios",
      "equipo",
      "pagos",
      "reportes",
    ];
    for (const tipo of AFINADOS) {
      const propios = [...tipo.modulos].filter((m) => !GENERICA.includes(m));
      expect(propios.length, `${tipo.id} no agrega nada a la lista genérica`).toBeGreaterThan(0);
    }
  });

  it("lo clínico es exclusivo de la familia salud", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const clinicos = [...tipo.modulos].filter(
        (m) => definicionModulo(m).grupo === "clinica",
      );
      if (tipo.familia !== "salud") {
        expect(clinicos, `${tipo.id} declara módulos clínicos`).toEqual([]);
      }
    }
    expect(modulosPorDefecto("consultorio")).toContain("recetas" as ModuloId);
    // Quien no prescribe no declara recetas ni laboratorio.
    expect(modulosPorDefecto("profesional")).not.toContain("recetas" as ModuloId);
    expect(modulosPorDefecto("profesional")).not.toContain("laboratorio" as ModuloId);
  });
});

describe("declarar no es construir", () => {
  it("modulosProximamente es exactamente lo declarado que aún no existe", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const proximos = modulosProximamente(tipo.id);
      const activos = resolverModulos({ tipo: tipo.id });
      // Ninguno de los "próximamente" está activo…
      for (const m of proximos) {
        expect(definicionModulo(m).disponible, `${tipo.id} → ${m}`).toBe(false);
        expect(activos.has(m), `${tipo.id} → ${m}`).toBe(false);
      }
      // …y activos + próximos reconstruyen el default completo.
      expect([...new Set([...activos, ...proximos])].sort()).toEqual(
        [...new Set(modulosPorDefecto(tipo.id))].sort(),
      );
    }
  });

  it("ningún tipo puede activar una pantalla que no existe, ni forzándolo", () => {
    // El override es lo más parecido a un ataque que hay acá: una fila
    // escrita a mano en `modulos_negocio`. Ni así.
    const todoEncendido = Object.fromEntries(MODULOS.map((m) => [m.id, true]));
    for (const tipo of TIPOS_NEGOCIO) {
      const activos = resolverModulos({ tipo: tipo.id, overrides: todoEncendido });
      for (const modulo of activos) {
        expect(definicionModulo(modulo).disponible, `${tipo.id} → ${modulo}`).toBe(true);
      }
    }
  });

  it("los tipos afinados suman identidad sin sumar pantallas", () => {
    // La prueba de que esta tanda no le cambió el panel a nadie: los
    // módulos clínicos, las comisiones y el inventario están
    // declarados, pero el conjunto activo no los ve.
    expect(modulosProximamente("consultorio").length).toBeGreaterThan(0);
    expect(modulosProximamente("barberia")).toContain("comisiones" as ModuloId);
    expect(resolverModulos({ tipo: "barberia" }).has("comisiones")).toBe(false);
  });
});

describe("los negocios vivos no pierden nada", () => {
  /**
   * Los cuatro que están en producción hoy (SILENCE BARBER SHOP, Nails
   * Studio, Zen Spa, Salón Elegance) más el consultorio, que es el que
   * más módulos nuevos declara. Su panel tiene que seguir siendo
   * EXACTAMENTE el de siempre.
   */
  const SIEMPRE: ModuloId[] = ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"];

  for (const tipo of ["barberia", "unas", "spa", "salon_belleza", "consultorio"] as const) {
    it(`${tipo} ve los mismos seis módulos que antes`, () => {
      expect([...resolverModulos({ tipo })].sort()).toEqual([...SIEMPRE].sort());
    });
  }

  it("un profesional independiente sigue sin Equipo y con todo lo demás", () => {
    expect([...resolverModulos({ tipo: "profesional" })].sort()).toEqual(
      SIEMPRE.filter((m) => m !== "equipo").sort(),
    );
  });

  /**
   * El conjunto ACTIVO de cada tipo tal como quedaba antes de esta
   * tanda, escrito a mano y no derivado del catálogo: si se deriva, un
   * borrado accidental se derivaría también y el test no vería nada.
   *
   * Son los seis módulos que las pantallas leen de verdad hoy —
   * `agenda`, `equipo` y `servicios` en mi-negocio/[id]/page.tsx;
   * `clientes` y `reportes` en mi-negocio/[id]/citas/page.tsx; `pagos`
   * en la pestaña de Finanzas, en widgets.ts y en el panel-nav de la
   * app móvil.
   */
  const ANTES: Record<TipoNegocioId, ModuloId[]> = {
    barberia: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
    salon_belleza: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
    unas: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
    spa: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
    masajes: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
    consultorio: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
    profesional: ["agenda", "clientes", "servicios", "pagos", "reportes"],
    gimnasio: ["agenda", "clientes", "equipo", "pagos", "reportes"],
    crossfit: ["agenda", "clientes", "equipo", "pagos", "reportes"],
    pilates: ["agenda", "clientes", "equipo", "pagos", "reportes"],
    yoga: ["agenda", "clientes", "equipo", "pagos", "reportes"],
    entrenador: ["agenda", "clientes", "servicios", "pagos", "reportes"],
    academia: ["agenda", "clientes", "equipo", "pagos", "reportes"],
    eventos_lugar: ["agenda", "clientes", "pagos", "reportes"],
    eventos_proveedor: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
    hospedaje: ["agenda", "clientes", "servicios", "pagos", "reportes"],
    restaurante: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
    otro: ["agenda", "clientes", "servicios", "pagos", "reportes"],
  };

  it("ningún tipo cambió el panel que ya mostraba", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      expect([...resolverModulos({ tipo: tipo.id })].sort(), tipo.id).toEqual(
        [...ANTES[tipo.id]].sort(),
      );
    }
  });
});

describe("widgets del tablero", () => {
  it("una barbería habla de citas y un salón de eventos de reservas", () => {
    expect(palabraReserva("barberia").Plural).toBe("Citas");
    expect(palabraReserva("eventos_lugar").Plural).toBe("Reservas");
    expect(palabraReserva("hospedaje").singular).toBe("estadía");
  });

  it("titula el widget con la palabra del negocio", () => {
    const widgets = widgetsDashboard({
      tipo: "barberia",
      modulos: resolverModulos({ tipo: "barberia" }),
      ocupacionDisponible: false,
    });
    expect(widgets.find((w) => w.id === "reservas_mes")?.titulo).toBe("Citas este mes");
    expect(widgets.find((w) => w.id === "proxima_reserva")?.titulo).toBe("Próxima cita");
    // Solo Lugares puede calcular ocupación por día.
    expect(widgets.some((w) => w.id === "ocupacion_30")).toBe(false);
  });

  it("un negocio sin Pagos no muestra números de plata", () => {
    const widgets = widgetsDashboard({
      tipo: "barberia",
      modulos: resolverModulos({ tipo: "barberia", overrides: { pagos: false } }),
      ocupacionDisponible: false,
    });
    expect(widgets.some((w) => w.id === "ingresos_mes")).toBe(false);
    expect(widgets.some((w) => w.id === "reservas_mes")).toBe(true);
  });

  it("Lugares suma la ocupación", () => {
    const widgets = widgetsDashboard({
      tipo: "eventos_lugar",
      modulos: resolverModulos({ tipo: "eventos_lugar" }),
      ocupacionDisponible: true,
    });
    expect(widgets.some((w) => w.id === "ocupacion_30")).toBe(true);
  });
});

describe("contextoDesdeDatos", () => {
  it("marca si el tipo lo eligió el dueño", () => {
    const derivado = contextoDesdeDatos(
      { id: "n1", vertical: "citas", categoria: "barberia" },
      {},
    );
    expect(derivado.tipo).toBe("barberia");
    expect(derivado.tipoExplicito).toBe(false);

    const elegido = contextoDesdeDatos(
      { id: "n1", vertical: "citas", categoria: "otros", tipo_negocio: "gimnasio" },
      {},
    );
    expect(elegido.tipo).toBe("gimnasio");
    expect(elegido.tipoExplicito).toBe(true);
  });

  // Un tipo guardado que este deploy no conoce (dato viejo, un id que se
  // renombró) NO cuenta como elegido: `tipoNegocioEfectivo` lo ignora y
  // deriva igual, así que decirle al dueño "vos elegiste esto" sería
  // falso y le escondería el aviso para confirmar el derivado.
  it("un tipo guardado que no está en el catálogo cuenta como no elegido", () => {
    const ctx = contextoDesdeDatos(
      { id: "n1", vertical: "citas", categoria: "barberia", tipo_negocio: "peluqueria_canina" },
      {},
    );
    expect(ctx.tipo).toBe("barberia");
    expect(ctx.tipoExplicito).toBe(false);
  });

  it("sin la migración corrida el negocio funciona con sus defaults", () => {
    const ctx = contextoDesdeDatos(
      { id: "n1", vertical: "citas", categoria: "barberia" },
      {},
      'relation "modulos_negocio" does not exist',
    );
    expect(ctx.errorModulos).toContain("modulos_negocio");
    expect(ctx.modulos.has("agenda")).toBe(true);
    expect(ctx.modulos.has("pagos")).toBe(true);
  });
});
