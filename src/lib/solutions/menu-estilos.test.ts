import { describe, expect, it } from "vitest";
import {
  CUANTOS_ESTILOS_MENU,
  ESTILO_MENU,
  ESTILOS_MENU,
  ESTILOS_MENU_GRATIS,
  estiloMenuDe,
  estiloMenuParaPlan,
  type PapelMenu,
} from "./menu-estilos";
import { pintaDeEstilo } from "./menu-pinta";

const TEMA: PapelMenu = {
  fondo: "#111111",
  tinta: "#EEEEEE",
  suave: "#999999",
  superficie: "#222222",
  borde: "#333333",
  acento: "#00FF00",
  sobreAcento: "#000000",
};

describe("el catálogo de diseños", () => {
  it("ofrece dos en Gratis y veintiséis en total", () => {
    expect(ESTILOS_MENU).toHaveLength(26);
    expect(ESTILOS_MENU_GRATIS).toHaveLength(2);
    expect(CUANTOS_ESTILOS_MENU).toEqual({ gratis: 2, pro: 26 });
  });

  it("cada id tiene su ficha, y la marca `pro` coincide con la lista de gratis", () => {
    for (const id of ESTILOS_MENU) {
      const def = ESTILO_MENU[id];
      expect(def, id).toBeDefined();
      expect(def.pro, id).toBe(!ESTILOS_MENU_GRATIS.includes(id));
    }
  });

  it("ningún diseño repite nombre — dos «Bistró» en la grilla serían un error", () => {
    const nombres = ESTILOS_MENU.map((id) => ESTILO_MENU[id].nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("todos tienen pie de una línea: es lo que el dueño lee para elegir", () => {
    for (const id of ESTILOS_MENU) {
      expect(ESTILO_MENU[id].pie.length, id).toBeGreaterThan(10);
      expect(ESTILO_MENU[id].pie.includes("\n"), id).toBe(false);
    }
  });
});

describe("estiloMenuDe", () => {
  it("acepta lo que existe", () => {
    expect(estiloMenuDe("bistro")).toBe("bistro");
  });

  it("lo desconocido, lo vacío y la basura caen en el base", () => {
    expect(estiloMenuDe("carta-de-vinos")).toBe("clasico");
    expect(estiloMenuDe(undefined)).toBe("clasico");
    expect(estiloMenuDe({ menu: "bistro" })).toBe("clasico");
  });
});

describe("estiloMenuParaPlan", () => {
  it("Pro elige cualquiera", () => {
    expect(estiloMenuParaPlan("nocturno", true)).toBe("nocturno");
  });

  it("Gratis conserva los suyos", () => {
    expect(estiloMenuParaPlan("carta", false)).toBe("carta");
  });

  it("Gratis con un diseño Pro vuelve al base — el candado lo pone el servidor", () => {
    expect(estiloMenuParaPlan("nocturno", false)).toBe("clasico");
  });
});

describe("pintaDeEstilo", () => {
  it("el papel del diseño gana sobre el tema de la página", () => {
    const p = pintaDeEstilo(ESTILO_MENU.pizarron, TEMA);
    expect(p.paleta.fondo).toBe(ESTILO_MENU.pizarron.papel?.fondo);
  });

  it("sin papel propio, hereda los colores del link hub", () => {
    expect(ESTILO_MENU.clasico.papel).toBeNull();
    expect(pintaDeEstilo(ESTILO_MENU.clasico, TEMA).paleta).toEqual(TEMA);
  });

  it("arma la familia tipográfica con su respaldo", () => {
    expect(pintaDeEstilo(ESTILO_MENU.bistro, TEMA).familia).toContain("--fuente-elegante");
    expect(pintaDeEstilo(ESTILO_MENU.bistro, TEMA).familia).toContain("Georgia");
  });

  it("las grillas de tres columnas piden más ancho que una carta de puntos", () => {
    const ancho = (id: keyof typeof ESTILO_MENU) => Number(pintaDeEstilo(ESTILO_MENU[id], TEMA).ancho.replace("px", ""));
    expect(ancho("mosaico")).toBeGreaterThan(ancho("bistro"));
  });
});
