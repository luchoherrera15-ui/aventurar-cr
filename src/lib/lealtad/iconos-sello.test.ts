import { describe, expect, it } from "vitest";
import {
  ICONOS_SELLO,
  ICONOS_SELLO_ID,
  ICONOS_SELLO_LISTA,
  SELLO_PROPIO,
  esIconoSello,
  esSelloElegido,
  iconoDelSello,
  imagenDentroDelSello,
  selloDelPase,
  selloParaGuardar,
  urlDeIconoPropio,
} from "./iconos-sello";
import { escalonesDeLaTira } from "@/lib/wallet/escalones-tira";

/** Una URL como la que devuelve nuestro storage al subir un ícono. */
const URL_ICONO =
  "https://proyecto.supabase.co/storage/v1/object/public/ranchos-fotos/lealtad/iconos/u/1.png";

/**
 * El catálogo de iconos del sello: qué se puede elegir y, sobre todo,
 * qué NO puede llegar a la base.
 *
 * La columna `pase_sello_icono` (0145) tiene su CHECK, pero el CHECK es
 * el piso: lo que falle ahí llega al dueño como un error de Postgres
 * que nadie puede leer. La puerta de verdad es `esIconoSello`, y es la
 * misma que usan el creador, el editor y el lector de la fila.
 */

