import { describe, expect, it } from "vitest";
import {
  ESTILOS,
  ESTILOS_PLANTILLA,
  ESTILOS_POSTER,
  ESTILO_POR_DEFECTO,
  TIPOGRAFIAS,
  TIPOGRAFIAS_POSTER,
  TOPES_POSTER,
  configPosterPorDefecto,
  contenidoDelPoster,
  copyDelPoster,
  estiloDe,
  etiquetaDeMeta,
  leerConfigPoster,
  paletaSobre,
  validarConfigPoster,
  variablesDePoster,
  type ConfigPoster,
} from "./plantillas-poster";
import { TIPOS_TARJETA_ID } from "./tipos-tarjeta";

describe("estiloDe", () => {
  it("acepta los seis", () => {
    for (const e of ESTILOS_POSTER) expect(estiloDe(e)).toBe(e);
  });

  /** Llega de la URL (?estilo=), o sea de afuera: nunca puede reventar. */
  it("lo desconocido cae al de por defecto", () => {
    expect(estiloDe(null)).toBe(ESTILO_POR_DEFECTO);
    expect(estiloDe(undefined)).toBe(ESTILO_POR_DEFECTO);
    expect(estiloDe("")).toBe(ESTILO_POR_DEFECTO);
    expect(estiloDe("<script>")).toBe(ESTILO_POR_DEFECTO);
    expect(estiloDe("Minimalista")).toBe(ESTILO_POR_DEFECTO); // ojo: distingue mayúsculas
  });
});

describe("ESTILOS", () => {
  it("los seis están definidos y con su id coherente", () => {
    expect(Object.keys(ESTILOS)).toHaveLength(6);
    for (const e of ESTILOS_POSTER) expect(ESTILOS[e].id).toBe(e);
  });

  /**
   * El personalizado ARRANCA de una plantilla: no es un layout propio.
   * Si se colara en la lista de plantillas, su `base` podría apuntar a
   * sí mismo y la hoja se quedaría sin estructura que dibujar.
   */
  it("«personalizado» no es una de las cinco plantillas", () => {
    expect(ESTILOS_PLANTILLA).toHaveLength(5);
    expect(ESTILOS_PLANTILLA as readonly string[]).not.toContain("personalizado");
    expect(ESTILOS_POSTER as readonly string[]).toContain("personalizado");
  });

  it("cada uno explica para quién es y en qué se nota", () => {
    for (const e of ESTILOS_POSTER) {
      expect(ESTILOS[e].paraQuien.length).toBeGreaterThan(20);
      expect(ESTILOS[e].seNota.length).toBeGreaterThan(20);
    }
  });

  /**
   * El pedido fue «5 diseños», no «5 paletas». Si todos compartieran
   * las mismas banderas estructurales serían el mismo póster pintado
   * distinto — que es exactamente lo que se estaba corrigiendo.
   */
  it("no son el mismo diseño con otro color", () => {
    const formas = ESTILOS_POSTER.map(
      (e) => `${ESTILOS[e].fondoDeMarca}-${ESTILOS[e].usaFoto}`,
    );
    expect(new Set(formas).size).toBeGreaterThan(1);
  });
});

describe("copyDelPoster", () => {
  it("los OCHO tipos tienen su texto, sin caer al genérico", () => {
    for (const t of TIPOS_TARJETA_ID) {
      const c = copyDelPoster(t);
      expect(c.pasos).toHaveLength(3);
      expect(c.titulo.length).toBeGreaterThan(5);
      if (t !== "sellos") {
        expect(c.titulo, `${t} usa el texto de sellos`).not.toBe(copyDelPoster("sellos").titulo);
      }
    }
  });

  /**
   * El bug que esto cierra: el póster decía «Sumá sellos con tu
   * teléfono» para TODOS los tipos. Un cartel que promete lo que la
   * tarjeta no hace se paga en la caja.
   */
  it("una gift card no invita a sumar sellos", () => {
    expect(copyDelPoster("giftcard").titulo.toLowerCase()).not.toContain("sello");
    expect(copyDelPoster("evento").titulo.toLowerCase()).not.toContain("sello");
    expect(copyDelPoster("cupon").titulo.toLowerCase()).not.toContain("sello");
  });

  it("un tipo desconocido cae a sellos en vez de quedarse sin póster", () => {
    expect(copyDelPoster(null)).toEqual(copyDelPoster("sellos"));
    expect(copyDelPoster("inventado")).toEqual(copyDelPoster("sellos"));
  });
});

