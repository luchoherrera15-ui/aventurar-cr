import { describe, expect, it } from "vitest";
import { ahorroPack, PACKS_INVITACIONES, sueltoPack } from "./paquetes-invitaciones";

describe("ahorroPack — sin coma flotante en la pantalla", () => {
  it("redondea a centavos", () => {
    // Con la Premium en promo ($19.99) la resta cruda daba
    // 23.999999999999996, y así se llegó a leer en la landing.
    for (const p of PACKS_INVITACIONES) {
      const ahorro = ahorroPack(p);
      expect(Math.round(ahorro * 100) / 100).toBe(ahorro);
      expect(String(ahorro).length).toBeLessThanOrEqual(6);
    }
  });

  it("es lo suelto menos el pack", () => {
    for (const p of PACKS_INVITACIONES) {
      expect(ahorroPack(p)).toBeCloseTo(sueltoPack(p) - p.precioUSD, 2);
    }
  });
});
