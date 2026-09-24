import { describe, expect, it } from "vitest";
import { PAQUETES_LEGADO } from "@/lib/celebrar/creditos";
import { CLAVE_CREDITOS, CLAVE_DUENO, CLAVE_PAQUETE, CLAVE_PRECIO, PRODUCTO_CELEBRAR_CREDITOS, conceptoDeCompra, datosDePagoDeCreditos, decidirAcreditacion } from "./creditos-pagados";

const DUENO = "a45261b3-d846-40e4-aa14-506d2080be67";
const p250 = PAQUETES_LEGADO.find((p) => p.id === "p250")!;

function sesion(extra: Record<string, unknown> = {}, meta: Record<string, string> = {}): Record<string, unknown> {
  return {
    id: "cs_test_1",
    mode: "payment",
    payment_status: "paid",
    amount_total: p250.precioCRC * 100,
    currency: "crc",
    client_reference_id: DUENO,
    metadata: {
      bookea_producto: PRODUCTO_CELEBRAR_CREDITOS,
      [CLAVE_DUENO]: DUENO,
      [CLAVE_PAQUETE]: p250.id,
      [CLAVE_CREDITOS]: String(p250.creditos),
      [CLAVE_PRECIO]: String(p250.precioCRC),
      ...meta,
    },
    ...extra,
  };
}

describe("datosDePagoDeCreditos", () => {
  it("lee una compra de créditos de CELEBRAR", () => {
    expect(datosDePagoDeCreditos(sesion())).toEqual({
      sesionStripe: "cs_test_1",
      ownerId: DUENO,
      paqueteId: "p250",
      creditos: 250,
      precioEsperadoCrc: p250.precioCRC,
      cobrado: 1_150_000,
      moneda: "crc",
      pagado: true,
    });
  });

  it("ignora una sesión de otro producto (una invitación de Bookea, un plan de Lealtad)", () => {
    expect(datosDePagoDeCreditos(sesion({}, { bookea_producto: "invitacion" }))).toBeNull();
    expect(datosDePagoDeCreditos({ id: "cs", mode: "payment" })).toBeNull();
  });

  it("cae al client_reference_id si la metadata perdió al dueño", () => {
    const s = sesion();
    (s.metadata as Record<string, string>)[CLAVE_DUENO] = "";
    expect(datosDePagoDeCreditos(s)?.ownerId).toBe(DUENO);
  });

  it("sin paquete ni créditos válidos no es una compra", () => {
    expect(datosDePagoDeCreditos(sesion({}, { [CLAVE_CREDITOS]: "abc" }))).toBeNull();
    expect(datosDePagoDeCreditos(sesion({}, { [CLAVE_CREDITOS]: "-5" }))).toBeNull();
  });
});

describe("decidirAcreditacion", () => {
  it("acredita los créditos del paquete con el monto en colones", () => {
    const v = decidirAcreditacion(datosDePagoDeCreditos(sesion())!);
    expect(v).toEqual({ estado: "acreditar", creditos: 250, montoCrc: p250.precioCRC, aviso: null });
  });

  it("un pago que todavía no acreditó no da créditos (llega después como async_payment_succeeded)", () => {
    const v = decidirAcreditacion(datosDePagoDeCreditos(sesion({ payment_status: "unpaid" }))!);
    expect(v).toEqual({ estado: "ignorar", motivo: "sin_cobrar" });
  });

  it("si el monto no cuadra igual acredita —la plata entró— pero avisa", () => {
    const v = decidirAcreditacion(datosDePagoDeCreditos(sesion({ amount_total: 500_000 }))!);
    expect(v.estado).toBe("acreditar");
    if (v.estado === "acreditar") {
      expect(v.creditos).toBe(250);
      expect(v.montoCrc).toBe(5_000);
      expect(v.aviso).toMatch(/valía/);
    }
  });

  it("un paquete que ya no existe acredita lo que decía la sesión y avisa", () => {
    const v = decidirAcreditacion(datosDePagoDeCreditos(sesion({}, { [CLAVE_PAQUETE]: "viejo", [CLAVE_CREDITOS]: "80" }))!);
    expect(v.estado).toBe("acreditar");
    if (v.estado === "acreditar") {
      expect(v.creditos).toBe(80);
      expect(v.aviso).toMatch(/ya no existe/);
    }
  });

  it("un paquete partner se compara contra el precio que viajó en la sesión (su descuento)", () => {
    const s = sesion({ amount_total: 4_000_000 }, { [CLAVE_PAQUETE]: "pp1000", [CLAVE_CREDITOS]: "1000", [CLAVE_PRECIO]: "40000" });
    const v = decidirAcreditacion(datosDePagoDeCreditos(s)!);
    expect(v).toEqual({ estado: "acreditar", creditos: 1000, montoCrc: 40_000, aviso: null });
    const mal = decidirAcreditacion(datosDePagoDeCreditos(sesion({ amount_total: 3_500_000 }, { [CLAVE_PAQUETE]: "pp1000", [CLAVE_CREDITOS]: "1000", [CLAVE_PRECIO]: "40000" }))!);
    expect(mal.estado === "acreditar" && mal.aviso).toMatch(/valía/);
  });

  it("el concepto nombra el paquete", () => {
    expect(conceptoDeCompra(datosDePagoDeCreditos(sesion())!, 250)).toBe("Paquete de 250 créditos (tarjeta)");
  });
});
