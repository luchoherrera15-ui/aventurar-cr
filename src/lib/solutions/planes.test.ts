import { describe, expect, it } from "vitest";
import { DISENO_BASE, type Diseno } from "./temas";
import { hostMarcaDe, planLinksyDe, sanearParaPlan, TEMAS_GRATIS, type VestidoPagina } from "./planes";

const todoPro: VestidoPagina = {
  tema: "neon",
  estiloLinks: "grilla",
  fuente: "editorial",
  estiloPortada: "completa",
  efecto: "vidrio",
  diseno: {
    ...DISENO_BASE,
    animacion: "subir",
    hover: "elevar",
    fondo: "aurora",
    boton: "solido",
    vitrina: "todo",
    encabezado: "grabado",
    piezas: "suelta",
    logoForma: "cuadrado",
    titulo: "grande",
  } as Diseno,
};

describe("sanearParaPlan", () => {
  it("con Pro devuelve el vestido tal cual", () => {
    expect(sanearParaPlan(todoPro, "pro")).toEqual(todoPro);
  });

  it("sin Pro, cada campo Pro vuelve a su valor gratis y lo gratis se conserva", () => {
    const s = sanearParaPlan(todoPro, "gratis");
    expect(s.tema).toBe("marca");
    expect(s.estiloLinks).toBe("lista");
    expect(s.fuente).toBe("sistema");
    expect(s.estiloPortada).toBe("sin");
    expect(s.efecto).toBe("plano");
    expect(s.diseno.animacion).toBe("ninguna");
    expect(s.diseno.fondo).toBe("liso");
    expect(s.diseno.boton).toBe("acabado");
    expect(s.diseno.vitrina).toBe("boton");
    expect(s.diseno.encabezado).toBe("tarjeta");
    expect(s.diseno.piezas).toBe("tarjeta");
    // Lo que es gratis no se toca.
    expect(s.diseno.logoForma).toBe("cuadrado");
    expect(s.diseno.titulo).toBe("grande");
  });

  it("los temas gratis y la portada «Banner» pasan sin Pro", () => {
    for (const tema of TEMAS_GRATIS) {
      expect(sanearParaPlan({ ...todoPro, tema, estiloPortada: "card" }, "gratis").tema).toBe(tema);
    }
    expect(sanearParaPlan({ ...todoPro, estiloPortada: "card" }, "gratis").estiloPortada).toBe("card");
  });
});

describe("lectura de la base", () => {
  it("un plan desconocido es gratis; un host desconocido es linksy", () => {
    expect(planLinksyDe("pro")).toBe("pro");
    expect(planLinksyDe("premium")).toBe("gratis");
    expect(planLinksyDe(undefined)).toBe("gratis");
    expect(hostMarcaDe("bookea")).toBe("bookea");
    expect(hostMarcaDe(null)).toBe("linksy");
  });
});
