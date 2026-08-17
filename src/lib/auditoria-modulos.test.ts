import { describe, expect, it, vi } from "vitest";

// ── EL PAQUETE «A CONVENIR» QUE HOY NO EXISTE ───────────────────────
/**
 * `planEsDePago` distingue TRES precios y no dos: `0` es gratis,
 * un número es de pago, y `null` es «a convenir» — que TAMBIÉN es de
 * pago. Esa tercera rama es la que esconde los contratos más grandes si
 * se rompe: tratarlos como gratuitos los saca de la auditoría de dinero
 * justo a los que más plata mueven.
 *
 * Los paquetes que se cotizaban caso por caso («Empresa», «Básico»…)
 * eran todos RETIRADOS, y los retirados se borraron el 2026-08-17. Con
 * el catálogo de hoy —cuatro paquetes, todos con cifra— la rama del
 * `null` ya no se puede alcanzar con un id de verdad, así que se
 * inyecta uno inventado. Mismo criterio que `prueba.test.ts`: la lógica
 * que decide qué se cobra no se queda sin red porque cambió el
 * catálogo.
 */
const { PLAN_A_CONVENIR } = vi.hoisted(() => ({
  PLAN_A_CONVENIR: "paquete-a-convenir-solo-del-test",
}));

vi.mock("./lealtad/planes", async (importOriginal) => {
  const real = await importOriginal<typeof import("./lealtad/planes")>();
  // De todo el objeto, `planEsDePago` solo lee `precioMensual`.
  const aConvenir: import("./lealtad/planes").DefinicionPlan = {
    ...real.PLANES.ilimitado,
    id: PLAN_A_CONVENIR as import("./lealtad/planes").PlanId,
    nombre: "Paquete A Convenir Del Test",
    precioMensual: null,
    precioAnual: null,
    vigente: false,
  };
  return {
    ...real,
    definicionDe: (plan: string | null) =>
      plan === PLAN_A_CONVENIR ? aConvenir : real.definicionDe(plan),
  };
});

import {
  cobrosConocidosSinMonto,
  cortesiasDePlan,
  detectarHallazgos,
  enPeriodo,
  esIngreso,
  faltaTablaCobros,
  mesAnterior,
  mesCR,
  planEsDePago,
  resumenCortesias,
  suscripcionesSinCobro,
  totalesDe,
  totalesPor,
  type CobroModulo,
  type EntradaAuditoria,
  type SolicitudAuditoria,
  type SuscripcionAuditoria,
} from "./auditoria-modulos";

// "Ahora" fijo: 13 de agosto de 2026, 15:00 UTC (9 a.m. en Costa Rica).
const AHORA = new Date("2026-08-13T15:00:00.000Z");

function cobro(over: Partial<CobroModulo> = {}): CobroModulo {
  return {
    id: "c1",
    rancho_id: "r1",
    negocio_nombre: "Silence Barber",
    producto: "plan_lealtad",
    plan: "impulso",
    addon: null,
    periodo: "mensual",
    metodo: "sinpe",
    monto: 21000,
    moneda: "CRC",
    tipo_cambio: 500,
    es_cortesia: false,
    valor_lista_usd: null,
    cobrado_en: "2026-08-05T16:00:00.000Z",
    solicitud_id: null,
    stripe_invoice_id: null,
    notas: null,
    anulado_en: null,
    anulado_motivo: null,
    ...over,
  };
}

function entrada(over: Partial<EntradaAuditoria> = {}): EntradaAuditoria {
  return {
    negocios: [],
    cuentas: [],
    cuentasLegibles: true,
    solicitudes: [],
    suscripciones: [],
    cobros: [],
    movimientos: [],
    ahora: AHORA,
    ...over,
  };
}

function negocio(id: string, plan: string | null, nombre = id) {
  return { id, nombre, vertical: "citas", planRancho: plan, addons: [] };
}

