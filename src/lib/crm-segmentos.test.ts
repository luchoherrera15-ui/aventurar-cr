import { describe, expect, it } from "vitest";
import type { ClienteCRM } from "./crm-citas";
import {
  conteoPorSegmento,
  corteVip,
  esNuevo,
  ritmoDeVisitaDias,
  seEstaEnfriando,
  segmentarCartera,
  segmentoDe,
} from "./crm-segmentos";

/**
 * La segmentación decide a quién le presta atención el negocio, así que
 * cada regla se prueba con el caso que la motivó: el VIP que se enfría
 * no puede seguir saliendo como VIP, y el ocasional no puede salir
 * acusado de «en riesgo» por no tener ritmo conocido.
 */

const HOY = "2026-09-01";

function cliente(parcial: Partial<ClienteCRM>): ClienteCRM {
  return {
    clave: "correo:x@y.com",
    citaIds: [],
    nombre: "Cliente",
    correo: "x@y.com",
    whatsapp: null,
    clienteId: null,
    totalCitas: 1,
    cumplidas: 1,
    noAsistio: 0,
    canceladas: 0,
    primeraVisita: "2026-08-20",
    ultimaVisita: "2026-08-20",
    proximaCita: null,
    gastoTotal: 10_000,
    fallosSeguidos: 0,
    diasSinVenir: 12,
    ...parcial,
  };
}

describe("ritmoDeVisitaDias", () => {
  it("reparte el período entre los intervalos, no entre las visitas", () => {
    // 4 visitas en 30 días = 3 intervalos = cada 10 días.
    const c = cliente({ cumplidas: 4, primeraVisita: "2026-07-01", ultimaVisita: "2026-07-31" });
    expect(ritmoDeVisitaDias(c)).toBe(10);
  });
  it("con una sola visita no hay ritmo", () => {
    expect(ritmoDeVisitaDias(cliente({ cumplidas: 1 }))).toBeNull();
  });
});

describe("seEstaEnfriando — la señal de riesgo temprana", () => {
  const base = {
    cumplidas: 5,
    primeraVisita: "2026-05-01",
    ultimaVisita: "2026-07-01",
    // ritmo: 61 días / 4 intervalos ≈ 15 días.
  };
  it("venía cada 15 días y lleva 62 sin venir: se enfría", () => {
    expect(seEstaEnfriando(cliente({ ...base, diasSinVenir: 62 }))).toBe(true);
  });
  it("lleva 20 días (menos del doble de su ritmo): todavía no", () => {
    expect(seEstaEnfriando(cliente({ ...base, diasSinVenir: 20 }))).toBe(false);
  });
  it("con una próxima cita agendada no hay enfriamiento que valga", () => {
    expect(
      seEstaEnfriando(cliente({ ...base, diasSinVenir: 62, proximaCita: "2026-09-05" })),
    ).toBe(false);
  });
  it("el ocasional (menos de 3 visitas) no se acusa: no hay ritmo", () => {
    expect(seEstaEnfriando(cliente({ cumplidas: 2, diasSinVenir: 90 }))).toBe(false);
  });
});

describe("corteVip", () => {
  it("es el percentil 90 del gasto de la cartera", () => {
    const cartera = Array.from({ length: 20 }, (_, i) => cliente({ gastoTotal: (i + 1) * 1000 }));
    // 20 gastos de 1000..20000: el corte cae en 19000.
    expect(corteVip(cartera)).toBe(19_000);
  });
  it("con menos de 10 clientes con gasto NO hay VIP", () => {
    const cartera = Array.from({ length: 5 }, () => cliente({ gastoTotal: 99_999 }));
    expect(corteVip(cartera)).toBe(Number.POSITIVE_INFINITY);
    // Y por lo tanto nadie sale VIP, por caro que sea.
    expect(segmentoDe(cartera[0], HOY, corteVip(cartera))).not.toBe("vip");
  });
});

describe("segmentoDe — un solo segmento, el más accionable", () => {
  it("el VIP que faltó a sus últimas dos citas sale EN RIESGO, no VIP", () => {
    const c = cliente({ gastoTotal: 999_999, fallosSeguidos: 2, cumplidas: 8 });
    expect(segmentoDe(c, HOY, 50_000)).toBe("en_riesgo");
  });
  it("el frecuente que se enfrió sale EN RIESGO, no frecuente", () => {
    const c = cliente({
      cumplidas: 5,
      primeraVisita: "2026-05-01",
      ultimaVisita: "2026-07-01",
      diasSinVenir: 62,
      gastoTotal: 1_000,
    });
    expect(segmentoDe(c, HOY, 50_000)).toBe("en_riesgo");
  });
  it("inactivo: más de 60 días sin venir y sin señales peores", () => {
    const c = cliente({ cumplidas: 2, ultimaVisita: "2026-05-01", diasSinVenir: 123 });
    expect(segmentoDe(c, HOY, 50_000)).toBe("inactivo");
  });
  it("nuevo: primera visita hace menos de 30 días y sin historia", () => {
    const c = cliente({ cumplidas: 1, primeraVisita: "2026-08-20", diasSinVenir: 12 });
    expect(segmentoDe(c, HOY, 50_000)).toBe("nuevo");
    expect(esNuevo(c, HOY)).toBe(true);
  });
  it("frecuente le gana a nuevo: tres visitas en su primer mes ya es frecuente", () => {
    const c = cliente({ cumplidas: 3, primeraVisita: "2026-08-10", ultimaVisita: "2026-08-30", diasSinVenir: 2 });
    expect(segmentoDe(c, HOY, 50_000)).toBe("frecuente");
  });
});

describe("segmentarCartera + conteo", () => {
  it("cada cliente sale exactamente una vez y el conteo cierra", () => {
    const cartera = [
      cliente({ clave: "a", fallosSeguidos: 2 }),
      cliente({ clave: "b", cumplidas: 4, primeraVisita: "2026-06-01", ultimaVisita: "2026-08-28", diasSinVenir: 4 }),
      cliente({ clave: "c", cumplidas: 1, primeraVisita: "2026-08-25", diasSinVenir: 7 }),
    ];
    const segmentados = segmentarCartera(cartera, HOY);
    expect(segmentados).toHaveLength(3);
    const conteo = conteoPorSegmento(segmentados);
    const total = Object.values(conteo).reduce((s, n) => s + n, 0);
    expect(total).toBe(3);
    expect(conteo.en_riesgo).toBe(1);
    expect(conteo.frecuente).toBe(1);
    expect(conteo.nuevo).toBe(1);
  });
});
