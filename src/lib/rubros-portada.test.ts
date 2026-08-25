import { describe, expect, it } from "vitest";
import {
  RUBROS_PORTADA,
  rubroDeParametro,
  urlDeRubro,
} from "./rubros-portada";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA RED QUE SOSTIENE EL FILTRO DE LA PORTADA
 * ════════════════════════════════════════════════════════════════════
 *
 * El filtro `?rubro=` usa la CATEGORÍA como clave, sin la vertical. Eso
 * funciona hoy porque las nueve categorías son distintas entre sí, pero
 * es una propiedad de los datos, no del código: nada impide que mañana
 * entre una categoría que ya exista en la otra vertical.
 *
 * El día que pase, `rubroDeParametro` devolvería el PRIMER rubro que
 * coincida y el catálogo mostraría negocios de la vertical equivocada —
 * en silencio, sin error, sin nada que avise. Este test es lo único que
 * lo agarra antes de que llegue a producción.
 */

describe("las claves del filtro de la portada", () => {
  it("no hay dos rubros con la misma categoría", () => {
    const categorias = RUBROS_PORTADA.map((r) => r.categoria);
    const repetidas = categorias.filter(
      (c, i) => categorias.indexOf(c) !== i,
    );

    expect(
      repetidas,
      `Estas categorías están repetidas: ${repetidas.join(", ")}. ` +
        `El filtro ?rubro= usa la categoría como clave única, así que con una ` +
        `repetida el catálogo mostraría negocios de la vertical equivocada sin ` +
        `avisar. Hay que pasar la clave a "vertical-categoria" en rubros-portada.ts.`,
    ).toEqual([]);
  });

  it("toda categoría es un texto usable en una URL", () => {
    for (const r of RUBROS_PORTADA) {
      expect(r.categoria, `"${r.categoria}" tiene mayúsculas o espacios`).toBe(
        r.categoria.trim().toLowerCase(),
      );
      expect(encodeURIComponent(r.categoria)).toBe(r.categoria);
    }
  });

  it("todo rubro tiene vertical y etiqueta", () => {
    for (const r of RUBROS_PORTADA) {
      expect(["citas", "eventos"]).toContain(r.vertical);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

describe("rubroDeParametro", () => {
  it("encuentra el rubro por su categoría", () => {
    expect(rubroDeParametro("unas")).toEqual({
      vertical: "citas",
      categoria: "unas",
      label: "Uñas",
    });
    expect(rubroDeParametro("lugares")?.vertical).toBe("eventos");
  });

  it("tolera mayúsculas y espacios de más", () => {
    expect(rubroDeParametro("  BARBERIA ")?.categoria).toBe("barberia");
  });

  it("devuelve null para lo que no existe", () => {
    expect(rubroDeParametro("tatuajes")).toBeNull();
    expect(rubroDeParametro("")).toBeNull();
    expect(rubroDeParametro(undefined)).toBeNull();
  });

  it("rechaza el parámetro repetido en vez de adivinar cuál vale", () => {
    // `?rubro=unas&rubro=spa` llega como array. Elegir el primero sería
    // cumplir a medias una intención que no existe.
    expect(rubroDeParametro(["unas", "spa"])).toBeNull();
  });
});

describe("urlDeRubro", () => {
  it("se queda en la portada y baja al catálogo", () => {
    expect(urlDeRubro("unas")).toBe("/?rubro=unas#catalogo");
  });

  it("nunca manda a /citas ni a /eventos", () => {
    // El sentido entero del cambio: los íconos del héroe dejaron de
    // sacar al visitante de la portada.
    for (const r of RUBROS_PORTADA) {
      const url = urlDeRubro(r.categoria);
      expect(url.startsWith("/?rubro=")).toBe(true);
      expect(url).not.toContain("/citas");
      expect(url).not.toContain("/eventos");
    }
  });
});
