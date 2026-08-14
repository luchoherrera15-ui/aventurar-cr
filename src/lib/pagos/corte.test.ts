import { describe, expect, it } from "vitest";
import { decidirPorCobro, motivoDeCorte, type VeredictoDeCobro } from "./corte";

/**
 * Cada caso de acá es un negocio que, si esto se equivoca, o queda
 * apagado con la factura pagada o sigue operando gratis para siempre.
 *
 * Son los dos errores caros y son opuestos, así que las dos direcciones
 * están fijadas: qué apaga y qué NO apaga.
 */

function veredicto(
  statusStripe: string | null,
  extra: { cancelaAlFinal?: boolean; sigueCubierto?: boolean } = {},
): VeredictoDeCobro {
  return decidirPorCobro({
    statusStripe,
    cancelaAlFinal: extra.cancelaAlFinal ?? false,
    sigueCubierto: extra.sigueCubierto ?? false,
  });
}

describe("el corte cae al FINAL del período pagado, no al cancelar", () => {
  it("cancelar con el mes pagado deja la suscripción OPERANDO", () => {
    // Es el caso del encargo: canceló el día 3, pagó hasta el 30. Stripe
    // no la pone en `canceled` — la deja `active` con la bandera. Ese
    // mes está pagado y quitárselo antes es quedarse con plata cobrada.
    expect(veredicto("active", { cancelaAlFinal: true })).toEqual({
      estado: "opera",
      avisoPrevio: true,
    });
  });

  it("y recién cuando Stripe la cierra (`canceled`) se apaga", () => {
    expect(veredicto("canceled")).toEqual({ estado: "corta", motivo: "cancelada" });
  });

  it("una suscripción normal opera y no dispara ningún aviso", () => {
    expect(veredicto("active")).toEqual({ estado: "opera", avisoPrevio: false });
  });

  it("el período de prueba también opera", () => {
    expect(veredicto("trialing")).toEqual({ estado: "opera", avisoPrevio: false });
  });

  it("una prueba que se canceló también avisa la fecha", () => {
    expect(veredicto("trialing", { cancelaAlFinal: true })).toEqual({
      estado: "opera",
      avisoPrevio: true,
    });
  });
});

describe("el pago fallido NO es la cancelación", () => {
  it("`past_due` avisa y no apaga: Stripe reintenta durante días", () => {
    // Una tarjeta vencida es un accidente, no una decisión. Apagar en
    // el primer rebote es la forma más rápida de perder un cliente que
    // sí quería pagar: se entera porque un cliente suyo no pudo sellar.
    expect(veredicto("past_due")).toEqual({ estado: "en_mora" });
  });

  it("`incomplete` —el 3-D Secure a medias— tampoco apaga", () => {
    expect(veredicto("incomplete")).toEqual({ estado: "en_mora" });
  });

  it("`unpaid` SÍ apaga: ahí Stripe ya se rindió", () => {
    // La distinción que sostiene todo: `past_due` es el primer rebote y
    // `unpaid` es semanas después, con todos los reintentos agotados y
    // el período pagado terminado. Si `unpaid` no cortara, el que dejó
    // de pagar operaría gratis para siempre — Stripe no manda ningún
    // evento más.
    expect(veredicto("unpaid")).toEqual({ estado: "corta", motivo: "incobrable" });
  });

  it("los dos son `morosa` en la base, y por eso el status va crudo", () => {
    // `estadoDesdeStripe` colapsa past_due y unpaid en el mismo estado
    // guardado. Decidir con el estado normalizado sería no poder
    // distinguir «avisale» de «apagalo».
    expect(veredicto("past_due").estado).not.toBe(veredicto("unpaid").estado);
  });
});

describe("la duda no apaga (igual que la duda no activa)", () => {
  it("un status que Stripe invente mañana no apaga nada", () => {
    expect(veredicto("algo_que_no_existe_todavia")).toEqual({ estado: "en_mora" });
    expect(motivoDeCorte("algo_que_no_existe_todavia")).toBeNull();
  });

  it("sin status tampoco", () => {
    expect(veredicto(null)).toEqual({ estado: "en_mora" });
    expect(motivoDeCorte(null)).toBeNull();
    expect(motivoDeCorte(undefined)).toBeNull();
  });

  it("los finales de verdad de Stripe apagan", () => {
    expect(motivoDeCorte("canceled")).toBe("cancelada");
    expect(motivoDeCorte("paused")).toBe("cancelada");
    expect(motivoDeCorte("unpaid")).toBe("incobrable");
  });

  it("los que operan no apagan", () => {
    expect(motivoDeCorte("active")).toBeNull();
    expect(motivoDeCorte("trialing")).toBeNull();
    expect(motivoDeCorte("past_due")).toBeNull();
  });
});

describe("lo que nunca activó nada no puede apagar nada", () => {
  it("`incomplete_expired` NO apaga: es un Checkout abandonado", () => {
    // Stripe archiva así la suscripción que alguien abrió y nunca
    // completó (23 horas después). Ese negocio puede estar al día con
    // OTRA suscripción —abrió el Checkout para subir de paquete y se
    // arrepintió— y apagarlo sería quitarle lo que está pagando.
    expect(motivoDeCorte("incomplete_expired")).toBeNull();
    expect(veredicto("incomplete_expired")).toEqual({ estado: "en_mora" });
  });
});

describe("el que sigue cubierto por otra vía nunca se apaga", () => {
  it("el que paga por SINPE: una cancelación de Stripe no lo toca", () => {
    // El SINPE con comprobante es lo único que cobra dinero de verdad
    // hoy y esa gente no tiene suscripción de Stripe. Un negocio que
    // pagó por depósito NO se puede apagar por no tener tarjeta.
    expect(veredicto("canceled", { sigueCubierto: true })).toEqual({
      estado: "protegido",
      motivo: "cancelada",
    });
  });

  it("un `unpaid` tampoco lo toca", () => {
    expect(veredicto("unpaid", { sigueCubierto: true })).toEqual({
      estado: "protegido",
      motivo: "incobrable",
    });
  });

  it("el veredicto sigue diciendo POR QUÉ se habría cortado", () => {
    // Sin el motivo, el aviso interno diría «no pasó nada» y nadie
    // podría revisar si el negocio de verdad está pagando.
    const v = veredicto("paused", { sigueCubierto: true });
    expect(v).toMatchObject({ estado: "protegido", motivo: "cancelada" });
  });

  it("y cuando la suscripción está al día, estar cubierto no cambia nada", () => {
    expect(veredicto("active", { sigueCubierto: true })).toEqual({
      estado: "opera",
      avisoPrevio: false,
    });
  });
});
