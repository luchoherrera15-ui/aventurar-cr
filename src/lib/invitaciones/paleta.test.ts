import { describe, expect, it } from "vitest";
import {
  conAlfa,
  contraste,
  extraerPaleta,
  normalizarColor,
  paletaDelAlbum,
  paletaGuardada,
  PALETA_ALBUM_DEFECTO,
  tintaLegible,
} from "./paleta";

/**
 * La extracción de paleta es una heurística sobre CSS que escribió un
 * modelo, así que se prueba con HTML parecido al de verdad. Lo que se
 * verifica no es "qué color exacto sale" sino las dos promesas que le
 * hacemos al cliente: que el álbum se parezca a su invitación, y que
 * el texto se lea siempre.
 */

describe("normalizarColor", () => {
  it("entiende las notaciones que aparecen en el CSS generado", () => {
    expect(normalizarColor("#FFF")).toBe("#ffffff");
    expect(normalizarColor("#1A1A2E")).toBe("#1a1a2e");
    expect(normalizarColor("rgb(22, 41, 94)")).toBe("#16295e");
    expect(normalizarColor("rgba(22,41,94,0.5)")).toBe("#16295e");
    expect(normalizarColor("  #16295e  ")).toBe("#16295e");
  });

  it("devuelve null con lo que no es un color", () => {
    expect(normalizarColor("transparent")).toBeNull();
    expect(normalizarColor("")).toBeNull();
    expect(normalizarColor("var(--fondo)")).toBeNull();
  });
});

describe("extraerPaleta", () => {
  it("saca el lienzo de una invitación oscura y elegante", () => {
    const html = `
      <div class="hoja">
        <style>
          .hoja { background: #1a1a2e; color: #f0e6d2; }
          .seccion { background-color: #1a1a2e; }
          .marco { background: #1a1a2e; border: 1px solid #c9a227; }
          .fecha { color: #c9a227; }
        </style>
      </div>`;
    const p = extraerPaleta(html);
    expect(p?.fondo).toBe("#1a1a2e");
    expect(p?.tinta).toBe("#f0e6d2");
  });

  it("toma el primer color de un degradado como fondo", () => {
    const html = `<style>.x{background:linear-gradient(180deg,#0b3d2e 0%,#123 100%);color:#ffffff}</style>`;
    expect(extraerPaleta(html)?.fondo).toBe("#0b3d2e");
  });

  it("no confunde border-color con el color del texto", () => {
    const html = `<style>.a{background:#ffffff;border-color:#ff0000;color:#222222}</style>`;
    expect(extraerPaleta(html)?.tinta).toBe("#222222");
  });

  it("cambia la tinta cuando el diseño no contrastaría en la grilla", () => {
    // Texto gris clarito sobre fondo casi blanco: se lee en una portada
    // gigante, no debajo de una foto.
    const html = `<style>.a{background:#fdfdfd;color:#eeeeee}</style>`;
    const p = extraerPaleta(html);
    expect(p).not.toBeNull();
    expect(contraste(p!.tinta, p!.fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it("el acento se despega del fondo", () => {
    const html = `
      <style>
        .a{background:#f7f2ea;color:#16295e}
        .b{background:#f7f2ea}
        .c{background:#f7f2ea}
        .pie{background:#16295e}
      </style>`;
    const p = extraerPaleta(html);
    expect(p?.fondo).toBe("#f7f2ea");
    expect(contraste(p!.acento, p!.fondo)).toBeGreaterThanOrEqual(2);
  });

  it("devuelve null cuando no hay nada de dónde agarrarse", () => {
    expect(extraerPaleta(null)).toBeNull();
    expect(extraerPaleta("")).toBeNull();
    expect(extraerPaleta("<div>Sin estilos</div>")).toBeNull();
  });
});

describe("paletaGuardada", () => {
  it("acepta una paleta completa y la normaliza", () => {
    expect(paletaGuardada({ fondo: "#FFF", tinta: "#000", acento: "#C9A227" })).toEqual({
      fondo: "#ffffff",
      tinta: "#000000",
      acento: "#c9a227",
    });
  });

  it("rechaza media paleta: peor que el defecto", () => {
    expect(paletaGuardada({ fondo: "#ffffff" })).toBeNull();
    expect(paletaGuardada({ fondo: "#ffffff", tinta: "no-es-color", acento: "#000" })).toBeNull();
    expect(paletaGuardada(null)).toBeNull();
  });
});

describe("paletaDelAlbum", () => {
  const html = `<style>.a{background:#0b3d2e;color:#ffffff}</style>`;

  it("lo corregido a mano le gana al diseño", () => {
    const p = paletaDelAlbum({
      paleta: { fondo: "#ffffff", tinta: "#111111", acento: "#c9a227" },
      htmlPersonalizado: html,
    });
    expect(p.fondo).toBe("#ffffff");
  });

  it("sin corrección, se deduce del diseño", () => {
    expect(paletaDelAlbum({ htmlPersonalizado: html }).fondo).toBe("#0b3d2e");
  });

  it("sin diseño propio, queda el álbum de siempre", () => {
    expect(paletaDelAlbum({ htmlPersonalizado: null })).toEqual(PALETA_ALBUM_DEFECTO);
  });
});

describe("tintaLegible y conAlfa", () => {
  it("elige claro u oscuro según el lienzo", () => {
    expect(contraste(tintaLegible("#ffffff"), "#ffffff")).toBeGreaterThan(4.5);
    expect(contraste(tintaLegible("#101010"), "#101010")).toBeGreaterThan(4.5);
  });

  it("arma el rgba para las opacidades inline", () => {
    expect(conAlfa("#16295e", 0.55)).toBe("rgba(22, 41, 94, 0.55)");
  });
});
