import { describe, expect, it } from "vitest";
import { minutoISOCR, hoyISOCR, fechaISOCR } from "./fechas";

/**
 * EL MINUTO DE COSTA RICA, que es la mitad de toda llave de
 * idempotencia del mostrador.
 *
 * Esto existe por lo que encontró la auditoría: `llaveDeCanje` tenía 23
 * pruebas y CERO llamadores, mientras el canje real mandaba
 * `canje:${randomUUID()}`. La función pura pasaba en verde con el doble
 * cobro vivo. La lección es que hay que probar el CABLEADO, y el
 * eslabón compartido de ese cableado es este minuto.
 */
describe("minutoISOCR", () => {
  it("da el formato exacto que espera llaveDeCanje", () => {
    const m = minutoISOCR(new Date("2026-08-13T20:30:45Z"));
    expect(m).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(m).toHaveLength(16);
  });

  it("corre a hora de Costa Rica, no a UTC", () => {
    // 20:30 UTC = 14:30 en Costa Rica (UTC-6, sin horario de verano).
    expect(minutoISOCR(new Date("2026-08-13T20:30:45Z"))).toBe("2026-08-13T14:30");
  });

  /**
   * La frontera del día es donde esto se rompía antes: a las 6 p.m. de
   * Costa Rica ya es el día siguiente en UTC. Si un llamador usara UTC
   * y otro CR, las llaves dejarían de coincidir justo en la hora pico
   * de una barbería.
   */
  it("no se adelanta un día después de las 6 p.m. de Costa Rica", () => {
    expect(minutoISOCR(new Date("2026-08-14T02:15:00Z"))).toBe("2026-08-13T20:15");
    expect(minutoISOCR(new Date("2026-08-14T05:59:00Z"))).toBe("2026-08-13T23:59");
    expect(minutoISOCR(new Date("2026-08-14T06:00:00Z"))).toBe("2026-08-14T00:00");
  });

  it("dos instantes del mismo minuto dan la MISMA llave", () => {
    const a = minutoISOCR(new Date("2026-08-13T20:30:01Z"));
    const b = minutoISOCR(new Date("2026-08-13T20:30:59Z"));
    expect(a).toBe(b);
  });

  it("y el minuto siguiente da una distinta", () => {
    const a = minutoISOCR(new Date("2026-08-13T20:30:59Z"));
    const b = minutoISOCR(new Date("2026-08-13T20:31:00Z"));
    expect(a).not.toBe(b);
  });

  it("concuerda con fechaISOCR en la parte de la fecha", () => {
    const t = new Date("2026-08-14T03:00:00Z");
    expect(minutoISOCR(t).slice(0, 10)).toBe(fechaISOCR(t));
  });

  it("sin argumento usa el ahora, y concuerda con hoyISOCR", () => {
    expect(minutoISOCR().slice(0, 10)).toBe(hoyISOCR());
  });
});