describe("etiquetaDeMeta", () => {
  it("solo la ponen los tipos que acumulan", () => {
    expect(etiquetaDeMeta("sellos", 10)).toBe("A los 10 sellos");
    expect(etiquetaDeMeta("puntos", 200)).toBe("A los 200 puntos");
    expect(etiquetaDeMeta("cashback", 500)).toBe("A los 500 puntos");
  });

  it("en un cupón o una entrada, «A los 10 sellos» no significa nada", () => {
    expect(etiquetaDeMeta("cupon", 10)).toBeNull();
    expect(etiquetaDeMeta("giftcard", 10)).toBeNull();
    expect(etiquetaDeMeta("evento", 10)).toBeNull();
    expect(etiquetaDeMeta("membresia", 10)).toBeNull();
    expect(etiquetaDeMeta("descuento", 10)).toBeNull();
  });

  it("sin meta no hay etiqueta", () => {
    expect(etiquetaDeMeta("sellos", null)).toBeNull();
    expect(etiquetaDeMeta("sellos", 0)).toBeNull();
  });
});

// ── El póster escrito por el dueño ─────────────────────────────────

const ACENTO = "#ee7420";

function configValida(cambios: Partial<ConfigPoster> = {}): ConfigPoster {
  return { ...configPosterPorDefecto("sellos", ACENTO), ...cambios };
}

