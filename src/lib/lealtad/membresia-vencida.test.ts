import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bloqueoPorMembresia, fechaDelPagoManual } from "./membresia-vencida";
import {
  complementoVencio,
  esPeriodoPagado,
  finDelPagoManual,
  membresiaVencidaDe,
  PERIODOS_PAGADOS,
  suscripcionSueltaElBloqueo,
} from "./regalias";

/**
 * LO QUE ESTAS PRUEBAS DEFIENDEN
 *
 * Hay dos formas de equivocarse acá y las dos cuestan clientes:
 *
 *   1. CERRARLE EL PANEL A QUIEN YA PAGÓ. El webhook de Stripe no deja
 *      fila en la bitácora, así que para la bitácora la regalía sigue
 *      siendo lo último que pasó. Es la más peligrosa, y por eso tiene
 *      su propia prueba.
 *
 *   2. CERRÁRSELO POR UN ERROR NUESTRO. Una consulta caída no puede
 *      convertirse en «membresía vencida».
 */

const AHORA = new Date("2026-11-04T12:00:00Z");
const RANCHO = "34525402-b895-4070-90fa-be3449f9b15c";
const AYER = "2026-11-03T12:00:00Z";
const MANANA = "2026-11-05T12:00:00Z";

const regalia = (cortesiaHasta: string | null, planDespues = "impulso") => ({
  concepto: "cortesia",
  planDespues,
  cortesiaHasta,
});

describe("membresiaVencidaDe", () => {
  it("una regalía de paquete con la fecha pasada está vencida", () => {
    expect(membresiaVencidaDe({ ultimoMovimiento: regalia(AYER), complemento: null }, AHORA)).toEqual(
      { origen: "paquete", hasta: AYER, plan: "impulso" },
    );
  });

  it("con la fecha por delante no lo está", () => {
    expect(
      membresiaVencidaDe({ ultimoMovimiento: regalia(MANANA), complemento: null }, AHORA),
    ).toBeNull();
  });

  it("una regalía SIN fecha nunca vence: son los convenios", () => {
    expect(
      membresiaVencidaDe({ ultimoMovimiento: regalia(null), complemento: null }, AHORA),
    ).toBeNull();
  });

  it("una fecha ilegible no bloquea a nadie", () => {
    expect(
      membresiaVencidaDe({ ultimoMovimiento: regalia("no es una fecha"), complemento: null }, AHORA),
    ).toBeNull();
  });

  it.each(["venta", "correccion", "baja"])(
    "si lo último fue «%s», la regalía vieja ya no manda",
    (concepto) => {
      expect(
        membresiaVencidaDe(
          {
            ultimoMovimiento: { concepto, planDespues: "impulso", cortesiaHasta: null },
            complemento: null,
          },
          AHORA,
        ),
      ).toBeNull();
    },
  );

  it("una regalía del complemento también vence", () => {
    expect(
      membresiaVencidaDe(
        {
          ultimoMovimiento: null,
          complemento: { activo: true, venceEn: AYER, esCortesia: true },
        },
        AHORA,
      ),
    ).toEqual({ origen: "complemento", hasta: AYER, plan: null });
  });

  it("complementoVencio pide las dos cosas: encendido y con la fecha pasada", () => {
    expect(complementoVencio({ activo: true, venceEn: AYER }, AHORA)).toBe(true);
    expect(complementoVencio({ activo: false, venceEn: AYER }, AHORA)).toBe(false);
    expect(complementoVencio({ activo: true, venceEn: MANANA }, AHORA)).toBe(false);
    expect(complementoVencio({ activo: true, venceEn: null }, AHORA)).toBe(false);
    expect(complementoVencio(null, AHORA)).toBe(false);
  });

  it("se acabó lo que cubría un pago por SINPE: vence igual que una regalía", () => {
    expect(
      membresiaVencidaDe(
        {
          ultimoMovimiento: { concepto: "venta", planDespues: "impulso", cortesiaHasta: null },
          complemento: { activo: true, venceEn: AYER, esCortesia: false },
          plan: "impulso",
        },
        AHORA,
      ),
    ).toEqual({ origen: "complemento", hasta: AYER, plan: "impulso" });
  });

  it("todavía dentro de lo pagado no vence", () => {
    expect(
      membresiaVencidaDe(
        {
          ultimoMovimiento: { concepto: "venta", planDespues: "impulso", cortesiaHasta: null },
          complemento: { activo: true, venceEn: MANANA, esCortesia: false },
          plan: "impulso",
        },
        AHORA,
      ),
    ).toBeNull();
  });

  it("la Prueba de 14 días no es una membresía vencida: tiene su propia pantalla", () => {
    expect(
      membresiaVencidaDe(
        {
          ultimoMovimiento: null,
          complemento: { activo: true, venceEn: AYER, esCortesia: false },
          plan: "prueba",
        },
        AHORA,
      ),
    ).toBeNull();
  });

  it("un complemento regalado que el admin apagó no es un vencimiento", () => {
    expect(
      membresiaVencidaDe(
        {
          ultimoMovimiento: null,
          complemento: { activo: false, venceEn: AYER, esCortesia: true },
        },
        AHORA,
      ),
    ).toBeNull();
  });
});

