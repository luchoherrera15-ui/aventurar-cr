import { describe, expect, it } from "vitest";
import { debeRefrescar, estadoDelToken, venceEnDesde } from "./tokens";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.UTC(2026, 8, 7, 12, 0, 0);

describe("estadoDelToken", () => {
  it("vigente lejos del vencimiento, por vencer a 10 días o menos, vencido al pasar", () => {
    expect(estadoDelToken(AHORA + 30 * DIA, AHORA)).toBe("vigente");
    expect(estadoDelToken(AHORA + 10 * DIA, AHORA)).toBe("por_vencer");
    expect(estadoDelToken(AHORA + 1, AHORA)).toBe("por_vencer");
    expect(estadoDelToken(AHORA, AHORA)).toBe("vencido");
    expect(estadoDelToken(AHORA - DIA, AHORA)).toBe("vencido");
  });
  it("una fecha ilegible cuenta como vencida (nunca se confía en ella)", () => {
    expect(estadoDelToken("no es fecha", AHORA)).toBe("vencido");
  });
});

describe("debeRefrescar (la condición de Meta: por vencer, no vencido, ≥24 h)", () => {
  const base = { venceEn: AHORA + 5 * DIA, refrescadoEn: null, conectadaEn: AHORA - 40 * DIA };
  it("sí: por vencer y hace más de 24 h de la conexión", () => {
    expect(debeRefrescar(base, AHORA)).toBe(true);
  });
  it("no: todavía vigente", () => {
    expect(debeRefrescar({ ...base, venceEn: AHORA + 40 * DIA }, AHORA)).toBe(false);
  });
  it("no: ya venció (no se puede refrescar, hay que reconectar)", () => {
    expect(debeRefrescar({ ...base, venceEn: AHORA - 1 }, AHORA)).toBe(false);
  });
  it("no: se refrescó hace menos de 24 h", () => {
    expect(debeRefrescar({ ...base, refrescadoEn: AHORA - 2 * 60 * 60 * 1000 }, AHORA)).toBe(false);
    expect(debeRefrescar({ ...base, refrescadoEn: AHORA - 25 * 60 * 60 * 1000 }, AHORA)).toBe(true);
  });
});

describe("venceEnDesde", () => {
  it("suma los segundos de Meta; sin dato, 60 días", () => {
    expect(venceEnDesde(3600, AHORA)).toBe(new Date(AHORA + 3600 * 1000).toISOString());
    expect(venceEnDesde(Number.NaN, AHORA)).toBe(new Date(AHORA + 60 * DIA).toISOString());
  });
});
