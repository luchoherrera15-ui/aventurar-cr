import { describe, expect, it } from "vitest";
import {
  avisosOcultosDe,
  conAvisoCerrado,
  escribirAvisosOcultos,
  leerAvisosOcultos,
  sinAvisosCerrados,
} from "./avisos-ocultos";

const NEG = "11111111-2222-3333-4444-555555555555";
const OTRO = "99999999-8888-7777-6666-555555555555";

describe("leerAvisosOcultos", () => {
  it("sin cookie, no hay nada cerrado", () => {
    expect(leerAvisosOcultos(null)).toEqual([]);
    expect(leerAvisosOcultos("")).toEqual([]);
  });

  it("lee los pares que escribió el navegador", () => {
    const valor = escribirAvisosOcultos([
      { negocio: NEG, aviso: "pasos" },
      { negocio: OTRO, aviso: "puesta-sin-meta" },
    ]);
    expect(leerAvisosOcultos(valor)).toEqual([
      { negocio: NEG, aviso: "pasos" },
      { negocio: OTRO, aviso: "puesta-sin-meta" },
    ]);
  });

  it("tira la basura en vez de inventar claves", () => {
    // Una cookie se edita a mano: un registro sin separador, uno con
    // dos, y uno con caracteres que ninguna clave nuestra usa.
    expect(leerAvisosOcultos("suelto!a.b.c!ne go.cio!!")).toEqual([]);
  });

  it("no repite el mismo par dos veces", () => {
    expect(leerAvisosOcultos(`${NEG}.pasos!${NEG}.pasos`)).toHaveLength(1);
  });
});

describe("cerrar y reabrir", () => {
  it("cerrar dos veces el mismo aviso no lo duplica", () => {
    const una = conAvisoCerrado("", NEG, "pasos");
    expect(conAvisoCerrado(una, NEG, "pasos")).toBe(una);
  });

  it("el aviso cerrado solo aplica a SU negocio", () => {
    const cookie = conAvisoCerrado("", NEG, "pasos");
    expect(avisosOcultosDe(cookie, NEG)).toEqual(["pasos"]);
    expect(avisosOcultosDe(cookie, OTRO)).toEqual([]);
  });

  it("reabrir devuelve todos los del negocio y respeta a los demás", () => {
    let cookie = conAvisoCerrado("", NEG, "pasos");
    cookie = conAvisoCerrado(cookie, NEG, "puesta-sin-clientes");
    cookie = conAvisoCerrado(cookie, OTRO, "pasos");

    const reabierta = sinAvisosCerrados(cookie, NEG);
    expect(avisosOcultosDe(reabierta, NEG)).toEqual([]);
    expect(avisosOcultosDe(reabierta, OTRO)).toEqual(["pasos"]);
  });
});

describe("escribirAvisosOcultos", () => {
  it("poda para que la cookie no crezca sin techo", () => {
    // Viaja en cada request del dominio: lo que se guarda tiene tope.
    const muchos = Array.from({ length: 200 }, (_, i) => ({
      negocio: `n${i}`,
      aviso: "pasos",
    }));
    const guardados = leerAvisosOcultos(escribirAvisosOcultos(muchos));
    expect(guardados).toHaveLength(60);
    // Se conservan los ÚLTIMOS: lo que se acaba de cerrar es lo que
    // importa que siga cerrado.
    expect(guardados[guardados.length - 1]).toEqual({ negocio: "n199", aviso: "pasos" });
  });
});
