import { describe, expect, it } from "vitest";
import { PLANTILLAS_FRANJA, srcDeFranja } from "./plantillas-franjas";

describe("srcDeFranja", () => {
  it("sin variante da la misma URL que la galería del editor", () => {
    for (const f of PLANTILLAS_FRANJA) expect(srcDeFranja(f.id)).toBe(f.src);
  });

  it("con `gallery` pide la misma foto en la variante grande", () => {
    const publica = srcDeFranja("lavacar-4");
    expect(publica).toMatch(/\/lealtad\/franjas\/lavacar-4\/public$/);
    expect(srcDeFranja("lavacar-4", "gallery")).toBe(publica.replace(/\/public$/, "/gallery"));
  });

  it("truena con una foto que no está en el banco", () => {
    // `cafe-1` salió del banco: mostraba el local real de otro negocio.
    expect(() => srcDeFranja("cafe-1")).toThrow(/no está en el banco/);
  });
});
