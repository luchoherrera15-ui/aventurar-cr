import { describe, expect, it } from "vitest";
import { RUBROS_PORTADA, rubroDeParametro, urlDeRubro } from "./rubros-portada";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA RED QUE SOSTIENE EL FILTRO DE LA PORTADA
 * ════════════════════════════════════════════════════════════════════
 *
 * Desde ago 2026 la portada es el único lugar donde se ven los
 * negocios: `/citas` y `/eventos` se borraron. Todo lo que antes
 * mandaba a un directorio —los nueve íconos del héroe, el mega menú, el
 * cajón del teléfono— ahora escribe `?rubro=` acá.
 *
 * Si este parseo se equivoca, el visitante no ve un error: ve el
 * catálogo de otra vertical, o el catálogo entero, como si nada hubiera
 * pasado. Por eso está probado renglón por renglón.
 */

describe("la clave lleva la vertical, y hace falta", () => {
  it("«otros» existe en las dos verticales y no se confunden", () => {
    // Este es EL motivo por el que la clave no puede ser la categoría
    // sola. Si algún día alguien la simplifica, esto se pone rojo.
    const citas = rubroDeParametro("citas-otros");
    const eventos = rubroDeParametro("eventos-otros");

    expect(citas?.vertical).toBe("citas");
    expect(eventos?.vertical).toBe("eventos");
    expect(citas?.categoria).toBe("otros");
    expect(eventos?.categoria).toBe("otros");
  });

  it("resuelve cualquier categoría, no solo las nueve del héroe", () => {
    // A propósito no hay lista blanca: enumerar categorías acá sería una
    // tercera taxonomía que se despega de la base. Ver la cabecera del
    // módulo.
    expect(rubroDeParametro("eventos-organizacion")).toMatchObject({
      vertical: "eventos",
      categoria: "organizacion",
    });
  });

  it("lleva la subcategoría cuando el destino la trae", () => {
    expect(rubroDeParametro("eventos-lugares", "ranchos")).toMatchObject({
      vertical: "eventos",
      categoria: "lugares",
      subcategoria: "ranchos",
    });
  });

  it("sin subcategoría, el campo queda sin definir (no vacío)", () => {
    expect(rubroDeParametro("eventos-lugares")?.subcategoria).toBeUndefined();
  });
});

describe("las nueve claves viejas se siguen entendiendo", () => {
  it("la categoría sola resuelve a su rubro del héroe", () => {
    // `?rubro=unas` estuvo en producción antes de que la clave llevara
    // la vertical. Un link compartido en esa ventana no puede quedar
    // roto.
    for (const r of RUBROS_PORTADA) {
      const resuelto = rubroDeParametro(r.categoria);
      expect(resuelto?.vertical, `«${r.categoria}» dejó de resolver`).toBe(
        r.vertical,
      );
      expect(resuelto?.categoria).toBe(r.categoria);
    }
  });

  it("no hay dos rubros del héroe con la misma categoría", () => {
    // Lo anterior solo es correcto mientras las nueve sean únicas entre
    // sí: si se repitiera una, la forma vieja elegiría siempre la misma
    // y mostraría la vertical equivocada.
    const cats = RUBROS_PORTADA.map((r) => r.categoria);
    expect(new Set(cats).size).toBe(cats.length);
  });
});

describe("lo que NO se acepta", () => {
  it("una categoría suelta que no es de las nueve", () => {
    // Sin vertical no hay forma de saber de cuál es, así que no se
    // adivina.
    expect(rubroDeParametro("organizacion")).toBeNull();
  });

  it("una vertical que no vive en la portada", () => {
    expect(rubroDeParametro("hospedajes-cabanas")).toBeNull();
  });

  it("vacíos y ausencias", () => {
    expect(rubroDeParametro("")).toBeNull();
    expect(rubroDeParametro("   ")).toBeNull();
    expect(rubroDeParametro(undefined)).toBeNull();
    expect(rubroDeParametro("citas-")).toBeNull();
  });

  it("el parámetro repetido, en vez de adivinar cuál vale", () => {
    // `?rubro=a&rubro=b` llega como array. Cumplir a medias una
    // intención que no existe es peor que no filtrar.
    expect(rubroDeParametro(["citas-unas", "citas-spa"])).toBeNull();
  });

  it("tolera mayúsculas y espacios de más", () => {
    expect(rubroDeParametro("  CITAS-BARBERIA ")?.categoria).toBe("barberia");
  });
});

describe("urlDeRubro", () => {
  it("se queda en la portada y baja al catálogo", () => {
    expect(urlDeRubro("citas", "unas")).toBe("/?rubro=citas-unas#catalogo");
  });

  it("agrega la subcategoría aparte, no dentro de la clave", () => {
    expect(urlDeRubro("eventos", "lugares", "ranchos")).toBe(
      "/?rubro=eventos-lugares&sub=ranchos#catalogo",
    );
  });

  it("nunca manda a /citas ni a /eventos, y su URL se vuelve a leer", () => {
    // El sentido entero del cambio: no queda una sola puerta al
    // directorio viejo. Y lo que se escribe se puede volver a parsear —
    // si las dos mitades se desincronizaran, el filtro se caería solo.
    for (const r of RUBROS_PORTADA) {
      const url = urlDeRubro(r.vertical, r.categoria);
      expect(url).not.toContain("/citas");
      expect(url).not.toContain("/eventos");

      const valor = new URL(url, "https://bookea.lat").searchParams.get("rubro");
      expect(rubroDeParametro(valor ?? undefined)).toMatchObject({
        vertical: r.vertical,
        categoria: r.categoria,
      });
    }
  });
});
