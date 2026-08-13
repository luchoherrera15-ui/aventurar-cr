import { describe, expect, it } from "vitest";
import { CONSEJO_TARJETA, momentoDeInicio, type MomentoInicio } from "./inicio";
import { ESTADOS_VISIBLES } from "./programas";
import { TIPOS_TARJETA_ID, TIPOS_TARJETA } from "./tipos-tarjeta";

function caso(extra: Partial<Parameters<typeof momentoDeInicio>[0]> = {}) {
  return momentoDeInicio({
    vivas: 1,
    operan: 1,
    tipo: "sellos",
    tieneMeta: true,
    miembros: 40,
    ...extra,
  });
}

describe("momentoDeInicio", () => {
  it("sin ninguna tarjeta viva, la bienvenida", () => {
    expect(caso({ vivas: 0, operan: 0, miembros: 0 })).toBe("sin-tarjeta");
  });

  it("una tarjeta archivada no cuenta como tarjeta", () => {
    // `vivas` ya viene sin archivadas: el negocio tiene que crear otra,
    // no «publicar» la que archivó a propósito.
    expect(caso({ vivas: 0, operan: 0, miembros: 300 })).toBe("sin-tarjeta");
  });

  it("con tarjeta que no emite pases, hay que publicarla", () => {
    expect(caso({ operan: 0, miembros: 0 })).toBe("sin-publicar");
  });

  it("«sin publicar» gana sobre «sin clientes»", () => {
    // Decirle «nadie se afilió» a quien tiene la tarjeta en borrador es
    // cierto e inútil: nadie PUEDE afiliarse.
    expect(caso({ operan: 0, tieneMeta: false, miembros: 0 })).toBe("sin-publicar");
  });

  it("activa y acumulativa sin recompensa: no promete nada", () => {
    expect(caso({ tieneMeta: false })).toBe("sin-meta");
  });

  it("a lo que NO acumula no se le exige recompensa", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      if (TIPOS_TARJETA[tipo].acumula) continue;
      expect(caso({ tipo, tieneMeta: false })).toBe("en-marcha");
      expect(caso({ tipo, tieneMeta: false, miembros: 0 })).toBe("sin-clientes");
    }
  });

  it("a lo que SÍ acumula se le exige", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      if (!TIPOS_TARJETA[tipo].acumula) continue;
      expect(caso({ tipo, tieneMeta: false })).toBe("sin-meta");
    }
  });

  it("lista y sin nadie afiliado: falta repartir el QR", () => {
    expect(caso({ miembros: 0 })).toBe("sin-clientes");
  });

  it("con gente adentro, el tablero muestra números", () => {
    expect(caso()).toBe("en-marcha");
  });

  it("solo «en-marcha» habilita las métricas", () => {
    // El resto de los momentos existe justamente para NO mostrar cuatro
    // ceros: si alguno se colara, volvería el tablero desmoralizante.
    const conCeros: MomentoInicio[] = [
      caso({ vivas: 0, operan: 0, miembros: 0 }),
      caso({ operan: 0, miembros: 0 }),
      caso({ tieneMeta: false, miembros: 0 }),
      caso({ miembros: 0 }),
    ];
    expect(conCeros).not.toContain("en-marcha");
  });
});

describe("CONSEJO_TARJETA", () => {
  it("cada estado visible tiene qué hacer, no solo qué pasa", () => {
    for (const estado of ESTADOS_VISIBLES) {
      const c = CONSEJO_TARJETA[estado];
      expect(c.titulo.trim()).not.toBe("");
      expect(c.consejo.trim()).not.toBe("");
      expect(c.boton.trim()).not.toBe("");
    }
  });
});
