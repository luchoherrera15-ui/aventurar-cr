import { describe, expect, it } from "vitest";
import {
  ICONOS_SELLO,
  ICONOS_SELLO_ID,
  ICONOS_SELLO_LISTA,
  esIconoSello,
  iconoDelSello,
  logoDentroDelSello,
} from "./iconos-sello";
import { escalonesDeLaTira } from "@/lib/wallet/escalones-tira";

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
    const hayLogo = logoDentroDelSello({ hayLogo: true, icono: null });
    expect(hayLogo).toBe(true);
    expect(escalonesDeLaTira({ hayBanda: true, hayLogo })).toEqual([
      { banda: true, logo: true },
      { banda: false, logo: true },
      { banda: false, logo: false },
    ]);
  });

  it("con icono, el logo sale del sello y el escalón repetido no se ofrece", () => {
    const hayLogo = logoDentroDelSello({ hayLogo: true, icono: "cafe" });
    expect(hayLogo).toBe(false);
    expect(escalonesDeLaTira({ hayBanda: true, hayLogo })).toEqual([
      { banda: true, logo: false },
      { banda: false, logo: false },
    ]);
  });

  it("sin logo cargado da lo mismo el icono: siempre hubo un solo intento", () => {
    for (const icono of [null, "cafe" as const]) {
      const hayLogo = logoDentroDelSello({ hayLogo: false, icono });
      expect(escalonesDeLaTira({ hayBanda: false, hayLogo })).toEqual([
        { banda: false, logo: false },
      ]);
    }
  });
});
