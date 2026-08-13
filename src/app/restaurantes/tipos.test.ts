import { describe, expect, it } from "vitest";
import {
  agruparMenu,
  anclaDeSeccion,
  horarioDeDetalles,
  opcionesDeDetalles,
  type ItemMenu,
} from "./tipos";

/**
 * Lo que se prueba acá es la LECTURA del jsonb del negocio, que es la
 * parte que puede llegar con cualquier cosa adentro: `detalles` lo
 * escriben el panel, los seeds y la app móvil, y la ficha pública se
 * dibuja con lo que salga. Un tema inventado no puede tumbar la
 * página ni colarse como clase de CSS.
 */

function item(parcial: Partial<ItemMenu> & { id: string }): ItemMenu {
  return {
    nombre: "Plato",
    descripcion: null,
    precio: null,
    unidad: null,
    grupo: null,
    foto_url: null,
    ...parcial,
  };
}

describe("opcionesDeDetalles", () => {
  it("sin detalles deja el tema de siempre", () => {
    expect(opcionesDeDetalles(null).tema).toBe("estandar");
    expect(opcionesDeDetalles({}).tema).toBe("estandar");
  });

  it("respeta el tema que declaró el negocio", () => {
    expect(opcionesDeDetalles({ tema_ficha: "carta" }).tema).toBe("carta");
  });

  it("un tema que no existe cae en estandar, no revienta", () => {
    expect(opcionesDeDetalles({ tema_ficha: "elegante" }).tema).toBe("estandar");
    expect(opcionesDeDetalles({ tema_ficha: 7 }).tema).toBe("estandar");
  });

  it("sigue leyendo lo de antes", () => {
    const o = opcionesDeDetalles({
      acepta_pickup: true,
      acepta_reserva_mesa: false,
      rango_precio: 2,
    });
    expect(o).toMatchObject({
      aceptaPickup: true,
      aceptaReservaMesa: false,
      rangoPrecio: 2,
    });
  });
});

describe("horarioDeDetalles", () => {
  it("lee el horario del restaurante, no el de citas", () => {
    const detalles = {
      horario_citas: { 1: { abre: "09:00", cierra: "19:00" } },
      horario_restaurante: { 1: null, 2: { abre: "07:00", cierra: "18:00" } },
    };
    const h = horarioDeDetalles(detalles);
    expect(h?.["1"]).toBeNull();
    expect(h?.["2"]).toEqual({ abre: "07:00", cierra: "18:00" });
  });

  it("sin horario devuelve null", () => {
    expect(horarioDeDetalles({})).toBeNull();
    expect(horarioDeDetalles(undefined)).toBeNull();
  });
});

describe("agruparMenu", () => {
  it("conserva el orden de las secciones y el de los platos", () => {
    const secciones = agruparMenu([
      item({ id: "1", grupo: "Espresso" }),
      item({ id: "2", grupo: "Fríos" }),
      item({ id: "3", grupo: "Espresso" }),
    ]);
    expect(secciones.map(([g]) => g)).toEqual(["Espresso", "Fríos"]);
    expect(secciones[0][1].map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("lo que no declara sección cae en una general", () => {
    const secciones = agruparMenu([item({ id: "1" }), item({ id: "2", grupo: "  " })]);
    expect(secciones).toHaveLength(1);
    expect(secciones[0][0]).toBe("Menú");
  });
});

describe("anclaDeSeccion", () => {
  it("saca tildes, espacios y signos", () => {
    expect(anclaDeSeccion("Café y té")).toBe("seccion-cafe-y-te");
    expect(anclaDeSeccion("Métodos")).toBe("seccion-metodos");
  });

  it("nunca queda vacío", () => {
    expect(anclaDeSeccion("☕")).toBe("seccion-menu");
  });

  it("dos secciones distintas no comparten ancla", () => {
    expect(anclaDeSeccion("El grano")).not.toBe(anclaDeSeccion("Los granos"));
  });
});
