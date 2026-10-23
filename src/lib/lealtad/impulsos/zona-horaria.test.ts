import { describe, expect, it } from "vitest";
import {
  diaDeLaSemana,
  diasEntreFechas,
  instanteLocal,
  partesLocales,
  sumarDias,
  zonaValida,
} from "./zona-horaria";

const CR = "America/Costa_Rica";
const NY = "America/New_York";
const iso = (d: Date) => d.toISOString();

describe("zonaValida", () => {
  it("acepta zonas reales y rechaza lo demás", () => {
    expect(zonaValida(CR)).toBe(true);
    expect(zonaValida("Europe/Madrid")).toBe(true);
    expect(zonaValida("Marte/Olympus")).toBe(false);
    expect(zonaValida("")).toBe(false);
    expect(zonaValida(null)).toBe(false);
  });
});

describe("partesLocales", () => {
  it("lee el reloj de la zona, no el del servidor", () => {
    // 03:30 UTC del 21 = 21:30 del 20 en Costa Rica (UTC−6, sin horario de verano).
    const p = partesLocales(new Date("2026-10-21T03:30:00Z"), CR);
    expect(p.fecha).toBe("2026-10-20");
    expect(p.minutos).toBe(21 * 60 + 30);
    expect(p.diaSemana).toBe(2); // martes
  });

  it("medianoche local es el minuto 0 (no el 1440)", () => {
    const p = partesLocales(new Date("2026-10-21T06:00:00Z"), CR);
    expect(p.fecha).toBe("2026-10-21");
    expect(p.minutos).toBe(0);
    expect(p.diaSemana).toBe(3); // miércoles
  });

  it("respeta el horario de verano: la misma hora UTC marca distinto antes y después", () => {
    expect(partesLocales(new Date("2026-03-08T06:59:00Z"), NY).minutos).toBe(1 * 60 + 59); // 01:59 EST
    expect(partesLocales(new Date("2026-03-08T07:00:00Z"), NY).minutos).toBe(3 * 60); // 03:00 EDT
  });
});

describe("instanteLocal", () => {
  it("Costa Rica: las 9:00 son las 15:00 UTC", () => {
    expect(iso(instanteLocal("2026-10-21", 9 * 60, CR))).toBe("2026-10-21T15:00:00.000Z");
  });

  it("ida y vuelta: lo que se arma se lee igual", () => {
    const t = instanteLocal("2026-10-21", 17 * 60 + 45, CR);
    const p = partesLocales(t, CR);
    expect(p.fecha).toBe("2026-10-21");
    expect(p.minutos).toBe(17 * 60 + 45);
  });

  it("las 9:00 de Nueva York son las 9:00 con y sin horario de verano", () => {
    expect(iso(instanteLocal("2026-03-07", 540, NY))).toBe("2026-03-07T14:00:00.000Z"); // EST
    expect(iso(instanteLocal("2026-03-09", 540, NY))).toBe("2026-03-09T13:00:00.000Z"); // EDT
  });

  it("una hora que no existe (el reloj salta de 2:00 a 3:00) se corre hacia adelante", () => {
    expect(iso(instanteLocal("2026-03-08", 2 * 60 + 30, NY))).toBe("2026-03-08T07:30:00.000Z"); // 03:30 EDT
    expect(iso(instanteLocal("2026-03-08", 3 * 60, NY))).toBe("2026-03-08T07:00:00.000Z");
    expect(iso(instanteLocal("2026-03-08", 60, NY))).toBe("2026-03-08T06:00:00.000Z");
  });

  it("una hora que existe dos veces (el reloj retrocede) toma la primera", () => {
    expect(iso(instanteLocal("2026-11-01", 90, NY))).toBe("2026-11-01T05:30:00.000Z"); // 01:30 EDT
    expect(iso(instanteLocal("2026-11-01", 150, NY))).toBe("2026-11-01T07:30:00.000Z"); // 02:30 EST
  });
});

describe("fechas", () => {
  it("sumarDias cruza meses y años sin zona horaria", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29"); // bisiesto
  });

  it("diaDeLaSemana", () => {
    expect(diaDeLaSemana("2026-10-21")).toBe(3);
    expect(diaDeLaSemana("2026-10-25")).toBe(0);
  });

  it("diasEntreFechas", () => {
    expect(diasEntreFechas("2026-10-01", "2026-10-31")).toBe(30);
    expect(diasEntreFechas("2026-12-31", "2027-01-01")).toBe(1);
    expect(diasEntreFechas("2026-10-21", "2026-10-21")).toBe(0);
  });
});