function solicitud(over: Partial<SolicitudAuditoria> = {}): SolicitudAuditoria {
  return {
    id: "s1",
    ranchoId: "r1",
    negocioNombre: null,
    plan: "impulso",
    estado: "atendida",
    metodoPago: "sinpe",
    comprobanteUrl: "https://x/comprobante.png",
    createdAt: "2026-08-01T10:00:00.000Z",
    atendidaEn: "2026-08-02T10:00:00.000Z",
    ...over,
  };
}

function suscripcion(over: Partial<SuscripcionAuditoria> = {}): SuscripcionAuditoria {
  return {
    id: "sub1",
    ranchoId: "r1",
    cuentaId: null,
    plan: "impulso",
    estado: "activa",
    periodo: "mensual",
    periodoFin: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("las monedas nunca se suman", () => {
  it("separa colones de dólares y cuenta los cobros", () => {
    const t = totalesDe([
      cobro({ id: "a", monto: 21000, moneda: "CRC" }),
      cobro({ id: "b", monto: 42, moneda: "USD", metodo: "stripe" }),
      cobro({ id: "c", monto: 5000, moneda: "CRC" }),
    ]);
    expect(t).toEqual({ crc: 26000, usd: 42, cobros: 3 });
  });

  it("parte los totales por método sin mezclar monedas", () => {
    const porMetodo = totalesPor(
      [
        cobro({ id: "a", metodo: "sinpe", monto: 21000, moneda: "CRC" }),
        cobro({ id: "b", metodo: "stripe", monto: 42, moneda: "USD" }),
        cobro({ id: "c", metodo: "stripe", monto: 12, moneda: "USD" }),
      ],
      (c) => c.metodo,
    );
    expect(porMetodo.get("sinpe")).toEqual({ crc: 21000, usd: 0, cobros: 1 });
    expect(porMetodo.get("stripe")).toEqual({ crc: 0, usd: 54, cobros: 2 });
  });
});

describe("cortesías y anulados no son ingreso", () => {
  it("una cortesía no suma ni cuenta como cobro", () => {
    const cortesia = cobro({
      id: "x",
      es_cortesia: true,
      monto: 0,
      valor_lista_usd: 42,
    });
    expect(esIngreso(cortesia)).toBe(false);
    expect(totalesDe([cortesia])).toEqual({ crc: 0, usd: 0, cobros: 0 });
  });

  it("un cobro anulado sale del total", () => {
    const anulado = cobro({
      id: "y",
      anulado_en: "2026-08-06T00:00:00.000Z",
      anulado_motivo: "monto mal tecleado",
    });
    expect(totalesDe([cobro(), anulado])).toEqual({ crc: 21000, usd: 0, cobros: 1 });
  });

  it("las cortesías se resumen aparte, en valor de catálogo", () => {
    const r = resumenCortesias([
      cobro({ id: "a", es_cortesia: true, monto: 0, valor_lista_usd: 42 }),
      cobro({ id: "b", es_cortesia: true, monto: 0, valor_lista_usd: null }),
      cobro({ id: "c" }),
      cobro({ id: "d", es_cortesia: true, monto: 0, anulado_en: "2026-08-09T00:00:00.000Z" }),
    ]);
    expect(r).toEqual({ cantidad: 2, valorListaUsd: 42, sinValor: 1 });
  });
});

describe("el período se cuenta en hora de Costa Rica", () => {
  it("un cobro del 31 a las 7 p.m. tica no se va al mes siguiente", () => {
    // 2026-08-01T01:00Z = 31 de julio, 7 p.m. en Costa Rica.
    expect(mesCR("2026-08-01T01:00:00.000Z")).toBe("2026-07");
  });

  it("mes en curso, mes pasado y año", () => {
    const enAgosto = "2026-08-05T16:00:00.000Z";
    const enJulio = "2026-07-20T16:00:00.000Z";
    const anioPasado = "2025-08-05T16:00:00.000Z";
    expect(enPeriodo(enAgosto, "mes", AHORA)).toBe(true);
    expect(enPeriodo(enJulio, "mes", AHORA)).toBe(false);
    expect(enPeriodo(enJulio, "mes_pasado", AHORA)).toBe(true);
    expect(enPeriodo(enJulio, "anio", AHORA)).toBe(true);
    expect(enPeriodo(anioPasado, "anio", AHORA)).toBe(false);
    expect(enPeriodo(anioPasado, "todo", AHORA)).toBe(true);
  });

  it("el mes anterior cruza el año", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesAnterior("2026-08")).toBe("2026-07");
  });
});

