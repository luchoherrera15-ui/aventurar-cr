import { describe, expect, it } from "vitest";
import { asignarRuta, leerRuta } from "./ruta-datos";

describe("asignarRuta", () => {
  it("escribe una llave de primer nivel sin mutar el original", () => {
    const antes = { titulo: "Hola", texto: "x" };
    const despues = asignarRuta(antes, "titulo", "Chau");
    expect(despues).toEqual({ titulo: "Chau", texto: "x" });
    expect(antes.titulo).toBe("Hola");
  });

  it("entra a un arreglo por índice y copia solo el camino tocado", () => {
    const antes = { items: [{ titulo: "a" }, { titulo: "b" }], otro: { x: 1 } };
    const despues = asignarRuta(antes, "items.1.titulo", "B");
    expect(despues.items[1].titulo).toBe("B");
    expect(despues.items[0]).toBe(antes.items[0]);
    expect(despues.otro).toBe(antes.otro);
    expect(antes.items[1].titulo).toBe("b");
  });

  it("ignora un índice fuera del arreglo en vez de romper", () => {
    const antes = { items: [{ titulo: "a" }] };
    expect(asignarRuta(antes, "items.5.titulo", "z")).toEqual(antes);
  });

  it("crea el camino cuando no existe", () => {
    expect(asignarRuta({} as { a?: { b?: string } }, "a.b", "v")).toEqual({ a: { b: "v" } });
  });

  it("leerRuta devuelve el valor o undefined", () => {
    const o = { items: [{ titulo: "a" }] };
    expect(leerRuta(o, "items.0.titulo")).toBe("a");
    expect(leerRuta(o, "items.3.titulo")).toBeUndefined();
    expect(leerRuta(o, "nada.x")).toBeUndefined();
  });
});
