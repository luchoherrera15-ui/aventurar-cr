import { describe, expect, it } from "vitest";
import { tokenDeCabecera } from "./servicio";

/**
 * El Web Service de Apple no tiene sesión de usuario: lo llama iOS, y
 * la única credencial es la cabecera `Authorization: ApplePass <token>`.
 * Leerla mal es abrir el pase de cualquiera, así que se prueba el
 * parseo con las formas raras que llegan de verdad.
 */
describe("tokenDeCabecera", () => {
  it("lee el token del formato que manda Apple", () => {
    const pedido = new Request("https://x.test", {
      headers: { authorization: "ApplePass abc123" },
    });
    expect(tokenDeCabecera(pedido)).toBe("abc123");
  });

  it("acepta el esquema en cualquier capitalización", () => {
    for (const esquema of ["ApplePass", "applepass", "APPLEPASS"]) {
      const pedido = new Request("https://x.test", {
        headers: { authorization: `${esquema} tok` },
      });
      expect(tokenDeCabecera(pedido)).toBe("tok");
    }
  });

  it("tolera espacios de más alrededor del token", () => {
    const pedido = new Request("https://x.test", {
      headers: { authorization: "ApplePass    tok   " },
    });
    expect(tokenDeCabecera(pedido)).toBe("tok");
  });

  it("rechaza otros esquemas de autorización", () => {
    for (const cabecera of ["Bearer abc", "Basic abc", "abc", "ApplePassabc"]) {
      const pedido = new Request("https://x.test", {
        headers: { authorization: cabecera },
      });
      expect(tokenDeCabecera(pedido)).toBeNull();
    }
  });

  it("sin cabecera devuelve null en vez de cadena vacía", () => {
    expect(tokenDeCabecera(new Request("https://x.test"))).toBeNull();
  });

  it("un esquema sin token no cuenta como token vacío", () => {
    const pedido = new Request("https://x.test", {
      headers: { authorization: "ApplePass " },
    });
    // Un "" aceptado compararía contra un auth_token vacío y dejaría
    // pasar cualquier pase mal creado.
    expect(tokenDeCabecera(pedido)).toBeNull();
  });
});
