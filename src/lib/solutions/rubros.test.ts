import { describe, expect, it } from "vitest";
import { IDIOMAS_EXTRA } from "./idiomas";
import { esDeComida, ROTULOS_CATALOGO, RUBRO, RUBROS, rotulosDe, rubroDe, TIPOS_CATALOGO, tipoCatalogoDe, VOCAB, vocabDe } from "./rubros";

describe("los rubros", () => {
  it("cada rubro tiene nombre y apunta a un tipo de catálogo", () => {
    for (const r of RUBROS) {
      expect(RUBRO[r].nombre.length).toBeGreaterThan(0);
      expect(TIPOS_CATALOGO).toContain(RUBRO[r].catalogo);
    }
  });
  it("solo los de comida tienen mesa", () => {
    expect(esDeComida("restaurante")).toBe(true);
    expect(esDeComida("lavacar")).toBe(false);
    expect(esDeComida("boutique")).toBe(false);
  });
  it("el parser cae a restaurante, que es lo que había", () => {
    expect(rubroDe("lavacar")).toBe("lavacar");
    expect(rubroDe("x")).toBe("restaurante");
    expect(rubroDe(undefined)).toBe("restaurante");
  });
  it("el vocabulario cambia con el tipo", () => {
    expect(vocabDe("restaurante").items).toBe("platos");
    expect(vocabDe("lavacar").items).toBe("servicios");
    expect(vocabDe("boutique").items).toBe("productos");
    expect(vocabDe("restaurante").tablero).toBe("Modo restaurante");
    expect(vocabDe("tienda").modalidades.llevar.rotulo).toBe("Recoger en tienda");
    expect(tipoCatalogoDe("spa")).toBe("servicios");
  });
  it("los rótulos públicos existen en los seis idiomas para los tres tipos", () => {
    for (const tipo of TIPOS_CATALOGO) {
      for (const i of ["es", ...IDIOMAS_EXTRA] as const) {
        const r = ROTULOS_CATALOGO[tipo][i];
        expect(r.titulo.length).toBeGreaterThan(0);
        expect(r.enviar.length).toBeGreaterThan(0);
        expect(r.consultarWhatsapp.length).toBeGreaterThan(0);
      }
    }
    expect(rotulosDe("lavacar", "en").titulo).toBe("Our services");
    expect(rotulosDe("restaurante", "es").llevar).toBe("To go");
  });
  it("cada vocabulario tiene todas las llaves", () => {
    const llaves = Object.keys(VOCAB.menu).sort();
    expect(Object.keys(VOCAB.servicios).sort()).toEqual(llaves);
    expect(Object.keys(VOCAB.productos).sort()).toEqual(llaves);
  });
});