describe("finDelPagoManual", () => {
  it("cuenta desde hoy si no tenía fecha", () => {
    expect(finDelPagoManual(1, null, AHORA)).toBe("2026-12-04T12:00:00.000Z");
  });

  it("renovar antes de tiempo suma desde la fecha que ya tenía", () => {
    expect(finDelPagoManual(1, "2026-11-20T12:00:00Z", AHORA)).toBe("2026-12-20T12:00:00.000Z");
  });

  it("si ya venció, cuenta desde hoy: no se le cobra el tiempo que estuvo afuera", () => {
    expect(finDelPagoManual(1, "2026-10-01T12:00:00Z", AHORA)).toBe("2026-12-04T12:00:00.000Z");
  });

  it("un año son doce meses de calendario", () => {
    expect(finDelPagoManual(12, null, AHORA)).toBe("2027-11-04T12:00:00.000Z");
  });

  it("no se desborda: del 31 de enero más un mes es fin de febrero", () => {
    expect(finDelPagoManual(1, null, new Date("2027-01-31T12:00:00Z"))).toBe(
      "2027-02-28T12:00:00.000Z",
    );
  });

  it("una fecha ilegible no rompe la cuenta", () => {
    expect(finDelPagoManual(1, "no es una fecha", AHORA)).toBe("2026-12-04T12:00:00.000Z");
  });
});

describe("esPeriodoPagado", () => {
  it("acepta solo las opciones de la lista", () => {
    for (const p of PERIODOS_PAGADOS) expect(esPeriodoPagado(p.meses)).toBe(true);
    for (const malo of [0, -1, 2, 1.5, 1000, Number.NaN, "1", null, undefined]) {
      expect(esPeriodoPagado(malo)).toBe(false);
    }
  });
});

describe("suscripcionSueltaElBloqueo", () => {
  it.each([
    ["activa", true],
    ["en_prueba", true],
    ["morosa", true],
    ["cancelada", false],
  ])("%s → %s", (estado, esperado) => {
    expect(suscripcionSueltaElBloqueo(estado)).toBe(esperado);
  });
});

// ── La puerta contra una base de mentira ───────────────────────────

type Respuesta = { data: unknown; error: { message: string } | null };
type Base = {
  historial?: Respuesta;
  complemento?: Respuesta;
  rancho?: Respuesta;
  cuenta?: Respuesta;
  suscripciones?: Respuesta;
  solicitudes?: Respuesta;
};

const VACIO: Respuesta = { data: [], error: null };
const NULO: Respuesta = { data: null, error: null };
const CAIDA: Respuesta = { data: null, error: { message: "caída" } };

function baseDe(base: Base) {
  const consultadas: string[] = [];
  const db = {
    from(tabla: string) {
      consultadas.push(tabla);
      const respuestas: Record<string, Respuesta> = {
        historial_plan_lealtad: base.historial ?? VACIO,
        addons_negocio: base.complemento ?? NULO,
        ranchos: base.rancho ?? NULO,
        cuentas: base.cuenta ?? NULO,
        suscripciones: base.suscripciones ?? VACIO,
        solicitudes_lealtad: base.solicitudes ?? VACIO,
      };
      const respuesta = respuestas[tabla] ?? VACIO;
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        or: (filtro: string) => {
          consultadas.push(`or:${filtro}`);
          return consulta;
        },
        order: () => consulta,
        limit: () => consulta,
        maybeSingle: async () => respuesta,
        then: (ok: (r: Respuesta) => unknown) => Promise.resolve(respuesta).then(ok),
      };
      return consulta;
    },
  };
  return { db: db as unknown as SupabaseClient, consultadas };
}

const VENCIDA: Respuesta = {
  data: [{ concepto: "cortesia", plan_despues: "impulso", cortesia_hasta: AYER }],
  error: null,
};

