import { describe, expect, it } from "vitest";
import {
  CANALES_CONSENTIMIENTO,
  VERSION_CONSENTIMIENTO,
  cuerpoDeConsentimientos,
  hashDeToken,
  ipDePeticion,
  ipValida,
  mensajeDeFalloDeAlta,
  normalizarCorreo,
  normalizarTelefonoCR,
  revisarContacto,
  textoConsentimientoNegocio,
} from "./personas";

/**
 * Estas pruebas cuidan LA LÓGICA PURA del alta de dos campos: lo que
 * decide si dos escaneos son la misma señora, qué lee la persona cuando
 * algo sale mal, y que la prueba del consentimiento guarde el texto que
 * de verdad se mostró.
 *
 * El criterio de normalización es el espejo de la 0138 (`normalizar_correo`
 * y `normalizar_telefono`): si un día cambia allá y no acá, la pantalla
 * acepta datos que la base va a rechazar o —peor— va a deduplicar
 * distinto. Los casos de abajo son ese contrato, escrito.
 */

describe("normalizarTelefonoCR — el teléfono tico, como venga", () => {
  it("acepta las formas en que la gente escribe su número", () => {
    // Todas estas son LA MISMA persona, y por eso todas dan lo mismo:
    // es lo que hace que no se le cobre dos veces el asiento del paquete.
    expect(normalizarTelefonoCR("88888888")).toBe("88888888");
    expect(normalizarTelefonoCR("8888-8888")).toBe("88888888");
    expect(normalizarTelefonoCR("8888 8888")).toBe("88888888");
    expect(normalizarTelefonoCR("+506 8888 8888")).toBe("88888888");
    expect(normalizarTelefonoCR("506-8888-8888")).toBe("88888888");
    expect(normalizarTelefonoCR("(506) 8888.8888")).toBe("88888888");
    expect(normalizarTelefonoCR("  +50688888888  ")).toBe("88888888");
  });

  it("un número corto no es un teléfono, es un dedazo", () => {
    expect(normalizarTelefonoCR("8888888")).toBeNull();
    expect(normalizarTelefonoCR("2222")).toBeNull();
    expect(normalizarTelefonoCR("")).toBeNull();
    expect(normalizarTelefonoCR(null)).toBeNull();
    expect(normalizarTelefonoCR(undefined)).toBeNull();
    expect(normalizarTelefonoCR("no tengo")).toBeNull();
  });

  it("se queda con los ÚLTIMOS ocho dígitos, igual que la base", () => {
    // El plan nacional son 8 dígitos: lo que sobra adelante es el
    // código de país que cada quien escribe como quiere.
    expect(normalizarTelefonoCR("0050688776655")).toBe("88776655");
  });
});

describe("normalizarCorreo — deduplicar de verdad", () => {
  it("un correo es el mismo escrito de cualquier manera", () => {
    expect(normalizarCorreo("  Ana@Ejemplo.COM ")).toBe("ana@ejemplo.com");
    expect(normalizarCorreo("ANA@EJEMPLO.COM")).toBe("ana@ejemplo.com");
    expect(normalizarCorreo("ana@ejemplo.com")).toBe("ana@ejemplo.com");
  });

  it("rechaza lo que la base también rechazaría", () => {
    // `position('@' in ...) > 1`: tiene que haber algo antes del arroba.
    expect(normalizarCorreo("@ejemplo.com")).toBeNull();
    expect(normalizarCorreo("sin-arroba")).toBeNull();
    expect(normalizarCorreo("ana ruiz@ejemplo.com")).toBeNull();
    expect(normalizarCorreo("")).toBeNull();
    expect(normalizarCorreo("   ")).toBeNull();
    expect(normalizarCorreo(null)).toBeNull();
  });
});

