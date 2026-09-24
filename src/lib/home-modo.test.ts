import { describe, expect, it } from "vitest";
import { PARAMS_BUSQUEDA, hayBusqueda, modoHome } from "./home-modo";

/**
 * La costura del home. Estos tests son la red que impide que un
 * rediseño futuro deje a la gente que llega buscando mirando una
 * landing de producto.
 */

describe("hayBusqueda", () => {
  it("sin parámetros no es una búsqueda", () => {
    expect(hayBusqueda({})).toBe(false);
  });

  it("cualquiera de los ocho parámetros la convierte en búsqueda", () => {
    for (const clave of PARAMS_BUSQUEDA) {
      expect(hayBusqueda({ [clave]: "algo" })).toBe(true);
    }
  });

  it("LA PRESENCIA MANDA: un parámetro vacío igual es búsqueda", () => {
    // `/?q=` hoy muestra el catálogo entero. Tiene que seguir
    // mostrándolo: quien llega con ese link espera resultados.
    expect(hayBusqueda({ q: "" })).toBe(true);
    expect(hayBusqueda({ lugar: "" })).toBe(true);
  });

  it("un parámetro repetido llega como arreglo y también cuenta", () => {
    expect(hayBusqueda({ q: ["barberia", "spa"] })).toBe(true);
  });

  it("los parámetros ajenos no la convierten en búsqueda", () => {
    // Las campañas cuelgan `utm_*` de cualquier link. Si eso mandara a
    // Descubrir, un anuncio de «creá tu negocio» caería en el catálogo.
    expect(hayBusqueda({ utm_source: "instagram", utm_campaign: "setiembre" })).toBe(
      false,
    );
    expect(hayBusqueda({ fbclid: "xyz", gclid: "abc", ref: "socio" })).toBe(false);
  });

  it("no se confunde con una clave que solo EMPIEZA parecido", () => {
    expect(hayBusqueda({ query: "barberia", lugarcito: "x", subtotal: "1" })).toBe(false);
  });
});

describe("modoHome", () => {
  it("la portada limpia es la plataforma", () => {
    expect(modoHome({})).toBe("plataforma");
  });

  it("con búsqueda es descubrir", () => {
    expect(modoHome({ q: "barberia" })).toBe("descubrir");
    expect(modoHome({ lugar: "Heredia" })).toBe("descubrir");
    expect(modoHome({ provincia: "San Jose" })).toBe("descubrir");
    expect(modoHome({ rubro: "citas" })).toBe("descubrir");
    expect(modoHome({ rubro: "citas", sub: "citas-cat-barberia" })).toBe("descubrir");
  });

  it("los parámetros que emite el buscador y la portada aún no lee también cuentan", () => {
    expect(modoHome({ categoria: "barberia" })).toBe("descubrir");
    expect(modoHome({ subcategoria: "catering" })).toBe("descubrir");
    expect(modoHome({ pais: "PA" })).toBe("descubrir");
  });

  it("los 301 de los directorios borrados caen en descubrir con su query", () => {
    // `/citas?q=barberia` -> 301 -> `/?q=barberia`
    expect(modoHome({ q: "barberia" })).toBe("descubrir");
    // `/eventos?q=spa&lugar=Heredia` -> 301 -> `/?q=spa&lugar=Heredia`
    expect(modoHome({ q: "spa", lugar: "Heredia" })).toBe("descubrir");
  });

  it("pero `/citas` pelado cae en la portada, y eso está bien", () => {
    // El 301 manda a `/` sin query: quien entró al directorio viejo sin
    // buscar nada no pidió resultados de nada en particular.
    expect(modoHome({})).toBe("plataforma");
  });

  it("una campaña con utm sigue viendo la plataforma", () => {
    expect(modoHome({ utm_source: "instagram" })).toBe("plataforma");
  });

  it("/demo-bookea es SIEMPRE descubrir, con o sin parámetros", () => {
    // Existe para enseñar el catálogo lleno de negocios de muestra.
    expect(modoHome({}, { demo: true })).toBe("descubrir");
    expect(modoHome({ q: "barberia" }, { demo: true })).toBe("descubrir");
    expect(modoHome({ utm_source: "x" }, { demo: true })).toBe("descubrir");
  });

  it("demo: false se comporta como no pasar nada", () => {
    expect(modoHome({}, { demo: false })).toBe("plataforma");
    expect(modoHome({ q: "x" }, { demo: false })).toBe("descubrir");
  });

  it("/all es SIEMPRE descubrir, con o sin parámetros", () => {
    // Es la dirección fija del marketplace (dueño, 24 sep 2026): si sin
    // parámetros cayera en la landing de producto, la dirección estaría
    // prometiendo lo contrario de lo que entrega.
    expect(modoHome({}, { forzarDescubrir: true })).toBe("descubrir");
    expect(modoHome({ rubro: "citas" }, { forzarDescubrir: true })).toBe("descubrir");
    expect(modoHome({ utm_source: "x" }, { forzarDescubrir: true })).toBe("descubrir");
  });

  it("forzarDescubrir: false se comporta como no pasar nada", () => {
    expect(modoHome({}, { forzarDescubrir: false })).toBe("plataforma");
    expect(modoHome({ q: "x" }, { forzarDescubrir: false })).toBe("descubrir");
  });

  it("las dos banderas juntas no se pelean", () => {
    expect(modoHome({}, { demo: true, forzarDescubrir: false })).toBe("descubrir");
    expect(modoHome({}, { demo: false, forzarDescubrir: true })).toBe("descubrir");
  });
});