describe("bloqueoPorMembresia", () => {
  it("regalía vencida y nadie ha pagado: bloquea", async () => {
    const { db } = baseDe({ historial: VENCIDA });
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.toEqual({
      origen: "paquete",
      hasta: AYER,
      plan: "impulso",
      comprobanteEnRevision: false,
    });
  });

  it("el negocio normal solo paga las dos lecturas por índice", async () => {
    const { db, consultadas } = baseDe({
      historial: {
        data: [{ concepto: "venta", plan_despues: "impulso", cortesia_hasta: null }],
        error: null,
      },
    });
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.toBeNull();
    expect(consultadas).toEqual(["historial_plan_lealtad", "addons_negocio"]);
  });

  it("YA PAGÓ CON TARJETA: el webhook no deja fila en la bitácora y aun así no bloquea", async () => {
    const { db } = baseDe({
      historial: VENCIDA,
      suscripciones: { data: [{ estado: "activa" }], error: null },
    });
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.toBeNull();
  });

  it("la suscripción se busca también por la cuenta: puede no colgar del negocio (0143)", async () => {
    const { db, consultadas } = baseDe({
      historial: VENCIDA,
      cuenta: { data: { id: "cuenta-1" }, error: null },
    });
    await bloqueoPorMembresia(db, RANCHO, AHORA);
    expect(consultadas).toContain(`or:rancho_id.eq.${RANCHO},cuenta_id.eq.cuenta-1`);
  });

  it("una suscripción cancelada no suelta el bloqueo", async () => {
    const { db } = baseDe({
      historial: VENCIDA,
      suscripciones: { data: [{ estado: "cancelada" }], error: null },
    });
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.not.toBeNull();
  });

  it("con un comprobante de SINPE sin aprobar sigue bloqueado, pero avisa que ya se recibió", async () => {
    const { db } = baseDe({
      historial: VENCIDA,
      solicitudes: { data: [{ id: "s-1" }], error: null },
    });
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.toMatchObject({
      comprobanteEnRevision: true,
    });
  });

  it.each<[string, Base]>([
    ["el historial", { historial: CAIDA }],
    ["el complemento", { historial: VENCIDA, complemento: CAIDA }],
    ["la cuenta", { historial: VENCIDA, cuenta: CAIDA }],
    ["las suscripciones", { historial: VENCIDA, suscripciones: CAIDA }],
  ])("si no se puede leer %s, NO se bloquea", async (_, base) => {
    const { db } = baseDe(base);
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.toBeNull();
  });

  it("lo pagado por SINPE venció: bloquea, con el nombre del paquete", async () => {
    const { db } = baseDe({
      historial: {
        data: [{ concepto: "venta", plan_despues: "impulso", cortesia_hasta: null }],
        error: null,
      },
      complemento: { data: { activo: true, vence_en: AYER, es_cortesia: false }, error: null },
      rancho: { data: { plan_lealtad: "impulso" }, error: null },
    });
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.toEqual({
      origen: "complemento",
      hasta: AYER,
      plan: "impulso",
      comprobanteEnRevision: false,
    });
  });

  it("una Prueba vencida sigue con su propia pantalla", async () => {
    const { db } = baseDe({
      complemento: { data: { activo: true, vence_en: AYER, es_cortesia: false }, error: null },
      rancho: { data: { plan_lealtad: "prueba" }, error: null },
    });
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.toBeNull();
  });

  it("si la consulta revienta, tampoco", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      from() {
        throw new Error("sin red");
      },
    } as unknown as SupabaseClient;
    await expect(bloqueoPorMembresia(db, RANCHO, AHORA)).resolves.toBeNull();
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });
});

describe("fechaDelPagoManual", () => {
  const AL_DIA = { data: { vence_en: "2026-11-20T12:00:00Z" }, error: null };

  it("paga con tarjeta: no se le escribe fecha, o se le apagaría el módulo pagando", async () => {
    const { db } = baseDe({
      suscripciones: { data: [{ estado: "activa" }], error: null },
      complemento: AL_DIA,
    });
    await expect(fechaDelPagoManual(db, RANCHO, 1, AHORA)).resolves.toBeNull();
  });

  it("por SINPE suma desde la fecha que tenía", async () => {
    const { db } = baseDe({ complemento: AL_DIA });
    await expect(fechaDelPagoManual(db, RANCHO, 1, AHORA)).resolves.toBe(
      "2026-12-20T12:00:00.000Z",
    );
  });
});
