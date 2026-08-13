import { describe, expect, it } from "vitest";
import {
  autorizarCanje,
  dentroDelHorario,
  diaDeLaSemana,
  llaveDeCanje,
  type ContextoCanje,
  type ReglasPrograma,
} from "./canje";

/**
 * Cada caso de acá es un rechazo que, sin esta función, pasaría en un
 * mostrador de verdad: un cupón vencido canjeado desde una captura de
 * pantalla, una promo de lunes a jueves usada un sábado, un doble
 * toque que descuenta dos veces.
 */

// 2026-08-13 es JUEVES.
const JUEVES_14H = "2026-08-13T14:30";

function programa(extra: Partial<ReglasPrograma> = {}): ReglasPrograma {
  return { estado: "activo", activo: true, ...extra };
}

function ctx(extra: Partial<ContextoCanje> = {}): ContextoCanje {
  return {
    programa: programa(),
    saldo: 10,
    costo: 10,
    canjesDelCliente: 0,
    canjesTotales: 0,
    ahoraCR: JUEVES_14H,
    ...extra,
  };
}

describe("diaDeLaSemana", () => {
  it("da el día que dice el texto, sin correrse por zona horaria", () => {
    // `new Date("2026-08-13")` es medianoche UTC = el 12 a las 6 p.m.
    // en Costa Rica, y el jueves pasaría por miércoles.
    expect(diaDeLaSemana("2026-08-13")).toBe(4); // jueves
    expect(diaDeLaSemana("2026-08-16")).toBe(0); // domingo
    expect(diaDeLaSemana("2026-08-17")).toBe(1); // lunes
  });

  it("ignora la hora si viene pegada", () => {
    expect(diaDeLaSemana("2026-08-13T23:59")).toBe(4);
    expect(diaDeLaSemana("2026-08-13T00:00")).toBe(4);
  });
});

describe("dentroDelHorario", () => {
  it("sin ventana, siempre", () => {
    expect(dentroDelHorario("03:00", null, null)).toBe(true);
  });

  it("ventana normal", () => {
    expect(dentroDelHorario("11:00", "10:00", "22:00")).toBe(true);
    expect(dentroDelHorario("09:59", "10:00", "22:00")).toBe(false);
    expect(dentroDelHorario("22:01", "10:00", "22:00")).toBe(false);
  });

  it("incluye los bordes", () => {
    expect(dentroDelHorario("10:00", "10:00", "22:00")).toBe(true);
    expect(dentroDelHorario("22:00", "10:00", "22:00")).toBe(true);
  });

  it("ventana que cruza la medianoche — la de cualquier bar", () => {
    // Sin este caso, «de 10 de la noche a 2 de la mañana» no dejaría
    // canjear nunca: ninguna hora es a la vez mayor que 22:00 y menor
    // que 02:00.
    expect(dentroDelHorario("23:30", "22:00", "02:00")).toBe(true);
    expect(dentroDelHorario("01:00", "22:00", "02:00")).toBe(true);
    expect(dentroDelHorario("15:00", "22:00", "02:00")).toBe(false);
  });
});

describe("autorizarCanje · lo que pasa bien", () => {
  it("con saldo, en fecha y sin restricciones, procede", () => {
    expect(autorizarCanje(ctx())).toEqual({ ok: true });
  });

  it("saldo justo alcanza", () => {
    expect(autorizarCanje(ctx({ saldo: 10, costo: 10 })).ok).toBe(true);
  });
});

describe("autorizarCanje · el estado de la tarjeta", () => {
  it("una tarjeta VENCIDA no se canjea, ni desde una captura", () => {
    const v = autorizarCanje(ctx({ programa: programa({ vigente_hasta: "2026-08-01" }) }));
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.codigo).toBe("fuera_de_vigencia");
      expect(v.motivo).toContain("2026-08-01");
    }
  });

  it("una tarjeta que todavía no empieza tampoco", () => {
    const v = autorizarCanje(ctx({ programa: programa({ vigente_desde: "2026-09-01" }) }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.codigo).toBe("fuera_de_vigencia");
  });

  it("pausada, borrador y archivada se rechazan con su propio código", () => {
    for (const estado of ["pausado", "borrador", "archivado"]) {
      const v = autorizarCanje(ctx({ programa: programa({ estado, activo: false }) }));
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.codigo).toBe("programa_no_opera");
    }
  });
});

