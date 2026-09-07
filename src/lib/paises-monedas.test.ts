import { describe, expect, it } from "vitest";
import { PAISES, paisDePrefijoUno } from "./paises";
import { PAIS, PAISES as CODIGOS_SOLUTIONS, MONEDA } from "./monedas";

/**
 * DOS CATÁLOGOS, UNA VERDAD.
 *
 * `src/lib/paises.ts` es el catálogo del marketplace (regiones, zonas,
 * códigos en minúscula para la URL) y `src/lib/monedas.ts` el de
 * Solutions (monedas con decimales, largos de teléfono, códigos en
 * mayúscula). Nacieron separados por razones reales, pero tienen que
 * decir lo MISMO sobre cada país: si uno gana un país y el otro no, el
 * selector de un producto lo muestra y el del otro no — que es
 * exactamente lo que el dueño vio el 6 sep 2026 con ocho países en el
 * alta de Lealtad.
 */
describe("paises.ts y monedas.ts coinciden", () => {
  it("tienen exactamente los mismos países", () => {
    const marketplace = PAISES.map((p) => p.codigo.toUpperCase()).sort();
    const solutions = [...CODIGOS_SOLUTIONS].sort();
    expect(marketplace).toEqual(solutions);
  });

  it("el prefijo telefónico, la moneda y su símbolo son los mismos en los dos", () => {
    for (const p of PAISES) {
      const s = PAIS[p.codigo.toUpperCase() as keyof typeof PAIS];
      expect(s, p.codigo).toBeDefined();
      expect(p.prefijoTelefono, p.codigo).toBe(`+${s.telefono}`);
      expect(p.moneda.codigo, p.codigo).toBe(s.moneda);
      expect(p.moneda.simbolo, p.codigo).toBe(MONEDA[s.moneda].simbolo);
      expect(p.nombre, p.codigo).toBe(s.nombre);
    }
  });

  it("los veintiún países están, de México a Chile", () => {
    expect(PAISES.length).toBe(21);
    for (const p of PAISES) expect(p.regiones.length, p.codigo).toBeGreaterThan(0);
  });

  it("el +1 se reparte entre Puerto Rico y República Dominicana por código de área", () => {
    expect(paisDePrefijoUno("787 555 0100")).toBe("pr");
    expect(paisDePrefijoUno("939-555-0100")).toBe("pr");
    expect(paisDePrefijoUno("809 555 0100")).toBe("do");
    expect(paisDePrefijoUno("")).toBe("do");
  });
});
