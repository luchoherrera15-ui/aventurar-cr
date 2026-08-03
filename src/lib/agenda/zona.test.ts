import { describe, expect, it } from "vitest";
import { instanteEnZona } from "./disponibilidad";
import { utcDesdeZona } from "./zona";

describe("utcDesdeZona", () => {
  it("convierte una hora de pared de Costa Rica a UTC (+6 fijo)", () => {
    const d = utcDesdeZona("2026-08-03", "13:00", "America/Costa_Rica");
    expect(d.toISOString()).toBe("2026-08-03T19:00:00.000Z");
  });

  it("cruza la medianoche UTC sin cambiar el día de pared", () => {
    // Las 8 p. m. en CR ya son las 2 a. m. del día siguiente en UTC.
    const d = utcDesdeZona("2026-08-03", "20:00", "America/Costa_Rica");
    expect(d.toISOString()).toBe("2026-08-04T02:00:00.000Z");
  });

  it("es la inversa exacta de instanteEnZona", () => {
    const zona = "America/Costa_Rica";
    const d = utcDesdeZona("2026-12-24", "09:30", zona);
    expect(instanteEnZona(d.toISOString(), zona)).toEqual({
      fecha: "2026-12-24",
      minutos: 9 * 60 + 30,
    });
  });

  it("respeta zonas con offset positivo", () => {
    // Madrid en agosto es UTC+2.
    const d = utcDesdeZona("2026-08-03", "01:00", "Europe/Madrid");
    expect(d.toISOString()).toBe("2026-08-02T23:00:00.000Z");
  });
});
