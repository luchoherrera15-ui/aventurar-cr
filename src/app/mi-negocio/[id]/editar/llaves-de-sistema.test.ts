import { describe, expect, it } from "vitest";
import { LLAVES_DE_SISTEMA, llavesDeSistemaDe } from "./llaves-de-sistema";

/**
 * Estas pruebas cuidan un caso de PÉRDIDA SILENCIOSA de datos: guardar
 * «Mi perfil» borraba el horario semanal de un negocio de citas.
 *
 * Por eso las dos primeras no son simetría bonita: una prueba que se
 * preserve lo que no se ve, y la otra que NO se preserve lo que sí se
 * ve. Arreglar la primera fusionando todo rompe la segunda, y ese es
 * exactamente el error que hay que dejar imposible.
 */

describe("llavesDeSistemaDe", () => {
  it("conserva el horario semanal, que el formulario nunca dibuja", () => {
    const guardado = llavesDeSistemaDe({
      horario_citas: { 1: { abre: "09:00", cierra: "18:00" } },
      pantalla_gigante: true,
    });
    expect(guardado.horario_citas).toEqual({ 1: { abre: "09:00", cierra: "18:00" } });
  });

  it("NO conserva los campos del formulario: sin eso no se puede desmarcar una casilla", () => {
    // `sanitizarDetalles` omite los booleanos en false, así que si esto
    // sobreviviera, una casilla marcada una vez quedaría marcada para
    // siempre.
    const guardado = llavesDeSistemaDe({ pantalla_gigante: true, sonido: true });
    expect(guardado).toEqual({});
  });

  it("conserva la pausa: un negocio despublicado no se re-publica al guardar el perfil", () => {
    expect(llavesDeSistemaDe({ en_configuracion: true })).toEqual({
      en_configuracion: true,
    });
  });

  it("conserva un false explícito, que no es lo mismo que ausente", () => {
    // Se filtra por `undefined`, no por falsy: `en_configuracion: false`
    // es una decisión guardada y tiene que sobrevivir igual.
    expect(llavesDeSistemaDe({ en_configuracion: false })).toEqual({
      en_configuracion: false,
    });
  });

  it("aguanta cualquier cosa que venga del jsonb", () => {
    // La columna es jsonb: nadie garantiza que sea un objeto.
    for (const basura of [null, undefined, 42, "texto", [], [1, 2]]) {
      expect(llavesDeSistemaDe(basura)).toEqual({});
    }
  });

  it("no inventa llaves que no estaban", () => {
    const guardado = llavesDeSistemaDe({ horario_citas: { 1: null } });
    expect(Object.keys(guardado)).toEqual(["horario_citas"]);
    expect("en_configuracion" in guardado).toBe(false);
  });

  it("las tres llaves de la lista se preservan juntas", () => {
    const todo = {
      horario_citas: { 2: { abre: "08:00", cierra: "17:00" } },
      en_configuracion: true,
      horario_restaurante: { 3: { abre: "07:00", cierra: "22:00" } },
      capacidad: 120,
    };
    const guardado = llavesDeSistemaDe(todo);
    expect(Object.keys(guardado).sort()).toEqual([...LLAVES_DE_SISTEMA].sort());
  });
});
