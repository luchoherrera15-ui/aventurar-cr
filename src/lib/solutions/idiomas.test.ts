import { describe, expect, it } from "vitest";
import { idiomaDeBusqueda, idiomasMenuDe, nutricionDe, textoEn, traduccionesDe } from "./idiomas";

describe("idiomasMenuDe", () => {
  it("filtra lo desconocido, quita repetidos y respeta el orden fijo", () => {
    expect(idiomasMenuDe(["it", "en", "xx", "en", "es"])).toEqual(["en", "it"]);
    expect(idiomasMenuDe(null)).toEqual([]);
  });
});

describe("traduccionesDe", () => {
  it("se queda solo con idiomas válidos y recorta a los topes", () => {
    const t = traduccionesDe({ en: { nombre: "  Ragu pasta ", descripcion: "Slow cooked" }, xx: { nombre: "no" }, fr: "mal", it: {} });
    expect(t).toEqual({ en: { nombre: "Ragu pasta", descripcion: "Slow cooked" } });
  });
  it("una traducción con solo descripción se conserva", () => {
    expect(traduccionesDe({ fr: { descripcion: "Cuisson lente" } })).toEqual({ fr: { descripcion: "Cuisson lente" } });
  });
  it("cualquier cosa que no sea un objeto da vacío", () => {
    expect(traduccionesDe(null)).toEqual({});
    expect(traduccionesDe([1])).toEqual({});
  });
});

describe("textoEn", () => {
  const plato = { nombre: "Tagliatelle al ragú", descripcion: "Ocho horas", traducciones: { en: { nombre: "Ragu tagliatelle" } } };
  it("en español devuelve la base", () => {
    expect(textoEn(plato, "es")).toEqual({ nombre: "Tagliatelle al ragú", descripcion: "Ocho horas" });
  });
  it("usa la traducción y cae al español en lo que falte", () => {
    expect(textoEn(plato, "en")).toEqual({ nombre: "Ragu tagliatelle", descripcion: "Ocho horas" });
    expect(textoEn(plato, "fr")).toEqual({ nombre: "Tagliatelle al ragú", descripcion: "Ocho horas" });
  });
});

describe("idiomaDeBusqueda", () => {
  it("solo acepta un idioma que el negocio ofrezca", () => {
    expect(idiomaDeBusqueda("en", ["en", "fr"])).toBe("en");
    expect(idiomaDeBusqueda("de", ["en", "fr"])).toBe("es");
    expect(idiomaDeBusqueda(undefined, ["en"])).toBe("es");
    expect(idiomaDeBusqueda(["fr"], ["fr"])).toBe("fr");
  });
});

describe("nutricionDe", () => {
  it("lee números, redondea a un decimal y descarta negativos", () => {
    expect(nutricionDe({ calorias: "520", proteina: 24.26, grasa: -3, alergenos: ["gluten", "nada"] })).toEqual({
      calorias: 520,
      proteina: 24.3,
      alergenos: ["gluten"],
    });
  });
  it("una ficha vacía es null, igual que no cargarla", () => {
    expect(nutricionDe({})).toBeNull();
    expect(nutricionDe({ porcion: "   ", alergenos: [] })).toBeNull();
    expect(nutricionDe(null)).toBeNull();
  });
  it("la porción se recorta y las calorías van enteras", () => {
    expect(nutricionDe({ porcion: "300 g", calorias: 519.6 })).toEqual({ porcion: "300 g", calorias: 520 });
  });
});
