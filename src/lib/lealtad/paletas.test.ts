import { describe, expect, it } from "vitest";
import {
  PALETAS,
  PALETAS_LISTA,
  coloresDePaleta,
  paletaDeLosColores,
} from "./paletas";
import { TIPOS_TARJETA_ID } from "./tipos-tarjeta";
import { FICHAS } from "@/app/lealtad/contenido-tipos";
import { contraste } from "@/lib/invitaciones/paleta";

/**
 * LA MISMA FUENTE, O NO SIRVE DE NADA.
 *
 * Todo esto existe por un reclamo concreto: el dueño veía ocho tarjetas
 * diseñadas en la página y al crear la suya le ofrecían dos ruedas de
 * color arrancando en el navy de Bookea. La solución no es «poner los
 * mismos colores en el creador» —eso es una copia, y las copias se
 * separan sin que nadie se entere— sino que los dos lean de un solo
 * lugar.
 *
 * Este archivo es el que se pone rojo si alguien vuelve a escribir un
 * hexadecimal a mano en la landing.
 */

describe("las paletas de la landing y las del creador", () => {
  it("son EL MISMO objeto, no dos listas parecidas", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      // Identidad, no igualdad: con `toEqual` alcanzaría con que alguien
      // copiara los hexadecimales de nuevo y el test seguiría verde.
      expect(FICHAS[tipo].colores).toBe(PALETAS[tipo].colores);
    }
  });

  it("hay una por cada tipo de tarjeta, y en el orden del catálogo", () => {
    expect(PALETAS_LISTA.map((p) => p.id)).toEqual([...TIPOS_TARJETA_ID]);
  });

  it("cada paleta tiene tres colores en #RRGGBB", () => {
    for (const p of PALETAS_LISTA) {
      expect(p.colores).toHaveLength(3);
      for (const c of p.colores) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("cada una tiene su nombre, y ninguno se repite", () => {
    const nombres = PALETAS_LISTA.map((p) => p.nombre);
    expect(nombres.every((n) => n.trim().length > 0)).toBe(true);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe("de tres colores a los dos que guarda la tarjeta", () => {
  it("el fondo es el primero y el acento el TERCERO", () => {
    for (const p of PALETAS_LISTA) {
      expect(coloresDePaleta(p)).toEqual({ fondo: p.colores[0], sello: p.colores[2] });
    }
  });

  it("el texto blanco del pase se lee sobre los ocho fondos", () => {
    // Apple pinta el texto de blanco fijo. Un fondo claro no es una
    // tarjeta fea: es una tarjeta que no se lee. 4.5 = WCAG AA.
    for (const p of PALETAS_LISTA) {
      expect(contraste(p.colores[0], "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("el acento se despega del fondo — si no, no se ve cuántos sellos faltan", () => {
    // El mismo 2.2 que usa el editor del diseño para avisar: los sellos
    // son formas macizas, no texto.
    for (const p of PALETAS_LISTA) {
      const { fondo, sello } = coloresDePaleta(p);
      expect(contraste(sello, fondo)).toBeGreaterThanOrEqual(2.2);
    }
  });

  it("el acento contrasta MÁS que el tono del medio", () => {
    // Es la razón de que el mapeo use `colores[2]` y no `colores[1]`.
    for (const p of PALETAS_LISTA) {
      expect(contraste(p.colores[2], p.colores[0])).toBeGreaterThan(
        contraste(p.colores[1], p.colores[0]),
      );
    }
  });
});

describe("qué plantilla está marcada", () => {
  it("se reconoce por los dos colores, sin importar mayúsculas", () => {
    for (const p of PALETAS_LISTA) {
      const { fondo, sello } = coloresDePaleta(p);
      expect(paletaDeLosColores(fondo, sello)?.id).toBe(p.id);
      expect(paletaDeLosColores(fondo.toUpperCase(), sello.toUpperCase())?.id).toBe(p.id);
    }
  });

  it("afinar un color deja de marcar la plantilla, y no rompe nada", () => {
    const { fondo, sello } = coloresDePaleta(PALETAS.sellos);
    expect(paletaDeLosColores(fondo, "#ff6a00")).toBeNull();
    expect(paletaDeLosColores("#062653", sello)).toBeNull();
    expect(paletaDeLosColores("", "")).toBeNull();
  });
});
