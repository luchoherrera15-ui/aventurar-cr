import { describe, expect, it } from "vitest";
import { coincide, normalizarTexto, primeraCoincidencia, sanearPalabras } from "./coincidencia";

describe("normalizarTexto", () => {
  it("minúsculas, sin acentos, espacios colapsados", () => {
    expect(normalizarTexto("  ¿Cuál   es el  MENÚ? ")).toBe("¿cual es el menu?");
    expect(normalizarTexto("Ñandú")).toBe("nandu");
  });
});

describe("coincide — modo palabra (el default)", () => {
  it("el caso del pedido: PRECIO atrapa todas sus formas", () => {
    for (const c of ["precio", "PRECIO", "Precio", "¿Cuál es el precio?", "precio!!", "el precio?", "PRECIO 👀"]) {
      expect(coincide(c, "PRECIO")).toBe(true);
    }
  });
  it("…pero NO dispara por una palabra que la contiene", () => {
    expect(coincide("precioso", "precio")).toBe(false);
    expect(coincide("qué precioso lugar", "precio")).toBe(false);
    expect(coincide("sobreprecio", "precio")).toBe(false);
  });
  it("los acentos no importan en ninguna de las dos puntas", () => {
    expect(coincide("quiero el menu", "MENÚ")).toBe(true);
    expect(coincide("quiero el menú", "menu")).toBe(true);
  });
  it("una frase también es una palabra clave", () => {
    expect(coincide("me pasás la lista de precios?", "lista de precios")).toBe(true);
    expect(coincide("me pasás la   lista   de precios", "lista de precios")).toBe(true);
    expect(coincide("lista de precios", "lista de precio")).toBe(false);
  });
  it("caracteres de regex en la palabra no rompen nada", () => {
    expect(coincide("cuesta $10?", "$10")).toBe(true);
    expect(coincide("info (hoy)", "(hoy)")).toBe(true);
  });
  it("vacíos: nunca coincide", () => {
    expect(coincide("", "precio")).toBe(false);
    expect(coincide("precio", "")).toBe(false);
    expect(coincide("precio", "   ")).toBe(false);
  });
});

describe("coincide — modo exacta y contiene", () => {
  it("exacta: el comentario ES la palabra", () => {
    expect(coincide("PRECIO", "precio", "exacta")).toBe(true);
    expect(coincide("  precio ", "precio", "exacta")).toBe(true);
    expect(coincide("¿precio?", "precio", "exacta")).toBe(false);
  });
  it("contiene: en cualquier parte, aunque sea dentro de otra", () => {
    expect(coincide("precioso", "precio", "contiene")).toBe(true);
    expect(coincide("nada que ver", "precio", "contiene")).toBe(false);
  });
});

describe("primeraCoincidencia y sanearPalabras", () => {
  it("devuelve la palabra tal como la escribió la persona", () => {
    expect(primeraCoincidencia("cuánto es el costo?", ["Precio", "COSTO"])).toBe("COSTO");
    expect(primeraCoincidencia("hola", ["precio", "costo"])).toBeNull();
  });
  it("sanear: recorta, quita vacíos y duplicados por forma normalizada, respeta el tope", () => {
    expect(sanearPalabras([" precio ", "PRECIO", "Précio", "", "costo", "costo"], 20, 40)).toEqual(["precio", "costo"]);
    expect(sanearPalabras(["a", "b", "c"], 2, 40)).toEqual(["a", "b"]);
    expect(sanearPalabras(["x".repeat(100)], 20, 40)[0]).toHaveLength(40);
  });
});
