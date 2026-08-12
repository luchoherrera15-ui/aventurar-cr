import { describe, expect, it } from "vitest";
import { agruparPorSeccion } from "./catalogo";
import type { RanchoItem } from "@/app/mi-negocio/types";

/**
 * El armado de secciones del catálogo. Lo que se prueba acá es la
 * convención de la 0119: el orden guardado en `categorias_negocio` es
 * OPCIONAL y PARCIAL, así que tiene que convivir con secciones que no
 * están en la lista sin romperles nada.
 */

let contador = 0;
function item(nombre: string, grupo: string | null): RanchoItem {
  contador += 1;
  return {
    id: `i${contador}`,
    rancho_id: "r1",
    nombre,
    descripcion: null,
    precio: 1000,
    unidad: null,
    activo: true,
    orden: contador,
    foto_url: null,
    duracion_horas: null,
    duracion_minutos: 30,
    grupo,
    tipo: "producto",
    min_por_reserva: 1,
    max_por_reserva: null,
    capacidad_dia: null,
    created_at: "2026-08-11T00:00:00Z",
  };
}

/** Los nombres de las secciones, en el orden en que quedaron. */
function secciones(items: RanchoItem[], orden: string[] = []) {
  return agruparPorSeccion(items, orden).map((g) => g.grupo);
}

describe("agruparPorSeccion", () => {
  it("sin orden guardado, la sección aparece donde su primer ítem", () => {
    const items = [
      item("Corte", "Cortes"),
      item("Barba", "Barba"),
      item("Corte niño", "Cortes"),
    ];
    expect(secciones(items)).toEqual(["Cortes", "Barba"]);
  });

  it("los ítems sin sección van juntos al final, sin título", () => {
    const items = [item("Suelto", null), item("Corte", "Cortes")];
    const grupos = agruparPorSeccion(items);
    expect(grupos.map((g) => g.grupo)).toEqual(["Cortes", null]);
    expect(grupos[1].items.map((i) => i.nombre)).toEqual(["Suelto"]);
  });

  it("el orden guardado manda sobre el orden de los ítems", () => {
    const items = [
      item("Corte", "Cortes"),
      item("Barba", "Barba"),
      item("Tinte", "Color"),
    ];
    expect(secciones(items, ["Color", "Barba", "Cortes"])).toEqual([
      "Color",
      "Barba",
      "Cortes",
    ]);
  });

  it("una sección sin fila guardada queda detrás, en su orden viejo", () => {
    const items = [
      item("Corte", "Cortes"),
      item("Barba", "Barba"),
      item("Tinte", "Color"),
    ];
    // Solo "Color" está ordenada: las otras dos conservan su orden
    // relativo original (Cortes antes que Barba) detrás de ella.
    expect(secciones(items, ["Color"])).toEqual(["Color", "Cortes", "Barba"]);
  });

  it("una sección guardada que ya no tiene ítems no deja un hueco", () => {
    const items = [item("Corte", "Cortes")];
    expect(secciones(items, ["Barba", "Cortes", "Color"])).toEqual(["Cortes"]);
  });

  it("ignora mayúsculas y espacios, igual que el índice único de la base", () => {
    const items = [item("Corte", "Cortes"), item("Barba", "Barba")];
    expect(secciones(items, ["  barba ", "CORTES"])).toEqual(["Barba", "Cortes"]);
  });

  it("los sin sección siguen al final aunque haya orden guardado", () => {
    const items = [item("Suelto", null), item("Corte", "Cortes")];
    expect(secciones(items, ["Cortes"])).toEqual(["Cortes", null]);
  });

  it("sin lista se comporta igual que antes de la 0119", () => {
    const items = [item("Corte", "Cortes"), item("Barba", "Barba")];
    expect(agruparPorSeccion(items)).toEqual(agruparPorSeccion(items, []));
  });
});
