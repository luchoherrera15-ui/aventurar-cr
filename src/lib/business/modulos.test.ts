import { describe, expect, it } from "vitest";
import {
  MODULOS,
  TIPOS_NEGOCIO,
  definicionTipo,
  esModulo,
  modulosPorDefecto,
  resolverModulos,
  tipoNegocioEfectivo,
  tiposDeVertical,
  usaAgendaPorHoras,
  type ModuloId,
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
  it("sin filas guardadas usa el default del tipo", () => {
    const activos = resolverModulos({ tipo: "barberia" });
    expect([...activos].sort()).toEqual(modulosPorDefecto("barberia").sort());
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
    expect([...activos].sort()).toEqual(modulosPorDefecto("barberia").sort());
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
