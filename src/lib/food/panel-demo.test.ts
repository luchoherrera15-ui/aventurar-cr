import { describe, expect, it } from "vitest";
import {
  CLIENTES_DEMO,
  COMPARACION_MES_DEMO,
  INSIGHTS_DEMO,
  PROMOS_DEMO,
  RESERVAS_DEMO,
  SERIE_90_DIAS,
  TICKET_PROMEDIO_DEMO,
  VENTAS_ESTIMADAS_30_DEMO,
  rangoDe,
  variacionPorcentual,
} from "./panel-demo";
import { datosRendimiento } from "./rendimiento-demo";

/**
 * LA COHERENCIA DEL DEMO ES UN CONTRATO, no una casualidad: el pitch
 * comercial del panel muestra 87 reservas en el KPI, ~87 en el
 * gráfico, 76 check-ins que también son las reservas "completada",
 * 163 nuevos dentro de 214 clientes y un ticket que es exactamente
 * ventas ÷ check-ins. Un dueño de restaurante que divida dos números
 * de la pantalla y no le cierre deja de creer TODO el panel.
 *
 * Estos tests fijan ese contrato. Si alguien recalibra las anclas de
 * panel-demo.ts (o agrega una pantalla con números propios), esto es
 * lo que grita antes de que lo haga un cliente en una demo.
 */

describe("las anclas de 30 días (los números de la maqueta)", () => {
  const { serie, kpis } = rangoDe(30);

  it("los KPIs de 30 días son EXACTAMENTE los de la maqueta comercial", () => {
    expect(kpis.reservas).toBe(87);
    expect(kpis.checkIns).toBe(76);
    expect(kpis.personas).toBe(246);
    expect(kpis.clientes).toBe(214);
    expect(kpis.clientesNuevos).toBe(163);
    expect(kpis.ventasEstimadas).toBe(1_285_000);
  });

  it("el ticket promedio se deriva de las ventas (₡1.285.000 ÷ 76 = ₡16.908)", () => {
    expect(TICKET_PROMEDIO_DEMO).toBe(Math.round(VENTAS_ESTIMADAS_30_DEMO / 76));
    expect(TICKET_PROMEDIO_DEMO).toBe(16_908);
    expect(kpis.ticketPromedio).toBe(TICKET_PROMEDIO_DEMO);
  });

  it("el gráfico respalda al KPI: la serie de 30 días suma lo mismo", () => {
    expect(serie).toHaveLength(30);
    expect(serie.reduce((a, p) => a + p.reservas, 0)).toBe(kpis.reservas);
    expect(serie.reduce((a, p) => a + p.checkIns, 0)).toBe(kpis.checkIns);
    expect(serie.reduce((a, p) => a + p.personas, 0)).toBe(kpis.personas);
  });

  it("los subconjuntos son subconjuntos: nuevos ⊂ clientes ⊂ personas, check-ins ≤ reservas", () => {
    expect(kpis.clientesNuevos).toBeLessThanOrEqual(kpis.clientes);
    expect(kpis.clientes).toBeLessThanOrEqual(kpis.personas);
    expect(kpis.checkIns).toBeLessThanOrEqual(kpis.reservas);
  });
});

describe("la serie de 90 días", () => {
  it("ningún día tiene más check-ins que reservas ni personas negativas", () => {
    expect(SERIE_90_DIAS).toHaveLength(90);
    for (const p of SERIE_90_DIAS) {
      expect(p.checkIns).toBeGreaterThanOrEqual(0);
      expect(p.checkIns).toBeLessThanOrEqual(p.reservas);
      expect(p.personas).toBeGreaterThanOrEqual(p.reservas === 0 ? 0 : p.reservas);
    }
  });

  it("los rangos 7 y 90 también se respaldan en la serie (el selector nunca miente)", () => {
    for (const dias of [7, 90] as const) {
      const { serie, kpis } = rangoDe(dias);
      expect(serie).toHaveLength(dias);
      expect(serie.reduce((a, p) => a + p.reservas, 0)).toBe(kpis.reservas);
      expect(serie.reduce((a, p) => a + p.checkIns, 0)).toBe(kpis.checkIns);
      expect(kpis.ventasEstimadas).toBe(kpis.checkIns * TICKET_PROMEDIO_DEMO);
    }
  });
});

