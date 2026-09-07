import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { cifrar, claveDesdeTexto, descifrar } from "./cifrado";

const CLAVE = randomBytes(32);

describe("cifrado de tokens (AES-256-GCM)", () => {
  it("ida y vuelta", () => {
    const blob = cifrar("IGQVJ...token-largo", CLAVE);
    expect(blob.startsWith("v1.")).toBe(true);
    expect(blob).not.toContain("IGQVJ");
    expect(descifrar(blob, CLAVE)).toBe("IGQVJ...token-largo");
  });

  it("dos cifrados del mismo texto son distintos (IV nuevo cada vez)", () => {
    expect(cifrar("x", CLAVE)).not.toBe(cifrar("x", CLAVE));
  });

  it("un byte cambiado no descifra a basura: falla", () => {
    const blob = cifrar("secreto", CLAVE);
    const partes = blob.split(".");
    const datos = Buffer.from(partes[3], "base64url");
    datos[0] ^= 0xff;
    partes[3] = datos.toString("base64url");
    expect(descifrar(partes.join("."), CLAVE)).toBeNull();
  });

  it("con otra clave no descifra", () => {
    expect(descifrar(cifrar("secreto", CLAVE), randomBytes(32))).toBeNull();
  });

  it("basura, versión desconocida o vacío: null, sin lanzar", () => {
    expect(descifrar("", CLAVE)).toBeNull();
    expect(descifrar("v9.a.b.c", CLAVE)).toBeNull();
    expect(descifrar("no-es-un-blob", CLAVE)).toBeNull();
  });

  it("la clave se acepta en hex de 64 o base64 de 32 bytes, y nada más", () => {
    expect(claveDesdeTexto(CLAVE.toString("hex"))?.equals(CLAVE)).toBe(true);
    expect(claveDesdeTexto(CLAVE.toString("base64"))?.equals(CLAVE)).toBe(true);
    expect(claveDesdeTexto("corta")).toBeNull();
    expect(claveDesdeTexto("")).toBeNull();
    expect(claveDesdeTexto(undefined)).toBeNull();
  });

  it("una clave que no es de 32 bytes no cifra", () => {
    expect(() => cifrar("x", randomBytes(16))).toThrow();
  });
});
