import { describe, expect, it } from "vitest";
import { itemsMenuNegocio, type ItemMenu, type ParametrosMenu } from "./menu";
import {
  TIPOS_NEGOCIO,
  resolverModulos,
  tipoNegocioEfectivo,
  usaAgendaPorHoras,
  type TipoNegocioId,
} from "./modulos";
import { identidadDe } from "./identidad";

const ID = "11111111-2222-3333-4444-555555555555";

/**
 * Las ÚNICAS rutas que existen. La prueba de "ningún enlace muerto" se
 * hace contra esta lista y no contra un regex: si mañana alguien inventa
 * `/mi-negocio/[id]/clientes` sin construir la pantalla, esto falla.
 */
const RUTAS_REALES = [
  `/mi-negocio/${ID}`,
  `/mi-negocio/${ID}/citas`,
  // Promos: pantalla propia, para TODO tipo de negocio. No es un
  // módulo justamente por eso — anunciar lo puede hacer cualquiera.
  `/mi-negocio/${ID}/promos`,
];

/** Las pestañas que `page.tsx` monta de verdad. */
const TABS_REALES = ["inicio", "catalogo", "finanzas", "config"];

/** Un negocio de este tipo, con los módulos por defecto de su tipo. */
function menuDe(tipo: TipoNegocioId, extra: Partial<ParametrosMenu> = {}): ItemMenu[] {
  const definicion = TIPOS_NEGOCIO.find((t) => t.id === tipo)!;
  const vertical = definicion.verticales[0];
  return itemsMenuNegocio({
    ranchoId: ID,
    tipo,
    modulos: resolverModulos({ tipo }),
    vocabulario: identidadDe(tipo).vocabulario,
    // Los tipos de Citas siempre agendan por horas; en Eventos depende
    // de si es lugar o proveedor (misma regla que el panel).
    agendaPorHoras: usaAgendaPorHoras(vertical, tipo === "eventos_lugar" ? "lugares" : null),
    esVerticalCitas: vertical === "citas",
    etiquetaCatalogo: "Catálogo",
    ...extra,
  });
}

/** El href de un ítem, sin el `?query` ni el `#ancla`. */
function rutaDe(href: string): string {
  return href.split("?")[0].split("#")[0];
}

describe("itemsMenuNegocio — ningún ítem lleva a un 404", () => {
  for (const tipo of TIPOS_NEGOCIO) {
    it(`${tipo.id}: todo destino existe de verdad`, () => {
      for (const item of menuDe(tipo.id)) {
        expect(item.label.length, `${item.id} sin label`).toBeGreaterThan(0);
        if (item.destino.clase === "ruta") {
          expect(RUTAS_REALES, `${item.id} → ${item.destino.href}`).toContain(
            rutaDe(item.destino.href),
          );
        }
        if (item.destino.clase === "seccion") {
          expect(TABS_REALES, `${item.id} → ?tab=${item.destino.tab}`).toContain(
            item.destino.tab,
          );
        }
      }
    });

    it(`${tipo.id}: siempre tiene Inicio y Configuración`, () => {
      const ids = menuDe(tipo.id).map((i) => i.id);
      expect(ids[0]).toBe("inicio");
      expect(ids[ids.length - 1]).toBe("config");
    });
  }

  it("un módulo sin pantalla se muestra, pero no da enlace", () => {
    // Un consultorio declara cinco módulos clínicos y ninguno existe.
    const menu = menuDe("consultorio");
    const expediente = menu.find((i) => i.id === "expediente");
    expect(expediente?.destino).toEqual({ clase: "proximamente" });
    // Y aun así aparece: es lo que hace que el panel se vea de salud.
    expect(menu.map((i) => i.id)).toContain("recetas");
  });

  it("un negocio sin agenda del día no promete clientes ni reportes", () => {
    // Un lugar de eventos tiene los dos módulos ENCENDIDOS, pero su
    // única pantalla vive dentro de la agenda de citas, que no tiene.
    const menu = menuDe("eventos_lugar");
    expect(menu.find((i) => i.id === "clientes")?.destino.clase).toBe("proximamente");
    expect(menu.find((i) => i.id === "reportes")?.destino.clase).toBe("proximamente");
    // Y no duplica Inicio con un ítem de agenda: su calendario del mes
    // ES el cuerpo de Inicio.
    expect(menu.map((i) => i.id)).not.toContain("agenda");
  });
});

describe("itemsMenuNegocio — el vocabulario del tipo manda", () => {
  it("un consultorio dice Pacientes y Consultas", () => {
    const menu = menuDe("consultorio");
    expect(menu.find((i) => i.id === "clientes")?.label).toBe("Pacientes");
    expect(menu.find((i) => i.id === "agenda")?.label).toBe("Consultas");
  });

  it("un gimnasio dice Miembros y Sesiones", () => {
    const menu = menuDe("gimnasio");
    expect(menu.find((i) => i.id === "clientes")?.label).toBe("Miembros");
    expect(menu.find((i) => i.id === "agenda")?.label).toBe("Sesiones");
  });

  it("una academia dice Alumnos y Clases", () => {
    const menu = menuDe("academia");
    expect(menu.find((i) => i.id === "clientes")?.label).toBe("Alumnos");
    expect(menu.find((i) => i.id === "agenda")?.label).toBe("Clases");
  });
});

describe("los cuatro negocios vivos (tipo_negocio en NULL)", () => {
  // Se derivan de su categoría, exactamente como en producción.
  const vivos: [string, string, TipoNegocioId][] = [
    ["Silence Barber Shop", "barberia", "barberia"],
    ["Nails Studio", "unas", "unas"],
    ["Zen Spa", "spa", "spa"],
    ["Salón Elegance", "belleza", "salon_belleza"],
  ];

  for (const [nombre, categoria, esperado] of vivos) {
    it(`${nombre}: sigue teniendo su menú, ahora completo`, () => {
      const tipo = tipoNegocioEfectivo("citas", categoria, null);
      expect(tipo).toBe(esperado);

      const menu = menuDe(tipo);
      const ids = menu.map((i) => i.id);
      // Lo que YA tenía y no se puede perder.
      expect(ids).toContain("inicio");
      expect(ids).toContain("agenda");
      expect(ids).toContain("pagos");
      expect(ids).toContain("config");
      // Y lo que le faltaba: su gente y su equipo, con destino real.
      expect(menu.find((i) => i.id === "clientes")?.destino).toEqual({
        clase: "ruta",
        href: `/mi-negocio/${ID}/citas#clientes`,
      });
      expect(menu.find((i) => i.id === "equipo")?.destino).toEqual({
        clase: "ruta",
        href: `/mi-negocio/${ID}?tab=config&seccion=equipo`,
      });
      // Su agenda del día se llama "Citas" (vertical Citas).
      expect(menu.find((i) => i.id === "agenda")?.label).toBe("Citas");
    });
  }
});
