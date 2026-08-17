import { describe, expect, it } from "vitest";
import {
  CLAVE_PEDIDO,
  CLAVE_PRODUCTO,
  MONEDA_INVITACIONES,
  PRODUCTO_INVITACION,
  centavosDeColones,
  datosDePagoDeInvitacion,
  decidirCobroDeInvitacion,
  type PedidoInvitacion,
} from "./invitaciones-pagadas";

/**
 * Las pruebas del cobro suelto de una invitación.
 *
 * Todo lo que decide si una invitación queda pagada está acá adentro, y
 * por eso se puede probar sin Stripe y sin base. Lo que se cuida en
 * orden de cuánto cuesta equivocarse:
 *
 *   1. la conversión a céntimos (equivocarse es cobrar 100× de más);
 *   2. no confundir un cobro de Lealtad con uno de invitaciones;
 *   3. no activar nada que Stripe no haya cobrado de verdad;
 *   4. que un monto que no cuadra no pase por bueno.
 */

const PEDIDO = "8b1f0f5e-0000-4000-8000-000000000001";
const SESION = "cs_test_123";

function sesionDePago(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SESION,
    mode: "payment",
    payment_status: "paid",
    amount_total: centavosDeColones(44900),
    currency: MONEDA_INVITACIONES,
    metadata: { [CLAVE_PRODUCTO]: PRODUCTO_INVITACION, [CLAVE_PEDIDO]: PEDIDO },
    ...extra,
  };
}

function pedido(extra: Partial<PedidoInvitacion> = {}): PedidoInvitacion {
  return { id: PEDIDO, montoCrc: 44900, estado: "pendiente_pago", ...extra };
}

describe("centavosDeColones", () => {
  it("el colón lleva dos decimales: ₡44 900 son 4 490 000 céntimos", () => {
    // Si el colón fuera una moneda sin decimales (como el yen), esto
    // tendría que dar 44 900 — y cobraríamos cien veces de menos.
    expect(centavosDeColones(44900)).toBe(4490000);
  });

  it("redondea en vez de arrastrar el error de coma flotante", () => {
    // 12500 * 100 en punto flotante puede dar 1249999.9999…
    expect(centavosDeColones(12500)).toBe(1250000);
    expect(Number.isInteger(centavosDeColones(35880))).toBe(true);
  });
});

describe("datosDePagoDeInvitacion", () => {
  it("lee la sesión de un cobro de invitación", () => {
    const d = datosDePagoDeInvitacion(sesionDePago());
    expect(d).toEqual({
      pedidoId: PEDIDO,
      sesionStripe: SESION,
      cobrado: 4490000,
      moneda: "crc",
      pagado: true,
    });
  });

  it("ignora una sesión SIN la marca: un cobro de Lealtad no es una invitación", () => {
    const lealtad = sesionDePago({ metadata: { plan: "impulso", periodo: "mensual" } });
    expect(datosDePagoDeInvitacion(lealtad)).toBeNull();
  });

  it("ignora una sesión sin metadata del todo", () => {
    expect(datosDePagoDeInvitacion({ id: SESION, mode: "payment" })).toBeNull();
  });

  it("cae al client_reference_id si la metadata perdió el pedido", () => {
    const d = datosDePagoDeInvitacion(
      sesionDePago({
        metadata: { [CLAVE_PRODUCTO]: PRODUCTO_INVITACION },
        client_reference_id: PEDIDO,
      }),
    );
    expect(d?.pedidoId).toBe(PEDIDO);
  });

  it("sin pedido por ningún lado no devuelve nada: no se adivina a quién se le cobró", () => {
    const d = datosDePagoDeInvitacion(
      sesionDePago({ metadata: { [CLAVE_PRODUCTO]: PRODUCTO_INVITACION } }),
    );
    expect(d).toBeNull();
  });

  it("solo `paid` cuenta como cobrado", () => {
    expect(datosDePagoDeInvitacion(sesionDePago({ payment_status: "unpaid" }))?.pagado).toBe(
      false,
    );
    expect(
      datosDePagoDeInvitacion(sesionDePago({ payment_status: "no_payment_required" }))?.pagado,
    ).toBe(false);
  });
});

describe("decidirCobroDeInvitacion", () => {
  it("cobra cuando el monto cobrado es exactamente el del pedido", () => {
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago())!,
      pedido: pedido(),
    });
    expect(v).toEqual({ estado: "cobrar" });
  });

  it("no activa nada mientras Stripe no haya cobrado", () => {
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago({ payment_status: "unpaid" }))!,
      pedido: pedido(),
    });
    expect(v).toEqual({ estado: "ignorar", motivo: "sin_cobrar" });
  });

  it("avisa (no activa) si el pedido no existe", () => {
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago())!,
      pedido: null,
    });
    expect(v).toEqual({ estado: "ignorar", motivo: "sin_pedido" });
  });

  it("no vuelve a cobrar un pedido ya pagado — el segundo evento del mismo cobro", () => {
    for (const estado of ["pagado", "en_diseno", "entregado"]) {
      const v = decidirCobroDeInvitacion({
        pago: datosDePagoDeInvitacion(sesionDePago())!,
        pedido: pedido({ estado }),
      });
      expect(v).toEqual({ estado: "ignorar", motivo: "ya_cobrado" });
    }
  });

  it("un pedido cancelado que igual se pagó NO se resucita: lo mira una persona", () => {
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago())!,
      pedido: pedido({ estado: "cancelado" }),
    });
    expect(v).toEqual({ estado: "ignorar", motivo: "no_cobrable" });
  });

  it("el pedido que ya subió comprobante SÍ se puede pagar con tarjeta", () => {
    // Adjuntó una captura, nadie la revisó todavía y decidió pagar con
    // tarjeta. La plata entra y el pedido se cobra igual.
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago())!,
      pedido: pedido({ estado: "en_revision" }),
    });
    expect(v).toEqual({ estado: "cobrar" });
  });

  it("manda a revisión si se cobró de MENOS", () => {
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago({ amount_total: 1000 }))!,
      pedido: pedido(),
    });
    expect(v.estado).toBe("revisar");
    expect(v.estado === "revisar" && v.motivo).toBe("monto_distinto");
  });

  it("manda a revisión si se cobró de MÁS: tampoco pasa por bueno", () => {
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago({ amount_total: 99900000 }))!,
      pedido: pedido(),
    });
    expect(v.estado).toBe("revisar");
  });

  it("manda a revisión si la moneda no es la del pedido", () => {
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago({ currency: "usd" }))!,
      pedido: pedido(),
    });
    expect(v.estado).toBe("revisar");
    expect(v.estado === "revisar" && v.motivo).toBe("moneda_distinta");
  });

  it("manda a revisión el pedido viejo sin monto guardado: no hay contra qué comparar", () => {
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(sesionDePago())!,
      pedido: pedido({ montoCrc: null }),
    });
    expect(v.estado).toBe("revisar");
    expect(v.estado === "revisar" && v.motivo).toBe("sin_monto");
  });

  it("un cobro que no entró NO se mira contra el monto: primero la plata", () => {
    // El orden importa: si se mirara el monto antes que el
    // `payment_status`, una sesión abandonada con total en cero se
    // reportaría como «monto que no cuadra» en vez de como lo que es.
    const v = decidirCobroDeInvitacion({
      pago: datosDePagoDeInvitacion(
        sesionDePago({ payment_status: "unpaid", amount_total: 0 }),
      )!,
      pedido: pedido(),
    });
    expect(v).toEqual({ estado: "ignorar", motivo: "sin_cobrar" });
  });
});
