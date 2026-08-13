import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { sitioBase, stripeDelEntorno, verificarEventoStripe } from "./stripe";

/**
 * LA FIRMA ES LA ÚNICA PUERTA.
 *
 * Este endpoint es público: su URL está escrita en el panel de Stripe
 * y en docs/stripe.md. Lo único que separa un evento de Stripe de uno
 * que armó cualquiera con `curl` —y que activaría el paquete de $89—
 * es esta verificación.
 *
 * Los eventos de acá se firman de verdad, con el mismo HMAC que usa
 * Stripe (`generateTestHeaderString` es la utilidad que el propio SDK
 * trae para esto). No hay ningún mock: si `verificarEventoStripe` se
 * rompiera, estos tests se caen.
 */

const SECRETO = "whsec_prueba_de_bookea_0143";
const CUERPO = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_1", mode: "subscription", subscription: "sub_1" } },
});

function firmar(cuerpo: string, secreto = SECRETO): string {
  return Stripe.webhooks.generateTestHeaderString({ payload: cuerpo, secret: secreto });
}

describe("verificarEventoStripe · lo que SÍ pasa", () => {
  it("un cuerpo firmado con el secreto correcto devuelve el evento", () => {
    const evento = verificarEventoStripe(CUERPO, firmar(CUERPO), SECRETO);
    expect(evento?.id).toBe("evt_1");
    expect(evento?.type).toBe("checkout.session.completed");
  });
});

describe("verificarEventoStripe · todo lo demás se rechaza", () => {
  it("firma inválida (secreto distinto) → null", () => {
    const firma = firmar(CUERPO, "whsec_otro_secreto_cualquiera");
    expect(verificarEventoStripe(CUERPO, firma, SECRETO)).toBeNull();
  });

  it("cuerpo alterado después de firmar → null", () => {
    // El caso que importa: alguien intercepta un evento legítimo y le
    // cambia el negocio o el precio. La firma es sobre los BYTES.
    const firma = firmar(CUERPO);
    const alterado = CUERPO.replace("sub_1", "sub_del_atacante");
    expect(verificarEventoStripe(alterado, firma, SECRETO)).toBeNull();
  });

  it("el mismo JSON re-serializado tampoco pasa — por eso el cuerpo va CRUDO", () => {
    // `req.json()` y volver a `JSON.stringify` produce un JSON
    // equivalente pero distinto byte a byte. Es EL error clásico de
    // este endpoint: la firma no valida nunca y el síntoma no apunta
    // para nada al parseo.
    const firma = firmar(CUERPO);
    const reserializado = JSON.stringify(JSON.parse(CUERPO), null, 2);
    expect(reserializado).not.toBe(CUERPO);
    expect(verificarEventoStripe(reserializado, firma, SECRETO)).toBeNull();
  });

  it("sin cabecera de firma → null", () => {
    expect(verificarEventoStripe(CUERPO, null, SECRETO)).toBeNull();
    expect(verificarEventoStripe(CUERPO, "", SECRETO)).toBeNull();
  });

  it("sin secreto configurado en el servidor → null, no se procesa nada", () => {
    // Un servidor sin STRIPE_WEBHOOK_SECRET no puede distinguir un
    // evento real de uno inventado. Ante eso, no se acepta ninguno.
    expect(verificarEventoStripe(CUERPO, firmar(CUERPO), undefined)).toBeNull();
    expect(verificarEventoStripe(CUERPO, firmar(CUERPO), "")).toBeNull();
    expect(verificarEventoStripe(CUERPO, firmar(CUERPO), "   ")).toBeNull();
  });

  it("una firma con formato basura no lanza, devuelve null", () => {
    expect(verificarEventoStripe(CUERPO, "esto no es una firma", SECRETO)).toBeNull();
    expect(verificarEventoStripe("", "t=1,v1=abc", SECRETO)).toBeNull();
  });

  it("un evento viejo (fuera de la tolerancia de 5 minutos) → null", () => {
    // Frena el replay de un evento capturado.
    const hace10min = Math.floor(Date.now() / 1000) - 600;
    const firma = Stripe.webhooks.generateTestHeaderString({
      payload: CUERPO,
      secret: SECRETO,
      timestamp: hace10min,
    });
    expect(verificarEventoStripe(CUERPO, firma, SECRETO)).toBeNull();
  });
});

describe("sin llaves, nada explota", () => {
  it("sin STRIPE_SECRET_KEY el cliente es null y el SINPE sigue disponible", () => {
    const guardado = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      // Mismo patrón que `credencialesGoogleDelEntorno()`: sin llave no
      // se lanza, se devuelve null y el botón ni se dibuja.
      expect(stripeDelEntorno()).toBeNull();
    } finally {
      if (guardado !== undefined) process.env.STRIPE_SECRET_KEY = guardado;
    }
  });

  it("la verificación de firma NO depende de la llave secreta", () => {
    // A propósito: un servidor al que le falte STRIPE_SECRET_KEY tiene
    // que seguir rechazando bien lo que no viene de Stripe.
    const guardado = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      expect(verificarEventoStripe(CUERPO, firmar(CUERPO), SECRETO)?.id).toBe("evt_1");
    } finally {
      if (guardado !== undefined) process.env.STRIPE_SECRET_KEY = guardado;
    }
  });
});

describe("sitioBase", () => {
  it("nunca deja una barra al final (las URLs se arman pegando)", () => {
    expect(sitioBase().endsWith("/")).toBe(false);
    expect(sitioBase().startsWith("http")).toBe(true);
  });
});
