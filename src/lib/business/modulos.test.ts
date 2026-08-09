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

describe("el menú de un negocio que ya existía no cambia", () => {
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
      ...(vertical === "citas" && modulos.has("agenda") ? ["citas"] : []),
      ...(vertical !== "citas" && modulos.has("servicios") ? ["catalogo"] : []),
      ...(modulos.has("pagos") ? ["finanzas"] : []),
      "config",
    ];
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
    it(`${vertical}/${categoria} ve exactamente el mismo menú`, () => {
      expect(menuNuevo(vertical, categoria)).toEqual(menuViejo(vertical, categoria));
    });
  }
});

describe("resolverModulos", () => {
  it("sin filas guardadas usa el default del tipo", () => {
    const activos = resolverModulos({ tipo: "barberia" });
    expect([...activos].sort()).toEqual(modulosPorDefecto("barberia").sort());
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
