import { describe, expect, it } from "vitest";
import { esCoherente, estadoAlCrear } from "./estado-inicial";

/**
 * El bug que estas pruebas existen para que no vuelva: el asistente
 * decía «quedó publicada» y guardaba un borrador. Nadie se enteraba
 * hasta que la tarjeta no emitía ningún pase.
 */

describe("con qué estado nace una tarjeta", () => {
  it("nace PUBLICADA: es lo que el botón «Publicar tarjeta» promete", () => {
    expect(estadoAlCrear()).toEqual({ activo: true, estado: "activo" });
  });

  it("no nace en borrador — ese era el bug, no una preferencia", () => {
    // Si alguien vuelve a poner "borrador" acá, que sea después de leer
    // el comentario del módulo y de cambiar los cuatro textos del
    // asistente que prometen publicar.
    expect(estadoAlCrear().estado).not.toBe("borrador");
    expect(estadoAlCrear().activo).toBe(true);
  });

  it("las dos columnas dicen lo mismo", () => {
    // `activo` (0060) y `estado` (0125) describen la misma cosa. El
    // motor de canje mira las dos.
    expect(esCoherente(estadoAlCrear())).toBe(true);
  });
});

describe("esCoherente", () => {
  it("detecta el par que enciende la interfaz y apaga el motor", () => {
    // Este es el par traicionero: el panel lo pinta activo y ningún
    // canje procede.
    expect(esCoherente({ activo: false, estado: "activo" })).toBe(false);
  });

  it("detecta el par al revés", () => {
    expect(esCoherente({ activo: true, estado: "borrador" })).toBe(false);
    expect(esCoherente({ activo: true, estado: "pausado" })).toBe(false);
  });

  it("acepta los estados apagados bien apagados", () => {
    for (const estado of ["borrador", "pausado", "archivado"]) {
      expect(esCoherente({ activo: false, estado })).toBe(true);
    }
  });
});
