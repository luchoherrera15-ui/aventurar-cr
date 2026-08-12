import { describe, expect, it } from "vitest";
import {
  estadoVigente,
  etiquetaSaldo,
  finDeVigencia,
  puedeConsumir,
  saldoMembresia,
  sumarDias,
  type ConsumoMembresia,
  type Membresia,
  type PlanMembresia,
} from "./membresias";

const HOY = "2026-08-11";

function plan(extra: Partial<PlanMembresia> = {}): PlanMembresia {
  return {
    id: "p1",
    nombre: "Premium",
    precio: 30000,
    periodo: "mensual",
    sesiones_incluidas: 12,
    vigencia_dias: null,
    activo: true,
    ...extra,
  };
}

function membresia(extra: Partial<Membresia> = {}): Membresia {
  return {
    id: "m1",
    estado: "activa",
    inicio: "2026-08-01",
    fin: "2026-08-31",
    sesiones_totales: 12,
    ...extra,
  };
}

const usos = (n: number): ConsumoMembresia[] =>
  Array.from({ length: n }, () => ({ membresia_id: "m1", cantidad: 1 }));

describe("sumarDias", () => {
  it("cruza fin de mes y fin de año sin corrimientos", () => {
    expect(sumarDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("acierta el año bisiesto", () => {
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("finDeVigencia", () => {
  it("un plan mensual vence a los 30 días", () => {
    expect(finDeVigencia(plan(), "2026-08-01")).toBe("2026-08-31");
  });

  it("un bono de pago único no vence si no le ponen días", () => {
    expect(finDeVigencia(plan({ periodo: "unico" }), "2026-08-01")).toBeNull();
  });

  it("vigencia_dias manda sobre el período", () => {
    expect(finDeVigencia(plan({ periodo: "unico", vigencia_dias: 90 }), "2026-08-01")).toBe(
      "2026-10-30",
    );
    expect(finDeVigencia(plan({ periodo: "anual", vigencia_dias: 7 }), "2026-08-01")).toBe(
      "2026-08-08",
    );
  });
});

describe("saldoMembresia", () => {
  it("resta los consumos", () => {
    const s = saldoMembresia(membresia(), usos(5));
    expect(s).toMatchObject({ totales: 12, usadas: 5, restantes: 7, ilimitada: false });
  });

  it("una devolución (cantidad negativa) suma de vuelta", () => {
    const consumos = [...usos(5), { membresia_id: "m1", cantidad: -1 }];
    expect(saldoMembresia(membresia(), consumos).restantes).toBe(8);
  });

  it("ignora los movimientos de otras membresías", () => {
    const consumos = [...usos(3), { membresia_id: "OTRA", cantidad: 9 }];
    expect(saldoMembresia(membresia(), consumos).restantes).toBe(9);
  });

  it("la ilimitada no tiene restantes, pero sí cuenta los usos", () => {
    const s = saldoMembresia(membresia({ sesiones_totales: null }), usos(40));
    expect(s).toMatchObject({ totales: null, usadas: 40, restantes: null, ilimitada: true });
  });

  it("marcar de más no produce un saldo negativo", () => {
    expect(saldoMembresia(membresia(), usos(30)).restantes).toBe(0);
  });
});

describe("estadoVigente", () => {
  it("una activa cuyo fin ya pasó se lee como vencida", () => {
    expect(estadoVigente(membresia({ fin: "2026-08-10" }), HOY)).toBe("vencida");
  });

  it("el último día todavía es válido", () => {
    expect(estadoVigente(membresia({ fin: HOY }), HOY)).toBe("activa");
  });

  it("sin fin no vence nunca", () => {
    expect(estadoVigente(membresia({ fin: null }), "2030-01-01")).toBe("activa");
  });

  it("pausada y cancelada mandan sobre la fecha", () => {
    // El negocio va a correr el vencimiento al reactivarla, así que no
    // se la degrada a vencida por detrás.
    expect(estadoVigente(membresia({ estado: "pausada", fin: "2026-01-01" }), HOY)).toBe(
      "pausada",
    );
    expect(estadoVigente(membresia({ estado: "cancelada", fin: "2026-01-01" }), HOY)).toBe(
      "cancelada",
    );
  });
});

describe("puedeConsumir", () => {
  it("deja gastar una membresía activa con saldo", () => {
    expect(puedeConsumir(membresia(), usos(3), HOY)).toEqual({ puede: true });
  });

  it("no deja si se quedó sin sesiones", () => {
    const v = puedeConsumir(membresia(), usos(12), HOY);
    expect(v).toEqual({ puede: false, motivo: "Ya no le quedan sesiones." });
  });

  it("la ilimitada nunca se queda sin saldo", () => {
    expect(puedeConsumir(membresia({ sesiones_totales: null }), usos(500), HOY)).toEqual({
      puede: true,
    });
  });

  it("no deja si venció, y dice cuándo", () => {
    const v = puedeConsumir(membresia({ fin: "2026-08-10" }), [], HOY);
    expect(v).toEqual({ puede: false, motivo: "Esta membresía venció el 2026-08-10." });
  });

  it("no deja si todavía no arrancó", () => {
    const v = puedeConsumir(membresia({ inicio: "2026-09-01", fin: "2026-09-30" }), [], HOY);
    expect(v).toEqual({ puede: false, motivo: "Esta membresía arranca el 2026-09-01." });
  });

  it("no deja si está pausada o cancelada", () => {
    expect(puedeConsumir(membresia({ estado: "pausada" }), [], HOY).puede).toBe(false);
    expect(puedeConsumir(membresia({ estado: "cancelada" }), [], HOY).puede).toBe(false);
  });
});

describe("etiquetaSaldo", () => {
  it("dice lo que el dueño necesita leer de un vistazo", () => {
    expect(etiquetaSaldo(saldoMembresia(membresia(), usos(4)))).toBe("8 de 12 disponibles");
    expect(etiquetaSaldo(saldoMembresia(membresia({ sesiones_totales: null }), []))).toBe(
      "Ilimitada",
    );
  });
});