describe("qué paquete se cobra", () => {
  it("el de $0 no se cobra; los de precio sí", () => {
    expect(planEsDePago("prueba")).toBe(false);
    expect(planEsDePago("arranque")).toBe(true);
    expect(planEsDePago("impulso")).toBe(true);
    expect(planEsDePago("ilimitado")).toBe(true);
  });

  it("un paquete «a convenir» SÍ se cobra: null no es gratis", () => {
    // La rama que esconde los contratos más grandes si se rompe. Se
    // prueba con el paquete inyectado arriba porque el catálogo de hoy
    // no tiene ninguno con `precioMensual: null` — los que había eran
    // retirados y se borraron.
    expect(planEsDePago(PLAN_A_CONVENIR)).toBe(true);
  });

  it("sin definición no se cobra, que es lo contrario de «a convenir»", () => {
    // Y la diferencia importa: `null` en el CATÁLOGO es un precio
    // negociado; `null` porque el id no existe es una fila huérfana, y
    // esa no se puede facturar sin saber qué se le vendió.
    expect(planEsDePago(null)).toBe(false);
    expect(planEsDePago("inventado")).toBe(false);
    // Los ocho paquetes viejos que se borraron caen acá desde el
    // 2026-08-17. La base tampoco los tiene: se comprobó antes.
    expect(planEsDePago("gratis")).toBe(false);
    expect(planEsDePago("empresa")).toBe(false);
  });
});