describe("configPosterPorDefecto", () => {
  it("arranca con el texto de la plantilla del tipo, no con campos vacíos", () => {
    const c = configPosterPorDefecto("giftcard", ACENTO);
    expect(c.titulo).toBe(copyDelPoster("giftcard").titulo);
    expect(c.pasos).toEqual(copyDelPoster("giftcard").pasos);
    expect(validarConfigPoster(c)).toBeNull();
  });

  it("nace sobre papel blanco y con el acento del negocio", () => {
    expect(configPosterPorDefecto("sellos", ACENTO).colorFondo).toBe("#ffffff");
    expect(configPosterPorDefecto("sellos", ACENTO).colorAcento).toBe(ACENTO);
  });

  /** Un color roto en la base no puede dejar el póster sin acento. */
  it("un acento inválido cae a uno que existe", () => {
    expect(configPosterPorDefecto("sellos", "rojo").colorAcento).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("leerConfigPoster", () => {
  /** `{}` es el DEFAULT de la columna (0132): es el caso normal. */
  it("un jsonb vacío da la plantilla entera", () => {
    expect(leerConfigPoster({}, "sellos", ACENTO)).toEqual(
      configPosterPorDefecto("sellos", ACENTO),
    );
  });

  it("lo que no es un objeto tampoco rompe", () => {
    for (const basura of [null, undefined, "texto", 7, [1, 2], true]) {
      expect(leerConfigPoster(basura, "sellos", ACENTO)).toEqual(
        configPosterPorDefecto("sellos", ACENTO),
      );
    }
  });

  it("toma lo que sirve y descarta lo que no, campo por campo", () => {
    const c = leerConfigPoster(
      {
        base: "ticket",
        titulo: "  Vení por tu café  ",
        invitacion: 42,
        pasos: ["Escaneá", null, "Listo"],
        mostrarPasos: false,
        mostrarPremio: "sí",
        colorFondo: "#000000",
        colorAcento: "verde",
      },
      "sellos",
      ACENTO,
    );
    expect(c.base).toBe("ticket");
    expect(c.titulo).toBe("Vení por tu café");
    expect(c.invitacion).toBe(copyDelPoster("sellos").invitacion);
    expect(c.pasos[1]).toBe(copyDelPoster("sellos").pasos[1]);
    expect(c.mostrarPasos).toBe(false);
    expect(c.mostrarPremio).toBe(true);
    expect(c.colorFondo).toBe("#000000");
    expect(c.colorAcento).toBe(ACENTO);
  });

  /** `base: 'personalizado'` se referenciaría a sí mismo: sin layout. */
  it("una base que no es plantilla cae a la de por defecto", () => {
    expect(leerConfigPoster({ base: "personalizado" }, "sellos", ACENTO).base).toBe(
      configPosterPorDefecto("sellos", ACENTO).base,
    );
  });

  /**
   * Al LEER se recorta, no se rechaza: un texto largo guardado por una
   * versión anterior es un póster que igual hay que dibujar.
   */
  it("un texto larguísimo ya guardado se recorta en vez de tirar la pantalla", () => {
    const c = leerConfigPoster({ titulo: "x".repeat(500) }, "sellos", ACENTO);
    expect(c.titulo).toHaveLength(TOPES_POSTER.titulo);
    expect(validarConfigPoster(c)).toBeNull();
  });
});

describe("validarConfigPoster", () => {
  it("la config por defecto es válida", () => {
    expect(validarConfigPoster(configValida())).toBeNull();
  });

  /** El bug que esto cierra: A4 no avisa cuando algo no entra, recorta. */
  it("un título de 300 caracteres no se guarda", () => {
    const motivo = validarConfigPoster(configValida({ titulo: "x".repeat(300) }));
    expect(motivo).toContain("título");
    expect(validarConfigPoster(configValida({ invitacion: "x".repeat(300) }))).not.toBeNull();
    expect(
      validarConfigPoster(configValida({ pasos: ["ok", "x".repeat(300), "ok"] })),
    ).not.toBeNull();
  });

  it("nada de textos vacíos", () => {
    expect(validarConfigPoster(configValida({ titulo: "   " }))).not.toBeNull();
    expect(validarConfigPoster(configValida({ invitacion: "" }))).not.toBeNull();
    expect(validarConfigPoster(configValida({ pasos: ["ok", "", "ok"] }))).not.toBeNull();
  });

  it("el título entra en dos líneas", () => {
    expect(validarConfigPoster(configValida({ titulo: "una\ndos" }))).toBeNull();
    expect(validarConfigPoster(configValida({ titulo: "una\ndos\ntres" }))).not.toBeNull();
  });

  it("los colores son hexadecimales o no son", () => {
    expect(validarConfigPoster(configValida({ colorFondo: "blanco" }))).not.toBeNull();
    expect(validarConfigPoster(configValida({ colorAcento: "#fff" }))).not.toBeNull();
    expect(validarConfigPoster(configValida({ colorFondo: "#A1B2C3" }))).toBeNull();
  });

  it("la base tiene que ser una de las cinco", () => {
    const rota = { ...configValida(), base: "personalizado" } as unknown as ConfigPoster;
    expect(validarConfigPoster(rota)).not.toBeNull();
  });

  /**
   * Esto termina en un `font-family` que se pinta en la hoja. Un valor
   * libre ahí no es «una letra rara»: es CSS que alguien de afuera
   * eligió. La lista blanca corre en el SERVIDOR, no solo en el form.
   */
  it("la tipografía tiene que ser una de las cuatro", () => {
    for (const t of TIPOGRAFIAS_POSTER) {
      expect(validarConfigPoster(configValida({ tipografia: t }))).toBeNull();
    }
    for (const basura of ["Comic Sans", "", "red;}html{display:none", "MODERNA"]) {
      const rota = { ...configValida(), tipografia: basura } as unknown as ConfigPoster;
      expect(validarConfigPoster(rota)).not.toBeNull();
    }
    const sinCampo = { ...configValida() } as Partial<ConfigPoster>;
    delete sinCampo.tipografia;
    expect(validarConfigPoster(sinCampo as ConfigPoster)).not.toBeNull();
  });
});

describe("tipografías", () => {
  it("las cuatro están definidas, con id coherente y nombre de negocio", () => {
    for (const id of TIPOGRAFIAS_POSTER) {
      const t = TIPOGRAFIAS[id];
      expect(t.id).toBe(id);
      expect(t.nombre.length).toBeGreaterThan(2);
      expect(t.nota.length).toBeGreaterThan(10);
      // Nombres que un dueño de barbería entienda: nada de «Montserrat».
      expect(t.nombre).not.toMatch(/Montserrat|Figtree|mono|serif/i);
    }
    expect(new Set(Object.values(TIPOGRAFIAS).map((t) => t.nombre)).size).toBe(4);
  });

  /**
   * EL PÓSTER GUARDADO AYER NO PUEDE CAMBIAR SOLO.
   *
   * Los cinco estilos ya traían tipografía propia en el CSS, así que un
   * póster guardado antes de que este campo existiera se está
   * imprimiendo con la de SU estilo. Si el valor por defecto fuera
   * «moderna» a secas, al desplegar esto el ticket de alguien dejaría de
   * parecer un recibo sin que nadie tocara nada.
   */
  it("un póster guardado sin el campo conserva la letra de su estilo", () => {
    expect(leerConfigPoster({ base: "ticket" }, "sellos", ACENTO).tipografia).toBe("maquina");
    expect(leerConfigPoster({ base: "clasico" }, "sellos", ACENTO).tipografia).toBe("clasica");
    expect(leerConfigPoster({ base: "audaz" }, "sellos", ACENTO).tipografia).toBe("moderna");
    // Y lo guardado que ya la trae manda sobre el default del estilo.
    expect(
      leerConfigPoster({ base: "ticket", tipografia: "cercana" }, "sellos", ACENTO).tipografia,
    ).toBe("cercana");
    // Basura en la columna cae a la del estilo, no rompe la pantalla.
    expect(
      leerConfigPoster({ base: "ticket", tipografia: "Arial" }, "sellos", ACENTO).tipografia,
    ).toBe("maquina");
  });

  it("todas las combinaciones de estilo y letra son guardables", () => {
    for (const base of ESTILOS_PLANTILLA) {
      for (const tipografia of TIPOGRAFIAS_POSTER) {
        expect(validarConfigPoster(configValida({ base, tipografia }))).toBeNull();
      }
    }
  });
});

describe("paletaSobre", () => {
  /** Sin esto, fondo oscuro + tinta negra = un póster en blanco. */
  it("sobre papel oscuro la tinta es clara, y al revés", () => {
    expect(paletaSobre("#ffffff").tinta).toBe("#101828");
    expect(paletaSobre("#0a1226").tinta).toBe("#ffffff");
    expect(paletaSobre("#002472").tinta).toBe("#ffffff");
  });

  /**
   * El ojo pesa el verde mucho más que el azul: dos colores con el
   * mismo promedio RGB no piden la misma tinta.
   */
  it("pesa el verde más que el azul", () => {
    expect(paletaSobre("#00ff00").tinta).toBe("#101828");
    expect(paletaSobre("#0000ff").tinta).toBe("#ffffff");
  });

  it("un color roto no deja el texto invisible", () => {
    expect(paletaSobre("nada").tinta).toBe("#101828");
  });
});

describe("contenidoDelPoster", () => {
  it("las cinco plantillas ignoran la config y muestran todo", () => {
    const config = configValida({ titulo: "MÍO", mostrarPasos: false });
    for (const e of ESTILOS_PLANTILLA) {
      const c = contenidoDelPoster(e, "sellos", config);
      expect(c.titulo).toBe(copyDelPoster("sellos").titulo);
      expect(c.mostrarPasos).toBe(true);
    }
  });

  it("el personalizado manda con lo que el dueño escribió", () => {
    const config = configValida({ titulo: "MÍO", mostrarPremio: false });
    const c = contenidoDelPoster("personalizado", "sellos", config);
    expect(c.titulo).toBe("MÍO");
    expect(c.mostrarPremio).toBe(false);
  });

  /** Si la 0132 no está, no hay config: la hoja sale con la plantilla. */
  it("sin config guardada, el personalizado cae a la plantilla del tipo", () => {
    const c = contenidoDelPoster("personalizado", "evento", null);
    expect(c.titulo).toBe(copyDelPoster("evento").titulo);
    expect(c.mostrarPie).toBe(true);
  });
});

describe("variablesDePoster", () => {
  const colores = { fondo: "#002472", acento: "#f39200" };

  it("sin config, el papel lo pone el CSS de la plantilla", () => {
    const v = variablesDePoster(colores, null);
    expect(v["--poster-marca"]).toBe("#002472");
    expect(v["--poster-acento"]).toBe("#f39200");
    expect(v["--poster-papel"]).toBeUndefined();
  });

  it("con config, el papel y la tinta son los del dueño", () => {
    const v = variablesDePoster(colores, configValida({ colorFondo: "#101010", colorAcento: "#ee7420" }));
    expect(v["--poster-papel"]).toBe("#101010");
    expect(v["--poster-acento"]).toBe("#ee7420");
    expect(v["--poster-tinta"]).toBe("#ffffff");
    // El color del PASE sigue disponible: el degradado de vitrina lo usa
    // aunque el papel sea otro.
    expect(v["--poster-marca"]).toBe("#002472");
  });
});
