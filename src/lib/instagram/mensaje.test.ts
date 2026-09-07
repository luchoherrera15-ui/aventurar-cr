import { describe, expect, it } from "vitest";
import { armarMensajePrivado, bytesUtf8, validarEnlace, validarMensajePrivado, validarMensajePublico } from "./mensaje";

describe("validarEnlace — solo https a un dominio público", () => {
  it("acepta la página de Linksy y cualquier https normal", () => {
    expect(validarEnlace("https://linksy.lat/cafe-aroma")).toEqual({ ok: true, url: "https://linksy.lat/cafe-aroma" });
    expect(validarEnlace("  https://www.bookea.lat/s/x?mesa=2 ")).toEqual({ ok: true, url: "https://www.bookea.lat/s/x?mesa=2" });
  });
  it("rechaza http, esquemas raros, credenciales, IPs, localhost y hosts internos", () => {
    for (const malo of [
      "http://linksy.lat/x",
      "ftp://linksy.lat",
      "javascript:alert(1)",
      "https://user:pass@linksy.lat",
      "https://127.0.0.1/",
      "https://10.0.0.5/panel",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/",
      "https://localhost:3100/",
      "https://intranet.local/",
      "https://sin-tld",
      "no es una url",
      "",
    ]) {
      expect(validarEnlace(malo).ok, malo).toBe(false);
    }
  });
});

describe("el mensaje privado", () => {
  it("arma mensaje + enlace en líneas separadas; sin enlace, solo el mensaje", () => {
    expect(armarMensajePrivado("¡Hola! 👋", "https://linksy.lat/x")).toBe("¡Hola! 👋\n\nhttps://linksy.lat/x");
    expect(armarMensajePrivado("  Hola  ", null)).toBe("Hola");
  });
  it("valida y devuelve el texto listo", () => {
    const v = validarMensajePrivado("Gracias por escribirnos. Acá tenés los precios:", "https://linksy.lat/cafe");
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.texto).toBe("Gracias por escribirnos. Acá tenés los precios:\n\nhttps://linksy.lat/cafe");
      expect(v.enlace).toBe("https://linksy.lat/cafe");
    }
  });
  it("respeta el tope de 1000 bytes de Instagram (contando emojis en UTF-8)", () => {
    expect(bytesUtf8("👋")).toBe(4);
    const largo = "a".repeat(790);
    expect(validarMensajePrivado(largo, "https://linksy.lat/" + "b".repeat(220)).ok).toBe(false);
    expect(validarMensajePrivado(largo, "https://linksy.lat/x").ok).toBe(true);
  });
  it("mensaje vacío o demasiado largo, y enlace inválido, se rechazan con motivo", () => {
    expect(validarMensajePrivado("", null).ok).toBe(false);
    expect(validarMensajePrivado("x".repeat(801), null).ok).toBe(false);
    expect(validarMensajePrivado("Hola", "http://x.com").ok).toBe(false);
  });
  it("la respuesta pública solo mira el largo", () => {
    expect(validarMensajePublico("¡Te escribimos por DM! 👋").ok).toBe(true);
    expect(validarMensajePublico("").ok).toBe(false);
    expect(validarMensajePublico("x".repeat(301)).ok).toBe(false);
  });
});
