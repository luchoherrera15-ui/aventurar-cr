import { describe, expect, it } from "vitest";
import { minutoISOCR, hoyISOCR, fechaISOCR, haceCuanto } from "./fechas";

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

/**
 * `haceCuanto`, usada en "Cliente desde" de /admin/complementos.
 *
 * La auditoría de esa pantalla encontró que la primera versión medía
 * los días con `getFullYear()/getMonth()/getDate()` crudos (hora del
 * RUNTIME, que en Vercel es UTC) en vez de con la hora de Costa Rica —
 * el mismo error que ya rompió `minutoISOCR` una vez, ver el
 * comentario de cabecera de este archivo. Estas pruebas fijan el borde
 * exacto que encontró: dos instantes 26 horas aparte, cruzando la
 * medianoche de Costa Rica, son DOS días de calendario, no uno.
 */
describe("haceCuanto", () => {
  it("null o vacío da null, sin adivinar nada", () => {
    expect(haceCuanto(null)).toBeNull();
  });

  it("una fecha ilegible da null, no una cifra inventada", () => {
    expect(haceCuanto("no es una fecha")).toBeNull();
  });

  it("hoy mismo dice 'hoy', nunca 'hace 0 días'", () => {
    const ahora = new Date("2026-08-18T18:00:00Z");
    expect(haceCuanto("2026-08-18T12:00:00Z", ahora)).toBe("hoy");
  });

  it("un reloj de cliente adelantado (fecha futura) también cae en 'hoy'", () => {
    const ahora = new Date("2026-08-18T12:00:00Z");
    expect(haceCuanto("2026-08-19T12:00:00Z", ahora)).toBe("hoy");
  });

  it("el borde real que encontró la auditoría: 26 horas cruzando la medianoche de CR son 2 días, no 'ayer'", () => {
    // Lunes 23:00 hora CR = martes 05:00 UTC.
    const alta = new Date("2026-08-11T05:00:00Z");
    // 26 horas de RELOJ después: miércoles 01:00 hora CR = miércoles 07:00 UTC.
    // Cruza DOS medianoches de CR (lunes→martes y martes→miércoles) sin
    // llegar a las 48 horas de reloj — el borde exacto que encontró la
    // auditoría: floor(26/24) daría 1 ("ayer"), pero el calendario de CR
    // ya pasó por 2 días distintos.
    const ahora = new Date("2026-08-12T07:00:00Z");
    expect(haceCuanto(alta.toISOString(), ahora)).toBe("hace 2 días");
  });

  it("un día de calendario CR atrás dice 'ayer', aunque sean menos de 24 horas de reloj", () => {
    // 23:50 hora CR de ayer = hoy 05:50 UTC.
    const alta = new Date("2026-08-13T05:50:00Z");
    // 00:10 hora CR de hoy, apenas 20 minutos después en reloj.
    const ahora = new Date("2026-08-13T06:10:00Z");
    expect(haceCuanto(alta.toISOString(), ahora)).toBe("ayer");
  });

  it("escalones de días y semanas, con el singular bien puesto", () => {
    const ahora = new Date("2026-08-18T12:00:00Z");
    expect(haceCuanto("2026-08-15T12:00:00Z", ahora)).toBe("hace 3 días");
    expect(haceCuanto("2026-08-11T12:00:00Z", ahora)).toBe("hace 1 semana");
    expect(haceCuanto("2026-07-28T12:00:00Z", ahora)).toBe("hace 3 semanas");
  });

  it("meses por calendario: del 15 de julio al 18 de agosto es 1 mes", () => {
    const ahora = new Date("2026-08-18T12:00:00Z");
    expect(haceCuanto("2026-07-15T12:00:00Z", ahora)).toBe("hace 1 mes");
  });

  it("un mes exacto dice '1 mes', no '2 meses' por redondeo", () => {
    const ahora = new Date("2026-09-18T12:00:00Z");
    expect(haceCuanto("2026-08-18T12:00:00Z", ahora)).toBe("hace 1 mes");
  });

  it("un año de calendario exacto dice '1 año', nunca '12 meses'", () => {
    const ahora = new Date("2026-08-18T12:00:00Z");
    expect(haceCuanto("2025-08-18T12:00:00Z", ahora)).toBe("hace 1 año");
  });

  it("varios años, en plural", () => {
    const ahora = new Date("2026-08-18T12:00:00Z");
    expect(haceCuanto("2023-08-18T12:00:00Z", ahora)).toBe("hace 3 años");
  });
});