describe("revisarContacto — el error se ve ANTES de perder el pase", () => {
  it("con los dos datos buenos, devuelve lo normalizado", () => {
    const r = revisarContacto({ correo: " Ana@Ejemplo.com ", telefono: "+506 8888-8888" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.contacto).toEqual({ correo: "ana@ejemplo.com", telefono: "88888888" });
    }
  });

  it("señala el campo exacto y habla como una persona", () => {
    const sinTel = revisarContacto({ correo: "ana@ejemplo.com", telefono: "888" });
    expect(sinTel.ok).toBe(false);
    if (!sinTel.ok) {
      expect(sinTel.campo).toBe("whatsapp");
      expect(sinTel.error).toContain("8 números");
    }

    const malCorreo = revisarContacto({ correo: "ana-ejemplo.com", telefono: "88888888" });
    expect(malCorreo.ok).toBe(false);
    if (!malCorreo.ok) expect(malCorreo.campo).toBe("correo");
  });

  it("el WhatsApp se revisa primero: es el campo que más se equivoca", () => {
    const r = revisarContacto({ correo: "", telefono: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.campo).toBe("whatsapp");
  });

  it("un correo absurdamente largo no llega a la base", () => {
    const r = revisarContacto({
      correo: `${"a".repeat(200)}@ejemplo.com`,
      telefono: "88888888",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.campo).toBe("correo");
  });
});

describe("consentimiento — la prueba dice lo que la persona leyó", () => {
  it("el texto guardado ES el texto de la pantalla, con el nombre del negocio", () => {
    const texto = textoConsentimientoNegocio("Silence Barber");
    expect(texto).toContain("Silence Barber");
    // La 0138 exige al menos 10 caracteres o tira la transacción entera.
    expect(texto.length).toBeGreaterThan(10);

    const cuerpo = cuerpoDeConsentimientos({ nombreNegocio: "Silence Barber", acepta: true });
    expect(cuerpo.negocio.texto).toBe(texto);
  });

  it("guarda también el NO, no solo el sí", () => {
    const cuerpo = cuerpoDeConsentimientos({ nombreNegocio: "Soda La Esquina", acepta: false });
    expect(cuerpo.negocio.acepta).toBe(false);
    // Sin texto, la 0138 aborta: poder probar que la casilla se mostró
    // y quedó sin marcar vale tanto como poder probar que se marcó.
    expect(cuerpo.negocio.texto.length).toBeGreaterThan(10);
  });

  it("viaja con la versión y los canales que la base espera", () => {
    const cuerpo = cuerpoDeConsentimientos({ nombreNegocio: "X", acepta: true });
    expect(cuerpo.version).toBe(VERSION_CONSENTIMIENTO);
    expect(cuerpo.canales).toEqual(CANALES_CONSENTIMIENTO);
    // Los dos canales del formulario, y solo esos: 'sms' no se pide.
    expect([...cuerpo.canales].sort()).toEqual(["correo", "whatsapp"]);
  });

  it("sin nombre de negocio el texto sigue leyéndose bien", () => {
    expect(textoConsentimientoNegocio("   ")).toContain("este negocio");
  });
});

describe("mensajeDeFalloDeAlta — nadie lee un error de Postgres", () => {
  it("una base sin la 0138 ofrece la otra puerta, no un error", () => {
    const m = mensajeDeFalloDeAlta({
      code: "PGRST202",
      message: "Could not find the function public.alta_persona_por_qr",
    });
    expect(m).toContain("Entrá con tu correo");
  });

  it("traduce cada `raise` de la 0138", () => {
    expect(mensajeDeFalloDeAlta({ message: "Esta identidad está bloqueada" })).toContain(
      "bloqueada",
    );
    expect(mensajeDeFalloDeAlta({ message: "El programa no está activo" })).toContain(
      "no está repartiendo pases",
    );
    expect(mensajeDeFalloDeAlta({ message: "El programa abc no existe" })).toContain(
      "Volvé a escanear",
    );
    expect(mensajeDeFalloDeAlta({ message: "Hace falta el WhatsApp o el correo" })).toContain(
      "WhatsApp",
    );
  });

  it("lo desconocido cae en algo que igual dice qué hacer", () => {
    const m = mensajeDeFalloDeAlta({ message: "23505 duplicate key value violates ..." });
    expect(m).toContain("Probá otra vez");
    // Y nunca se filtra la jerga de la base a la pantalla.
    expect(m).not.toContain("duplicate key");
    expect(mensajeDeFalloDeAlta(null).length).toBeGreaterThan(10);
  });
});

describe("ipValida — la IP es prueba, y un dato roto no puede tumbar el alta", () => {
  it("acepta IPs de verdad", () => {
    expect(ipValida("190.7.1.20")).toBe("190.7.1.20");
    expect(ipValida("::1")).toBe("::1");
    expect(ipValida("2801:1b8:c000::1")).toBe("2801:1b8:c000::1");
  });

  it("rechaza lo que `inet` de Postgres tiraría", () => {
    // Este era el valor real que devolvía el helper viejo cuando el
    // proxy no dejaba la IP: mandarlo a una columna `inet` aborta la
    // transacción entera y la persona se queda sin tarjeta.
    expect(ipValida("sin-ip")).toBeNull();
    expect(ipValida("")).toBeNull();
    expect(ipValida("999.1.1.1")).toBeNull();
    expect(ipValida("no.es.una.ip")).toBeNull();
  });

  it("saca la primera IP de x-forwarded-for (la del visitante)", () => {
    const h = new Headers({ "x-forwarded-for": "190.7.1.20, 10.0.0.1, 172.16.0.4" });
    expect(ipDePeticion(h)).toBe("190.7.1.20");
    expect(ipDePeticion(new Headers({ "x-real-ip": "190.7.1.21" }))).toBe("190.7.1.21");
    expect(ipDePeticion(new Headers())).toBeNull();
  });
});

describe("hashDeToken — el token de la cookie nunca se guarda", () => {
  it("es estable y es un sha-256", () => {
    const a = hashDeToken("abc");
    expect(a).toBe(hashDeToken("abc"));
    expect(a).toHaveLength(64);
    expect(a).not.toContain("abc");
    expect(hashDeToken("abd")).not.toBe(a);
  });
});