describe("autorizarCanje · el caso obligatorio del documento", () => {
  // «30% de descuento de lunes a jueves.»
  const lunesAJueves = programa({ dias_permitidos: [1, 2, 3, 4] });

  it("un jueves procede", () => {
    expect(autorizarCanje(ctx({ programa: lunesAJueves, ahoraCR: JUEVES_14H })).ok).toBe(true);
  });

  it("un sábado se rechaza, y se dice qué días vale", () => {
    const v = autorizarCanje(ctx({ programa: lunesAJueves, ahoraCR: "2026-08-15T14:30" }));
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.codigo).toBe("dia_no_permitido");
      expect(v.motivo).toContain("lunes");
      expect(v.motivo).toContain("jueves");
    }
  });

  it("fuera del horario se rechaza aunque el día sea correcto", () => {
    const p = programa({ dias_permitidos: [1, 2, 3, 4], hora_desde: "10:00", hora_hasta: "16:00" });
    expect(autorizarCanje(ctx({ programa: p, ahoraCR: "2026-08-13T14:30" })).ok).toBe(true);
    const v = autorizarCanje(ctx({ programa: p, ahoraCR: "2026-08-13T17:30" }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.codigo).toBe("fuera_de_horario");
  });
});

describe("autorizarCanje · los topes", () => {
  it("uso único: el segundo se rechaza", () => {
    const p = programa({ uso_unico: true });
    expect(autorizarCanje(ctx({ programa: p, canjesDelCliente: 0 })).ok).toBe(true);
    const v = autorizarCanje(ctx({ programa: p, canjesDelCliente: 1 }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.codigo).toBe("uso_unico_agotado");
  });

  it("tope por cliente: corta justo en el número, no después", () => {
    const p = programa({ max_por_cliente: 3 });
    expect(autorizarCanje(ctx({ programa: p, canjesDelCliente: 2 })).ok).toBe(true);
    expect(autorizarCanje(ctx({ programa: p, canjesDelCliente: 3 })).ok).toBe(false);
  });

  it("tope global: se agotó para todos", () => {
    const p = programa({ max_global: 100 });
    const v = autorizarCanje(ctx({ programa: p, canjesTotales: 100 }));
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.codigo).toBe("tope_global");
      expect(v.motivo).toContain("agotó");
    }
  });

  it("sin topes declarados, no hay tope", () => {
    const v = autorizarCanje(ctx({ canjesDelCliente: 999, canjesTotales: 99999 }));
    expect(v.ok).toBe(true);
  });
});

describe("autorizarCanje · el saldo va al final", () => {
  it("sin saldo, dice cuánto falta", () => {
    const v = autorizarCanje(ctx({ saldo: 7, costo: 10 }));
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.codigo).toBe("saldo_insuficiente");
      expect(v.motivo).toContain("3");
    }
  });

  it("si además está vencida, se dice ESO y no lo del saldo", () => {
    // Al cliente le sirve más «era hasta el viernes» que «te faltan 3»,
    // porque lo segundo sugiere que volviendo con más sellos alcanza.
    const v = autorizarCanje(
      ctx({ saldo: 0, costo: 10, programa: programa({ vigente_hasta: "2026-08-01" }) }),
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.codigo).toBe("fuera_de_vigencia");
  });
});

describe("llaveDeCanje", () => {
  it("el mismo intento da la misma llave — el doble toque no cuenta dos veces", () => {
    const a = llaveDeCanje({ miembroId: "m1", recompensaId: "r1", ahoraCR: "2026-08-13T14:30:01" });
    const b = llaveDeCanje({ miembroId: "m1", recompensaId: "r1", ahoraCR: "2026-08-13T14:30:59" });
    expect(a).toBe(b);
  });

  it("otro minuto es otro canje: el cliente que pide dos cafés seguidos no queda bloqueado", () => {
    const a = llaveDeCanje({ miembroId: "m1", recompensaId: "r1", ahoraCR: "2026-08-13T14:30" });
    const b = llaveDeCanje({ miembroId: "m1", recompensaId: "r1", ahoraCR: "2026-08-13T14:31" });
    expect(a).not.toBe(b);
  });

  it("distinto cliente o distinta recompensa, distinta llave", () => {
    const base = { miembroId: "m1", recompensaId: "r1", ahoraCR: "2026-08-13T14:30" };
    expect(llaveDeCanje(base)).not.toBe(llaveDeCanje({ ...base, miembroId: "m2" }));
    expect(llaveDeCanje(base)).not.toBe(llaveDeCanje({ ...base, recompensaId: "r2" }));
  });
});