describe("hallazgos", () => {
  it("un paquete de pago sin solicitud, sin suscripción y sin cobro sale como hallazgo", () => {
    const h = detectarHallazgos(entrada({ negocios: [negocio("r1", "impulso")] }));
    expect(h.map((x) => x.clave)).toContain("plan_sin_pago");
  });

  it("no sale si hay cualquiera de los tres rastros", () => {
    const base = { negocios: [negocio("r1", "impulso")] };
    for (const extra of [
      { solicitudes: [solicitud()] },
      { suscripciones: [suscripcion()] },
      { cobros: [cobro()] },
    ]) {
      const h = detectarHallazgos(entrada({ ...base, ...extra }));
      expect(h.filter((x) => x.clave === "plan_sin_pago")).toHaveLength(0);
    }
  });

  it("una cortesía anotada en la bitácora explica el paquete y deja de reclamarse", () => {
    const h = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "impulso")],
        movimientos: [
          {
            ranchoId: "r1",
            concepto: "cortesia",
            planDespues: "impulso",
            cortesiaHasta: null,
            creadoEn: "2026-08-01T10:00:00.000Z",
          },
        ],
      }),
    );
    expect(h.filter((x) => x.clave === "plan_sin_pago")).toHaveLength(0);
  });

  it("una venta anotada sin cobro que la respalde es hallazgo", () => {
    const venta = {
      ranchoId: "r1",
      concepto: "venta" as const,
      planDespues: "impulso",
      cortesiaHasta: null,
      creadoEn: "2026-08-05T10:00:00.000Z",
    };
    const sinCobro = detectarHallazgos(
      entrada({ negocios: [negocio("r1", "impulso")], movimientos: [venta] }),
    );
    expect(sinCobro.filter((x) => x.clave === "venta_sin_cobro")).toHaveLength(1);

    const conCobro = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "impulso")],
        movimientos: [venta],
        cobros: [cobro({ cobrado_en: "2026-08-05T16:00:00.000Z" })],
      }),
    );
    expect(conCobro.filter((x) => x.clave === "venta_sin_cobro")).toHaveLength(0);
  });

  it("un cobro viejo no tapa una venta nueva sin registrar", () => {
    const h = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "impulso")],
        movimientos: [
          {
            ranchoId: "r1",
            concepto: "venta",
            planDespues: "impulso",
            cortesiaHasta: null,
            creadoEn: "2026-08-05T10:00:00.000Z",
          },
        ],
        cobros: [cobro({ cobrado_en: "2026-01-05T16:00:00.000Z" })],
      }),
    );
    expect(h.filter((x) => x.clave === "venta_sin_cobro")).toHaveLength(1);
  });

  it("el paquete gratis nunca se reclama", () => {
    const h = detectarHallazgos(entrada({ negocios: [negocio("r1", "prueba")] }));
    expect(h).toHaveLength(0);
  });

  it("detecta que cuentas.plan manda y no coincide con ranchos.plan_lealtad", () => {
    const h = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "ilimitado")],
        cuentas: [{ id: "c1", ranchoId: "r1", plan: "arranque" }],
        cobros: [cobro()],
      }),
    );
    const d = h.find((x) => x.clave === "plan_discrepante");
    expect(d).toBeDefined();
    // 'arranque' se llama "Starter" en el catálogo: el hallazgo dice el
    // nombre que el dueño ve, no el id.
    expect(d?.detalle).toContain("Starter");
  });

  it("no inventa discrepancia cuando la cuenta no tiene paquete", () => {
    const h = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "ilimitado")],
        cuentas: [{ id: "c1", ranchoId: "r1", plan: null }],
        cobros: [cobro()],
      }),
    );
    expect(h.filter((x) => x.clave === "plan_discrepante")).toHaveLength(0);
  });

  it("no afirma nada de las cuentas si no se pudieron leer", () => {
    const h = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "ilimitado")],
        cuentas: [],
        cuentasLegibles: false,
        cobros: [cobro()],
      }),
    );
    expect(h.filter((x) => x.clave === "plan_discrepante")).toHaveLength(0);
  });

  it("dos suscripciones vivas en el mismo negocio", () => {
    const h = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "impulso")],
        suscripciones: [suscripcion({ id: "a" }), suscripcion({ id: "b", estado: "en_prueba" })],
      }),
    );
    expect(h.filter((x) => x.clave === "suscripcion_duplicada")).toHaveLength(1);
  });

  it("una suscripción viva que no cae en ningún negocio conocido", () => {
    const h = detectarHallazgos(
      entrada({ negocios: [], suscripciones: [suscripcion({ ranchoId: "fantasma" })] }),
    );
    expect(h.map((x) => x.clave)).toContain("suscripcion_sin_negocio");
  });

  it("resuelve la suscripción por la cuenta cuando no trae rancho", () => {
    const h = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "impulso")],
        cuentas: [{ id: "cta", ranchoId: "r1", plan: "impulso" }],
        suscripciones: [suscripcion({ ranchoId: null, cuentaId: "cta" })],
      }),
    );
    expect(h.filter((x) => x.clave === "suscripcion_sin_negocio")).toHaveLength(0);
    expect(h.filter((x) => x.clave === "plan_sin_pago")).toHaveLength(0);
  });

  it("un comprobante sin atender solo alerta pasado el umbral", () => {
    const reciente = detectarHallazgos(
      entrada({
        solicitudes: [
          solicitud({ estado: "pendiente", createdAt: "2026-08-12T10:00:00.000Z" }),
        ],
      }),
    );
    expect(reciente.filter((x) => x.clave === "comprobante_sin_atender")).toHaveLength(0);

    const viejo = detectarHallazgos(
      entrada({
        solicitudes: [
          solicitud({ estado: "pendiente", createdAt: "2026-08-01T10:00:00.000Z" }),
        ],
      }),
    );
    expect(viejo.filter((x) => x.clave === "comprobante_sin_atender")).toHaveLength(1);
  });

  it("una suscripción caída con el paquete encendido, salvo que haya otra viva", () => {
    const caida = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "impulso")],
        suscripciones: [suscripcion({ estado: "cancelada" })],
      }),
    );
    expect(caida.map((x) => x.clave)).toContain("suscripcion_muerta_plan_vivo");

    const cambioDePaquete = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "impulso")],
        suscripciones: [
          suscripcion({ id: "vieja", estado: "cancelada" }),
          suscripcion({ id: "nueva", estado: "activa" }),
        ],
      }),
    );
    expect(
      cambioDePaquete.filter((x) => x.clave === "suscripcion_muerta_plan_vivo"),
    ).toHaveLength(0);
  });

  it("ordena lo grave primero", () => {
    const h = detectarHallazgos(
      entrada({
        negocios: [negocio("r1", "impulso")],
        cobros: [cobro({ id: "huerfano", rancho_id: null })],
      }),
    );
    expect(h[0].gravedad).toBe("alta");
    expect(h[h.length - 1].clave).toBe("cobro_sin_negocio");
  });
});

