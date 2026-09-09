import { describe, expect, it } from "vitest";
import {
  detalleDeLinea,
  eleccionDe,
  firmaDeLinea,
  personalizacionDe,
  precioDeLinea,
  seArma,
  TOPES_PERSONALIZACION,
  type Personalizacion,
} from "./personalizacion";

const HAMBURGUESA: Personalizacion = personalizacionDe({
  ingredientes: [{ nombre: "Cebolla" }, { nombre: "Tomate" }, { nombre: "Salsa rosada" }],
  extras: [
    { nombre: "Queso", precio: 800 },
    { nombre: "Tocineta", precio: 1200 },
  ],
});

describe("personalizacionDe", () => {
  it("arma ids a partir del nombre, sin tildes ni espacios", () => {
    expect(HAMBURGUESA.ingredientes.map((i) => i.id)).toEqual(["cebolla", "tomate", "salsa-rosada"]);
    expect(HAMBURGUESA.extras.map((e) => e.id)).toEqual(["queso", "tocineta"]);
  });

  it("no repite un id cuando dos opciones se llaman igual", () => {
    const p = personalizacionDe({ ingredientes: [{ nombre: "Queso" }], extras: [{ nombre: "Queso", precio: 500 }] });
    expect(p.extras[0].id).not.toBe(p.ingredientes[0].id);
  });

  it("respeta el id guardado: renombrar no rompe los pedidos viejos", () => {
    const p = personalizacionDe({ ingredientes: [{ id: "i1", nombre: "Cebolla morada" }] });
    expect(p.ingredientes[0]).toEqual({ id: "i1", nombre: "Cebolla morada" });
  });

  it("tolera lo vacío, lo viejo y la basura", () => {
    for (const v of [undefined, null, {}, [], "sin cebolla", { ingredientes: "x" }]) {
      expect(personalizacionDe(v)).toEqual({ ingredientes: [], extras: [] });
    }
  });

  it("descarta opciones sin nombre y recorta a los topes", () => {
    const p = personalizacionDe({
      ingredientes: [{ nombre: "   " }, ...Array.from({ length: 30 }, (_, i) => ({ nombre: `Ing ${i}` }))],
    });
    expect(p.ingredientes).toHaveLength(TOPES_PERSONALIZACION.ingredientes);
    expect(p.ingredientes.every((i) => i.nombre.trim() !== "")).toBe(true);
  });

  it("un precio negativo o roto queda en cero, nunca en negativo", () => {
    const p = personalizacionDe({ extras: [{ nombre: "Queso", precio: -900 }, { nombre: "Papas", precio: "mucho" }] });
    expect(p.extras.map((e) => e.precio)).toEqual([0, 0]);
  });

  it("seArma distingue el plato que se toca del que se agrega de un toque", () => {
    expect(seArma(HAMBURGUESA)).toBe(true);
    expect(seArma(personalizacionDe(null))).toBe(false);
  });
});

describe("eleccionDe — la puerta del servidor", () => {
  it("acepta lo que existe", () => {
    const e = eleccionDe({ sin: ["cebolla"], extras: ["queso"], nota: "Bien cocida" }, HAMBURGUESA);
    expect(e).toEqual({ sin: ["cebolla"], extras: ["queso"], nota: "Bien cocida" });
  });

  it("tira los ids inventados desde el teléfono", () => {
    const e = eleccionDe({ sin: ["oro"], extras: ["ferrari"] }, HAMBURGUESA);
    expect(e.sin).toEqual([]);
    expect(e.extras).toEqual([]);
  });

  it("no repite el mismo id dos veces", () => {
    expect(eleccionDe({ extras: ["queso", "queso"] }, HAMBURGUESA).extras).toEqual(["queso"]);
  });

  it("recorta la nota del cliente", () => {
    const larga = "a".repeat(400);
    expect(eleccionDe({ nota: larga }, HAMBURGUESA).nota).toHaveLength(TOPES_PERSONALIZACION.nota);
  });
});

describe("precioDeLinea", () => {
  it("suma los extras elegidos", () => {
    expect(precioDeLinea(4500, HAMBURGUESA, { sin: [], extras: ["queso", "tocineta"], nota: "" })).toBe(6500);
  });

  it("quitar un ingrediente NO abarata el plato", () => {
    expect(precioDeLinea(4500, HAMBURGUESA, { sin: ["cebolla", "tomate"], extras: [], nota: "" })).toBe(4500);
  });
});

describe("detalleDeLinea", () => {
  it("junta los quitados en un solo renglón y cada extra en el suyo", () => {
    const d = detalleDeLinea(HAMBURGUESA, { sin: ["cebolla", "tomate"], extras: ["queso"], nota: "Bien cocida" });
    expect(d).toEqual(["Sin cebolla, tomate", "+ Queso", "Nota: Bien cocida"]);
  });

  it("sin nada elegido no dice nada", () => {
    expect(detalleDeLinea(HAMBURGUESA, { sin: [], extras: [], nota: "" })).toEqual([]);
  });
});

describe("firmaDeLinea", () => {
  it("dos platos idénticos comparten renglón", () => {
    const a = firmaDeLinea("p1", { sin: ["cebolla"], extras: ["queso"], nota: "" });
    const b = firmaDeLinea("p1", { sin: ["cebolla"], extras: ["queso"], nota: "" });
    expect(a).toBe(b);
  });

  it("el orden en que se tocaron las casillas no inventa un renglón nuevo", () => {
    const a = firmaDeLinea("p1", { sin: ["cebolla", "tomate"], extras: [], nota: "" });
    const b = firmaDeLinea("p1", { sin: ["tomate", "cebolla"], extras: [], nota: "" });
    expect(a).toBe(b);
  });

  it("una nota distinta es otro renglón: no se pueden mezclar", () => {
    const a = firmaDeLinea("p1", { sin: [], extras: [], nota: "sin sal" });
    const b = firmaDeLinea("p1", { sin: [], extras: [], nota: "" });
    expect(a).not.toBe(b);
  });
});
