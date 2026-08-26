import { describe, expect, it } from "vitest";
import { serviciosPorMiembro } from "./servicios-por-miembro";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA REGLA QUE YA SE LEYÓ AL REVÉS UNA VEZ
 * ════════════════════════════════════════════════════════════════════
 *
 * `servicios_recurso` es una lista de RESTRICCIONES, no de capacidades:
 * sin filas, todo el equipo hace todo. La ficha pública la leía al
 * revés y mostraba equipos enteros sin un solo servicio.
 *
 * ⚠️ SI UNA DE ESTAS FALLA, LA FICHA ESTÁ MINTIENDO SOBRE QUÉ HACE LA
 * GENTE DE UN NEGOCIO REAL. Se averigua por qué; no se ajusta la
 * prueba.
 */

const CATALOGO = [
  { id: "s1", nombre: "Manicura" },
  { id: "s2", nombre: "Pedicura" },
  { id: "s3", nombre: "Gel X" },
];

describe("sin ninguna restricción, todos hacen todo", () => {
  it("el caso normal: el negocio nunca abrió esa pantalla", () => {
    // Es el estado de CUALQUIER negocio recién dado de alta, y el que
    // rompía la ficha: devolvía listas vacías.
    const r = serviciosPorMiembro(CATALOGO, ["m1", "m2"], []);
    expect(r.get("m1")).toEqual(["Manicura", "Pedicura", "Gel X"]);
    expect(r.get("m2")).toEqual(["Manicura", "Pedicura", "Gel X"]);
  });

  it("con una sola persona en el equipo — el caso de Glow Nails", () => {
    const r = serviciosPorMiembro(CATALOGO, ["mariana"], []);
    expect(r.get("mariana")).toHaveLength(3);
  });
});

describe("una restricción apaga el «todos» de ESE servicio", () => {
  it("solo la persona asignada lo hace; el resto sigue con los demás", () => {
    // Gel X queda restringido a m1. Pero Manicura y Pedicura no tienen
    // filas, así que siguen siendo de los dos.
    const r = serviciosPorMiembro(CATALOGO, ["m1", "m2"], [
      { item_id: "s3", miembro_id: "m1" },
    ]);
    expect(r.get("m1")).toEqual(["Manicura", "Pedicura", "Gel X"]);
    expect(r.get("m2"), "m2 pierde Gel X, no lo demás").toEqual(["Manicura", "Pedicura"]);
  });

  it("restringir a varias personas las incluye a todas", () => {
    const r = serviciosPorMiembro(CATALOGO, ["m1", "m2", "m3"], [
      { item_id: "s3", miembro_id: "m1" },
      { item_id: "s3", miembro_id: "m2" },
    ]);
    expect(r.get("m1")).toContain("Gel X");
    expect(r.get("m2")).toContain("Gel X");
    expect(r.get("m3")).not.toContain("Gel X");
  });

  it("con TODOS los servicios restringidos, nadie hereda nada", () => {
    const r = serviciosPorMiembro(CATALOGO, ["m1", "m2"], [
      { item_id: "s1", miembro_id: "m1" },
      { item_id: "s2", miembro_id: "m1" },
      { item_id: "s3", miembro_id: "m2" },
    ]);
    expect(r.get("m1")).toEqual(["Manicura", "Pedicura"]);
    expect(r.get("m2")).toEqual(["Gel X"]);
  });
});

describe("el orden es estable", () => {
  it("sigue el del catálogo, y lo restringido va después", () => {
    // Quien llama recorta a los primeros cuatro. Sin un orden fijo, la
    // misma persona mostraría servicios distintos entre recargas.
    const r = serviciosPorMiembro(CATALOGO, ["m1"], [
      { item_id: "s1", miembro_id: "m1" },
    ]);
    expect(r.get("m1")).toEqual(["Pedicura", "Gel X", "Manicura"]);
  });

  it("dos llamadas iguales dan exactamente lo mismo", () => {
    const miembros = ["m1", "m2"];
    const restricciones = [{ item_id: "s2", miembro_id: "m2" }];
    const a = serviciosPorMiembro(CATALOGO, miembros, restricciones);
    const b = serviciosPorMiembro(CATALOGO, miembros, restricciones);
    expect(a.get("m1")).toEqual(b.get("m1"));
    expect(a.get("m2")).toEqual(b.get("m2"));
  });
});

describe("datos sucios no ensucian la lista", () => {
  it("una restricción a un servicio que ya no existe se ignora", () => {
    // Pasa de verdad: el servicio se borró o se pausó y no vino en la
    // consulta, pero su fila de restricción sigue ahí. Sin el filtro,
    // la tarjeta mostraría un chip vacío.
    const r = serviciosPorMiembro(CATALOGO, ["m1"], [
      { item_id: "borrado", miembro_id: "m1" },
    ]);
    expect(r.get("m1")).toEqual(["Manicura", "Pedicura", "Gel X"]);
  });

  it("una restricción a alguien que ya no está en el equipo no crea una entrada", () => {
    const r = serviciosPorMiembro(CATALOGO, ["m1"], [
      { item_id: "s1", miembro_id: "se-fue" },
    ]);
    expect(r.has("se-fue"), "no se inventa un miembro").toBe(false);
    // Pero s1 SÍ quedó restringido: m1 lo pierde aunque el asignado ya
    // no trabaje ahí. Es lo mismo que hace el motor de reservas, y
    // cambiarlo acá haría que la ficha prometa algo que la reserva
    // después no ofrece.
    expect(r.get("m1")).toEqual(["Pedicura", "Gel X"]);
  });

  it("la misma fila repetida no duplica el servicio", () => {
    const r = serviciosPorMiembro(CATALOGO, ["m1"], [
      { item_id: "s1", miembro_id: "m1" },
      { item_id: "s1", miembro_id: "m1" },
    ]);
    expect(r.get("m1")).toEqual(["Pedicura", "Gel X", "Manicura"]);
  });

  it("un equipo vacío devuelve un mapa vacío, no explota", () => {
    expect(serviciosPorMiembro(CATALOGO, [], []).size).toBe(0);
  });

  it("un catálogo vacío deja a cada quien con lista vacía", () => {
    const r = serviciosPorMiembro([], ["m1"], []);
    expect(r.get("m1")).toEqual([]);
  });
});

describe("las listas no se comparten entre personas", () => {
  it("tocar la de una no cambia la de la otra", () => {
    // Si se repartiera la MISMA referencia de array a todos, agregarle
    // un servicio restringido a uno se lo agregaría a todo el equipo.
    const r = serviciosPorMiembro(CATALOGO, ["m1", "m2"], [
      { item_id: "s1", miembro_id: "m1" },
    ]);
    expect(r.get("m1")).not.toEqual(r.get("m2"));
    r.get("m1")!.push("INVENTADO");
    expect(r.get("m2")).not.toContain("INVENTADO");
  });
});
