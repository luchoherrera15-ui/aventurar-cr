import { describe, expect, it } from "vitest";
import {
  buscarPorLlave,
  llaveApuntaA,
  llaveDeTarjeta,
  slugDeNombreDeTarjeta,
  tarjetaConLlaveDeFila,
} from "./llave-tarjeta";

/**
 * LA LLAVE QUE VA IMPRESA EN UN PÓSTER.
 *
 * Lo que hay que congelar acá no es «que devuelva un slug»: es que el
 * texto sea EL MISMO antes y después de aplicar la 0199. Entre el
 * deploy y la migración pasan días, y en el medio hay negocios
 * imprimiendo carteles.
 */

describe("slugDeNombreDeTarjeta", () => {
  it("baja a minúsculas y une con guiones", () => {
    expect(slugDeNombreDeTarjeta("Paint and Matcha")).toBe("paint-and-matcha");
  });

  it("saca los acentos y la eñe: un %C3%A9 en un póster no se teclea", () => {
    expect(slugDeNombreDeTarjeta("Café de la Mañana")).toBe("cafe-de-la-manana");
  });

  it("tira todo lo que no sea letra o número", () => {
    expect(slugDeNombreDeTarjeta("¡Sellos 2x1! ☕")).toBe("sellos-2x1");
  });

  it("no deja guiones sueltos en las puntas", () => {
    expect(slugDeNombreDeTarjeta("  --Sellos--  ")).toBe("sellos");
  });

  it("no corta dejando un guion colgando al recortar el largo", () => {
    const largo = `${"a".repeat(47)} bcd`;
    const slug = slugDeNombreDeTarjeta(largo);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("de un nombre sin nada utilizable devuelve vacío, no un invento", () => {
    // Un texto inventado acá («tarjeta», por ejemplo) sería un slug que
    // nadie podría reproducir desde el nombre, y colisionaría con el de
    // cualquier otra tarjeta igual de rara del mismo negocio.
    expect(slugDeNombreDeTarjeta("☕☕☕")).toBe("");
    expect(slugDeNombreDeTarjeta("")).toBe("");
    expect(slugDeNombreDeTarjeta(null)).toBe("");
  });
});

describe("llaveDeTarjeta: qué se publica", () => {
  const id = "3f1c0b6e-0000-4000-8000-000000000001";

  it("manda la columna `slug` cuando existe", () => {
    expect(llaveDeTarjeta({ id, nombre: "Paint and Matcha", slug: "paint-2" })).toBe("paint-2");
  });

  it("sin columna, el slug DERIVADO — el mismo texto que va a guardar la 0199", () => {
    expect(llaveDeTarjeta({ id, nombre: "Paint and Matcha" })).toBe("paint-and-matcha");
  });

  it("sin nombre utilizable, el id: siempre hay link", () => {
    expect(llaveDeTarjeta({ id, nombre: "☕" })).toBe(id);
    expect(llaveDeTarjeta({ id })).toBe(id);
  });

  it("un slug guardado en blanco no gana: es como no tenerlo", () => {
    expect(llaveDeTarjeta({ id, nombre: "Sellos", slug: "   " })).toBe("sellos");
  });
});

describe("llaveApuntaA: qué se acepta al resolver", () => {
  const tarjeta = {
    id: "3f1c0b6e-0000-4000-8000-000000000001",
    nombre: "Paint and Matcha",
    slug: "paint-and-matcha-2",
  };

  it("acepta el slug guardado", () => {
    expect(llaveApuntaA(tarjeta, "paint-and-matcha-2")).toBe(true);
  });

  it("acepta el derivado del nombre — el póster impreso ANTES de la 0199", () => {
    expect(llaveApuntaA(tarjeta, "paint-and-matcha")).toBe(true);
  });

  it("acepta el id: la salida de emergencia", () => {
    expect(llaveApuntaA(tarjeta, tarjeta.id)).toBe(true);
  });

  it("no le importa la mayúscula ni el espacio de quien teclea del papel", () => {
    expect(llaveApuntaA(tarjeta, "  Paint-And-Matcha-2 ")).toBe(true);
  });

  it("no acepta cualquier cosa", () => {
    expect(llaveApuntaA(tarjeta, "otra")).toBe(false);
    expect(llaveApuntaA(tarjeta, "")).toBe(false);
    expect(llaveApuntaA(tarjeta, "   ")).toBe(false);
  });

  it("una tarjeta sin nombre utilizable no matchea con el vacío", () => {
    // Si el derivado es "" y no se comprobara, CUALQUIER llave vacía
    // apuntaría a esta tarjeta.
    expect(llaveApuntaA({ id: "x", nombre: "☕" }, "")).toBe(false);
  });
});

describe("buscarPorLlave sobre filas crudas", () => {
  const sellos = { id: "zzz", nombre: "Programa de lealtad", created_at: "2026-05-01" };
  const evento = { id: "aaa", nombre: "Paint and Matcha", created_at: "2026-08-19" };

  it("encuentra la que corresponde", () => {
    expect(buscarPorLlave([sellos, evento], "paint-and-matcha")).toBe(evento);
    expect(buscarPorLlave([sellos, evento], "programa-de-lealtad")).toBe(sellos);
  });

  it("null cuando la llave no es de ninguna", () => {
    expect(buscarPorLlave([sellos, evento], "otra-cosa")).toBeNull();
  });

  it("ante dos que derivan lo mismo, gana la PRIMERA de la lista (la más vieja)", () => {
    // Solo puede pasar mientras la 0199 no esté pegada; su índice único
    // lo impide después. Que gane la vieja es el mismo criterio que
    // protege al QR impreso: ante un empate, nunca la recién creada.
    const vieja = { id: "zzz", nombre: "Sellos", created_at: "2026-05-01" };
    const nueva = { id: "aaa", nombre: "Sellos", created_at: "2026-08-19" };
    expect(buscarPorLlave([vieja, nueva], "sellos")).toBe(vieja);
  });
});

describe("tarjetaConLlaveDeFila", () => {
  it("lee lo que hay y no explota con lo que no es texto", () => {
    expect(tarjetaConLlaveDeFila({ id: "a", nombre: 7, slug: {} })).toEqual({
      id: "a",
      nombre: null,
      slug: null,
    });
  });

  it("una fila SIN la columna `slug` (base sin la 0199) no rompe nada", () => {
    expect(tarjetaConLlaveDeFila({ id: "a", nombre: "Sellos" })).toEqual({
      id: "a",
      nombre: "Sellos",
      slug: null,
    });
  });
});
