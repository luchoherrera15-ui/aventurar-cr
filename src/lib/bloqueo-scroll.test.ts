import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bloquearScroll } from "./bloqueo-scroll";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA PÁGINA NO SE PUEDE QUEDAR SIN SCROLL
 * ════════════════════════════════════════════════════════════════════
 *
 * El bug que esto evita no tira error, no rompe nada visible y no deja
 * pista: la persona cierra el modal, la página queda quieta y la única
 * salida es recargar. Se descubre por un reporte de «se trabó», que es
 * la peor forma de descubrir algo.
 *
 * ── POR QUÉ UN DOBLE Y NO jsdom ─────────────────────────────────────
 *
 * El proyecto no tiene jsdom ni happy-dom, y no vale la pena sumar una
 * dependencia entera para leer y escribir UNA propiedad. El módulo solo
 * toca `document.body.style.overflow`, así que el doble de abajo es
 * toda la superficie que usa — y deja la prueba enfocada en lo único
 * que puede fallar de verdad: EL CONTADOR.
 *
 * ⚠️ SI UNA DE ESTAS FALLA, EL CONTADOR ESTÁ DESBALANCEADO. Se
 * averigua por qué; no se ajusta la prueba.
 */

const documentoReal = (globalThis as { document?: unknown }).document;

/** Lo mínimo que el módulo toca. */
function montarDocumentoFalso(overflowInicial = "") {
  (globalThis as { document?: unknown }).document = {
    body: { style: { overflow: overflowInicial } },
  };
}

function overflow(): string {
  return (globalThis as unknown as { document: { body: { style: { overflow: string } } } })
    .document.body.style.overflow;
}

beforeEach(() => montarDocumentoFalso());

afterEach(() => {
  // El módulo guarda estado a nivel de módulo (el contador). Si una
  // prueba lo dejara desbalanceado, la SIGUIENTE fallaría por un
  // motivo que no tiene nada que ver con ella. Se comprueba acá para
  // que el error aparezca donde se causó.
  expect(overflow(), "una prueba dejó capas abiertas").toBe("");
  if (documentoReal === undefined) delete (globalThis as { document?: unknown }).document;
  else (globalThis as { document?: unknown }).document = documentoReal;
});

describe("una sola capa", () => {
  it("congela mientras está abierta y suelta al cerrar", () => {
    const soltar = bloquearScroll();
    expect(overflow()).toBe("hidden");
    soltar();
    expect(overflow()).toBe("");
  });
});

describe("dos capas apiladas — el caso que rompía", () => {
  it("la de abajo cerrando primero NO descongela la página", () => {
    // Exactamente lo que pasa en móvil: la hoja del profesional abre,
    // adentro se toca «Ver disponibilidad», el modal abre, y la hoja se
    // desmonta 260 ms después con el modal todavía arriba.
    const soltarHoja = bloquearScroll();
    const soltarModal = bloquearScroll();

    soltarHoja();
    expect(overflow(), "el modal sigue abierto").toBe("hidden");

    soltarModal();
    expect(overflow(), "ya no queda nada abierto").toBe("");
  });

  it("cerrando en orden inverso también termina limpio", () => {
    const a = bloquearScroll();
    const b = bloquearScroll();
    b();
    expect(overflow()).toBe("hidden");
    a();
    expect(overflow()).toBe("");
  });

  it("diez capas se abren y se cierran sin dejar rastro", () => {
    const cierres = Array.from({ length: 10 }, () => bloquearScroll());
    expect(overflow()).toBe("hidden");
    for (const c of cierres.slice(0, 9)) c();
    expect(overflow(), "queda una").toBe("hidden");
    cierres[9]!();
    expect(overflow()).toBe("");
  });
});

describe("el contador no se desbalancea", () => {
  it("soltar dos veces la misma capa cuenta una sola vez", () => {
    // React en modo estricto monta, desmonta y vuelve a montar los
    // efectos. Sin la guarda de «soltada», ese segundo cierre bajaría
    // el contador de una capa que ya no existe y la página se
    // descongelaría con un modal todavía arriba.
    const a = bloquearScroll();
    const b = bloquearScroll();
    a();
    a();
    a();
    expect(overflow(), "b sigue abierta").toBe("hidden");
    b();
    expect(overflow()).toBe("");
  });

  it("después de un ciclo completo, el siguiente arranca sano", () => {
    bloquearScroll()();
    const b = bloquearScroll();
    expect(overflow()).toBe("hidden");
    b();
    expect(overflow()).toBe("");
  });
});

describe("el valor que la página ya tenía", () => {
  it("se devuelve tal cual, no se pisa con vacío", () => {
    montarDocumentoFalso("clip");
    const soltar = bloquearScroll();
    expect(overflow()).toBe("hidden");
    soltar();
    expect(overflow()).toBe("clip");
    // Y se deja en "" para el afterEach, que exige página suelta.
    montarDocumentoFalso("");
  });
});

describe("sin DOM no explota", () => {
  it("en el servidor devuelve una función que no hace nada", () => {
    // Los componentes que lo usan son "use client", pero un import
    // suelto en un módulo compartido puede evaluarse en el servidor.
    // Reventar ahí sería un 500 por un detalle cosmético.
    delete (globalThis as { document?: unknown }).document;
    expect(() => bloquearScroll()()).not.toThrow();
    montarDocumentoFalso("");
  });
});