describe("las reservas históricas nacen de la serie", () => {
  it("cada día del histórico tiene exactamente las filas y completadas de la serie", () => {
    const porFecha = new Map<string, { filas: number; completadas: number; personas: number }>();
    for (const r of RESERVAS_DEMO) {
      // Solo el histórico (las futuras no están en la serie de pasado).
      const dia = SERIE_90_DIAS.find((p) => p.fecha === r.fecha);
      if (!dia) continue;
      const acc = porFecha.get(r.fecha) ?? { filas: 0, completadas: 0, personas: 0 };
      acc.filas += 1;
      if (r.estado === "completada") acc.completadas += 1;
      acc.personas += r.personas;
      porFecha.set(r.fecha, acc);
    }
    expect(porFecha.size).toBeGreaterThan(0);
    for (const [fecha, acc] of porFecha) {
      const dia = SERIE_90_DIAS.find((p) => p.fecha === fecha)!;
      expect(acc.filas).toBe(dia.reservas);
      expect(acc.completadas).toBe(dia.checkIns);
      expect(acc.personas).toBe(dia.personas);
    }
  });

  it("solo las completadas llevan consumo estimado", () => {
    for (const r of RESERVAS_DEMO) {
      if (r.estado === "completada") expect(r.totalEstimado).toBeGreaterThan(0);
      else expect(r.totalEstimado).toBeNull();
    }
  });
});

describe("promociones y clientes son subconjuntos del período", () => {
  it("las reservas por promo (67) caben en las 87 y sus check-ins (59) en los 76", () => {
    const reservasPromo = PROMOS_DEMO.reduce((a, p) => a + p.reservas, 0);
    const checkInsPromo = PROMOS_DEMO.reduce((a, p) => a + p.checkIns, 0);
    expect(reservasPromo).toBe(67);
    expect(reservasPromo).toBeLessThanOrEqual(87);
    expect(checkInsPromo).toBe(59);
    expect(checkInsPromo).toBeLessThanOrEqual(76);
    for (const p of PROMOS_DEMO) expect(p.checkIns).toBeLessThanOrEqual(p.reservas);
  });

  it("la muestra de clientes apunta en la misma dirección que el agregado (163/214 nuevos)", () => {
    const nuevos = CLIENTES_DEMO.filter((c) => c.tipo === "nuevo");
    const recurrentes = CLIENTES_DEMO.filter((c) => c.tipo === "recurrente");
    expect(nuevos.length + recurrentes.length).toBe(CLIENTES_DEMO.length);
    expect(nuevos.length).toBeGreaterThan(recurrentes.length);
    for (const c of nuevos) expect(c.visitas).toBe(1);
    for (const c of recurrentes) expect(c.visitas).toBeGreaterThanOrEqual(2);
  });
});

describe("los porcentajes salen de sus dos cifras visibles", () => {
  it("la comparación mensual deriva su % con variacionPorcentual (87 vs 76, ₡1.285.000 vs ₡1.084.000)", () => {
    const { reservas, ventas } = COMPARACION_MES_DEMO;
    expect(reservas.variacion).toBe(variacionPorcentual(reservas.actual, reservas.anterior));
    expect(ventas.variacion).toBe(variacionPorcentual(ventas.actual, ventas.anterior));
    // Y son los mismos deltas que enseña el KPI de 30 días del dashboard.
    const { kpis } = rangoDe(30);
    expect(kpis.deltas.reservas).toBe(reservas.variacion);
    expect(kpis.deltas.ventas).toBe(ventas.variacion);
  });

  it("los insights traen número calculado, nunca placeholder", () => {
    expect(INSIGHTS_DEMO).toHaveLength(3);
    for (const i of INSIGHTS_DEMO) expect(i.texto).toMatch(/\d/);
  });
});

describe("rendimiento-demo deriva de las mismas anclas", () => {
  it("los buckets del período suman lo mismo que los KPIs del rango", () => {
    for (const dias of [7, 30, 90] as const) {
      const datos = datosRendimiento(dias);
      expect(datos.buckets.reduce((a, b) => a + b.reservas, 0)).toBe(datos.kpis.reservas);
      expect(datos.buckets.reduce((a, b) => a + b.checkIns, 0)).toBe(datos.kpis.checkIns);
    }
  });

  it("la conversión de 30 días es reservas ÷ visitas al perfil (87/680 ≈ 12,8%)", () => {
    const datos = datosRendimiento(30);
    expect(datos.visitasPerfil).toBe(680);
    expect(datos.conversion).toBeCloseTo((87 / 680) * 100, 1);
  });
});
