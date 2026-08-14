import { describe, expect, it } from "vitest";
import {
  avisoDeMeta,
  pideRecompensa,
  puedeCambiarTipo,
  puedeEditarse,
  type SituacionTarjeta,
} from "./editable";
import { TIPOS_TARJETA_ID } from "./tipos-tarjeta";

const base: SituacionTarjeta = { miembros: 0, estado: "activo", tipo: "sellos" };

describe("puedeEditarse", () => {
  it("una tarjeta activa se edita", () => {
    expect(puedeEditarse(base).puede).toBe(true);
  });

  it("una pausada TAMBIÉN se edita — pausar es reversible, no una condena", () => {
    expect(puedeEditarse({ ...base, estado: "pausado" }).puede).toBe(true);
  });

  it("un borrador se edita", () => {
    expect(puedeEditarse({ ...base, estado: "borrador" }).puede).toBe(true);
  });

  it("una archivada NO, y el motivo dice qué hacer en su lugar", () => {
    const v = puedeEditarse({ ...base, estado: "archivado" });
    expect(v.puede).toBe(false);
    if (!v.puede) expect(v.motivo).toContain("creá una nueva");
  });
});

describe("puedeCambiarTipo — el candado que no se puede deshacer", () => {
  it("sin nadie adentro, el tipo se cambia", () => {
    expect(puedeCambiarTipo({ ...base, miembros: 0 }).puede).toBe(true);
  });

  it("con UN solo cliente ya no: su saldo pasaría a significar otra cosa", () => {
    const v = puedeCambiarTipo({ ...base, miembros: 1 });
    expect(v.puede).toBe(false);
    if (!v.puede) {
      expect(v.motivo).toContain("1 cliente");
      expect(v.motivo).toContain("sellos");
      expect(v.motivo).toContain("creá una tarjeta nueva");
    }
  });

  it("el motivo nombra la unidad del tipo que se está mirando", () => {
    const v = puedeCambiarTipo({ miembros: 4, estado: "activo", tipo: "giftcard" });
    expect(v.puede).toBe(false);
    if (!v.puede) expect(v.motivo).toContain("de saldo");
  });

  it("los tipos que no acumulan hablan de «usos», no de un saldo inventado", () => {
    const v = puedeCambiarTipo({ miembros: 2, estado: "activo", tipo: "cupon" });
    expect(v.puede).toBe(false);
    if (!v.puede) expect(v.motivo).toContain("usos");
  });

  it("archivada gana sobre todo lo demás", () => {
    const v = puedeCambiarTipo({ miembros: 0, estado: "archivado", tipo: "sellos" });
    expect(v.puede).toBe(false);
    if (!v.puede) expect(v.motivo).toContain("archivada");
  });

  it("ningún tipo se escapa del candado", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      expect(puedeCambiarTipo({ miembros: 1, estado: "activo", tipo }).puede).toBe(false);
      expect(puedeCambiarTipo({ miembros: 0, estado: "activo", tipo }).puede).toBe(true);
    }
  });
});

describe("avisoDeMeta", () => {
  it("sin clientes no hay nada que avisar", () => {
    expect(avisoDeMeta({ miembros: 0, anterior: 10, nueva: 8, tipo: "sellos" })).toBeNull();
  });

  it("sin cambio tampoco", () => {
    expect(avisoDeMeta({ miembros: 5, anterior: 10, nueva: 10, tipo: "sellos" })).toBeNull();
  });

  it("bajar la meta avisa que alguien se gana la regalía de una", () => {
    const texto = avisoDeMeta({ miembros: 12, anterior: 10, nueva: 8, tipo: "sellos" });
    expect(texto).toContain("bajar");
    expect(texto).toContain("12 clientes");
    expect(texto).toContain("8 sellos");
  });

  it("subir la meta avisa que se la sacás a quien la tenía completa", () => {
    const texto = avisoDeMeta({ miembros: 1, anterior: 8, nueva: 12, tipo: "sellos" });
    expect(texto).toContain("subir");
    expect(texto).toContain("1 cliente");
    expect(texto).toContain("completa");
  });

  it("una meta que no se conoce no inventa un aviso", () => {
    expect(avisoDeMeta({ miembros: 3, anterior: null, nueva: 8, tipo: "sellos" })).toBeNull();
    expect(avisoDeMeta({ miembros: 3, anterior: 8, nueva: null, tipo: "sellos" })).toBeNull();
  });
});

describe("pideRecompensa — quién necesita una para poder activarse", () => {
  it("sellos y puntos sí: el saldo pelado no promete nada", () => {
    expect(pideRecompensa("sellos")).toBe(true);
    expect(pideRecompensa("puntos")).toBe(true);
  });

  it("los otros seis no: el beneficio viaja adentro de la tarjeta", () => {
    for (const tipo of ["cupon", "descuento", "membresia", "giftcard", "evento", "cashback"] as const) {
      expect(pideRecompensa(tipo)).toBe(false);
    }
  });
});