describe("el catálogo", () => {
  it("son doce: una lista que se mira de un vistazo", () => {
    // Entre 8 y 12 fue la decisión de producto. Con cincuenta, elegir se
    // vuelve una tarea y la gente la saltea.
    expect(ICONOS_SELLO_ID.length).toBe(12);
    expect(new Set(ICONOS_SELLO_ID).size).toBe(12);
  });

  it("cada uno tiene nombre y trazos de verdad", () => {
    for (const icono of ICONOS_SELLO_LISTA) {
      expect(icono.nombre.trim().length).toBeGreaterThan(0);
      expect(icono.trazos.length).toBeGreaterThan(0);
      for (const d of icono.trazos) {
        // Un `d` que no arranca con un movimiento absoluto no dibuja
        // nada, y el sello saldría vacío en el teléfono de un cliente.
        expect(d).toMatch(/^M/);
        // Más de un par de coordenadas: un «M12 8» pelado solo mueve el
        // lápiz, no dibuja, y el sello saldría vacío en el teléfono.
        expect((d.match(/-?\d*\.?\d+/g) ?? []).length).toBeGreaterThan(2);
      }
    }
  });

  it("el id del catálogo y el de su ficha coinciden", () => {
    for (const id of ICONOS_SELLO_ID) expect(ICONOS_SELLO[id].id).toBe(id);
  });

  it("los nombres no se repiten", () => {
    const nombres = ICONOS_SELLO_LISTA.map((i) => i.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe("qué icono se acepta", () => {
  it("los doce, y nada más", () => {
    for (const id of ICONOS_SELLO_ID) expect(esIconoSello(id)).toBe(true);
    for (const basura of [
      "",
      " cafe",
      "CAFE",
      "café",
      "pizza",
      "../../etc/passwd",
      "cafe'; drop table programa_lealtad;--",
      null,
      undefined,
      42,
      {},
      ["cafe"],
    ]) {
      expect(esIconoSello(basura)).toBe(false);
    }
  });

  it("un icono inválido no llega a la base: se descarta al leer la fila", () => {
    expect(iconoDelSello({ tipo: "sellos", icono: "pizza" })).toBeNull();
    expect(iconoDelSello({ tipo: "sellos", icono: 7 })).toBeNull();
    expect(iconoDelSello({ tipo: "sellos", icono: null })).toBeNull();
    expect(iconoDelSello({ tipo: "sellos", icono: "cafe" })).toBe("cafe");
  });

  it("solo las tarjetas de SELLOS llevan icono", () => {
    // En los otros siete no hay círculos donde dibujarlo. Guardar el
    // dato igual dejaría basura que algún día alguien pinta.
    for (const tipo of ["puntos", "cupon", "descuento", "membresia", "giftcard", "evento", "cashback"]) {
      expect(iconoDelSello({ tipo, icono: "cafe" })).toBeNull();
    }
    // `modo` null se comporta como puntos desde la 0121.
    expect(iconoDelSello({ tipo: null, icono: "cafe" })).toBeNull();
    expect(iconoDelSello({ tipo: "sellos", icono: "cafe" })).toBe("cafe");
  });
});

describe("el icono y la escalera de la tira", () => {
  /**
   * La escalera (`escalones-tira.ts`) existe porque el LOGO del negocio
   * puede reventar a sharp —el caso real es un logo blanco sobre
   * transparente— y su último escalón es «sin el logo». Con un icono
   * elegido el logo ya no entra al sello, así que ese escalón sería un
   * reintento idéntico al anterior.
   *
   * Lo que este bloque cuida es que agregar el icono NO haya cambiado la
   * escalera del negocio que no eligió ninguno.
   */
  it("sin icono, la escalera queda EXACTAMENTE como estaba", () => {
    const cual = imagenDentroDelSello({ sello: { clase: "logo" }, hayLogo: true });
    expect(cual).toBe("logo");
    expect(escalonesDeLaTira({ hayBanda: true, hayLogo: !!cual })).toEqual([
      { banda: true, logo: true },
      { banda: false, logo: true },
      { banda: false, logo: false },
    ]);
  });

  it("con icono, el logo sale del sello y el escalón repetido no se ofrece", () => {
    const cual = imagenDentroDelSello({ sello: { clase: "icono", icono: "cafe" }, hayLogo: true });
    expect(cual).toBeNull();
    expect(escalonesDeLaTira({ hayBanda: true, hayLogo: !!cual })).toEqual([
      { banda: true, logo: false },
      { banda: false, logo: false },
    ]);
  });

  it("sin logo cargado da lo mismo el icono: siempre hubo un solo intento", () => {
    const casos = [{ clase: "logo" } as const, { clase: "icono", icono: "cafe" } as const];
    for (const sello of casos) {
      const cual = imagenDentroDelSello({ sello, hayLogo: false });
      expect(escalonesDeLaTira({ hayBanda: false, hayLogo: !!cual })).toEqual([
        { banda: false, logo: false },
      ]);
    }
  });

  it("el ícono propio ocupa el lugar del logo — y su escalón de rescate", () => {
    // Un ícono propio puede reventar a sharp igual que un logo (un PNG
    // cortado, un archivo raro). Si la escalera no ofreciera el escalón
    // «sin la imagen», el pase saldría SIN TIRA: sin sellos, sin banda,
    // sin nada — exactamente el bug que `escalones-tira.ts` existe para
    // evitar.
    const cual = imagenDentroDelSello({
      sello: { clase: "propio", url: URL_ICONO },
      hayLogo: true,
    });
    expect(cual).toBe("propio");
    expect(escalonesDeLaTira({ hayBanda: true, hayLogo: !!cual })).toEqual([
      { banda: true, logo: true },
      { banda: false, logo: true },
      { banda: false, logo: false },
    ]);
  });
});

describe("el ícono propio (0174)", () => {
  it("una URL sirve solo si es https, corta y sin comillas", () => {
    expect(urlDeIconoPropio(URL_ICONO)).toBe(URL_ICONO);
    for (const basura of [
      "",
      "   ",
      "http://sitio.com/i.png",
      "javascript:alert(1)",
      "/lealtad/iconos/1.png",
      'https://sitio.com/i.png" onerror="x',
      "https://sitio.com/" + "a".repeat(600),
      null,
      undefined,
      42,
      {},
    ]) {
      expect(urlDeIconoPropio(basura)).toBeNull();
    }
  });

  it("'propio' es un valor elegible, y sigue sin ser uno de los doce", () => {
    expect(esSelloElegido(SELLO_PROPIO)).toBe(true);
    expect(esSelloElegido("cafe")).toBe(true);
    expect(esSelloElegido("pizza")).toBe(false);
    // `esIconoSello` NO cambió: sigue respondiendo por los doce dibujos,
    // que son los únicos que tienen trazos que pintar.
    expect(esIconoSello(SELLO_PROPIO)).toBe(false);
    expect(ICONOS_SELLO_ID).not.toContain(SELLO_PROPIO);
  });

  it("con archivo, el sello ES el ícono propio", () => {
    expect(selloDelPase({ tipo: "sellos", icono: SELLO_PROPIO, url: URL_ICONO })).toEqual({
      clase: "propio",
      url: URL_ICONO,
    });
  });

  it("'propio' SIN archivo se cae al logo de siempre, no a un círculo vacío", () => {
    for (const url of [null, "", "no-es-una-url", 7]) {
      expect(selloDelPase({ tipo: "sellos", icono: SELLO_PROPIO, url })).toEqual({
        clase: "logo",
      });
    }
  });

  it("el archivo se CONSERVA al elegir uno de los doce", () => {
    // Es su ícono, no un valor temporal: probar «Café» un rato no puede
    // obligarlo a subirlo de nuevo.
    expect(selloParaGuardar({ tipo: "sellos", icono: "cafe", url: URL_ICONO })).toEqual({
      icono: "cafe",
      url: URL_ICONO,
    });
    expect(selloParaGuardar({ tipo: "sellos", icono: null, url: URL_ICONO })).toEqual({
      icono: null,
      url: URL_ICONO,
    });
  });

  it("cambiar el tipo de tarjeta se lleva el ícono Y su archivo", () => {
    // En una gift card no hay círculos donde dibujar nada, y un dato
    // colgado es basura que algún día alguien pinta.
    for (const tipo of ["cupon", "giftcard", "evento", "puntos"]) {
      expect(selloParaGuardar({ tipo, icono: SELLO_PROPIO, url: URL_ICONO })).toEqual({
        icono: null,
        url: null,
      });
      expect(selloDelPase({ tipo, icono: SELLO_PROPIO, url: URL_ICONO })).toEqual({
        clase: "logo",
      });
    }
  });

  it("guardar 'propio' sin archivo no deja un estado a medias", () => {
    expect(selloParaGuardar({ tipo: "sellos", icono: SELLO_PROPIO, url: "" })).toEqual({
      icono: null,
      url: null,
    });
  });
});