describe("el agujero se dice, no se estima", () => {
  it("lista las solicitudes aprobadas con depósito y sin monto anotado", () => {
    const filas = cobrosConocidosSinMonto(
      entrada({
        negocios: [negocio("r1", "impulso", "Silence Barber")],
        solicitudes: [solicitud()],
      }),
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].negocio).toBe("Silence Barber");
    expect(filas[0].plan).toBe("impulso");
  });

  it("deja de listarla cuando ya se registró el cobro", () => {
    const filas = cobrosConocidosSinMonto(
      entrada({
        negocios: [negocio("r1", "impulso")],
        solicitudes: [solicitud()],
        cobros: [cobro({ solicitud_id: "s1" })],
      }),
    );
    expect(filas).toHaveLength(0);
  });

  it("vuelve a listarla si ese cobro se anuló", () => {
    const filas = cobrosConocidosSinMonto(
      entrada({
        negocios: [negocio("r1", "impulso")],
        solicitudes: [solicitud()],
        cobros: [
          cobro({ solicitud_id: "s1", anulado_en: "2026-08-09T00:00:00.000Z", anulado_motivo: "mal" }),
        ],
      }),
    );
    expect(filas).toHaveLength(1);
  });

  it("no reclama monto de un paquete gratis ni de una solicitud pendiente", () => {
    const filas = cobrosConocidosSinMonto(
      entrada({
        solicitudes: [
          solicitud({ id: "gratis", plan: "prueba" }),
          solicitud({ id: "pend", estado: "pendiente" }),
        ],
      }),
    );
    expect(filas).toHaveLength(0);
  });

  it("marca las suscripciones vivas sin ningún cobro anotado", () => {
    const sinNada = suscripcionesSinCobro(
      entrada({ negocios: [negocio("r1", "impulso")], suscripciones: [suscripcion()] }),
    );
    expect(sinNada).toHaveLength(1);

    const conCobro = suscripcionesSinCobro(
      entrada({
        negocios: [negocio("r1", "impulso")],
        suscripciones: [suscripcion()],
        cobros: [cobro({ metodo: "stripe", moneda: "USD", monto: 42 })],
      }),
    );
    expect(conCobro).toHaveLength(0);
  });
});

describe("las regalías de paquete salen de la bitácora, no del libro", () => {
  it("lista los paquetes regalados con el nombre del negocio", () => {
    const filas = cortesiasDePlan(
      entrada({
        negocios: [negocio("r1", "impulso", "Silence Barber")],
        movimientos: [
          {
            ranchoId: "r1",
            concepto: "cortesia",
            planDespues: "impulso",
            cortesiaHasta: "2026-12-31T00:00:00.000Z",
            creadoEn: "2026-08-01T10:00:00.000Z",
          },
          {
            ranchoId: "r1",
            concepto: "venta",
            planDespues: "ilimitado",
            cortesiaHasta: null,
            creadoEn: "2026-08-02T10:00:00.000Z",
          },
        ],
      }),
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].negocio).toBe("Silence Barber");
    expect(filas[0].cortesiaHasta).toBe("2026-12-31T00:00:00.000Z");
  });
});

describe("la tabla puede no existir todavía", () => {
  it("reconoce los dos códigos de tabla ausente", () => {
    expect(faltaTablaCobros({ code: "42P01" })).toBe(true);
    expect(faltaTablaCobros({ code: "PGRST205" })).toBe(true);
    expect(
      faltaTablaCobros({ message: "Could not find the table 'public.cobros_modulo'" }),
    ).toBe(true);
    expect(faltaTablaCobros({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});
