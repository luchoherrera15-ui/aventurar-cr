import { describe, expect, it } from "vitest";
import { calcularTokenHmac, tokenEsperadoDe, verificarTokenApple, versionHmacVigente } from "./auth-token";

const ENV_V1 = { APPLE_PASS_AUTH_SECRET_V1: "secreto-de-prueba-v1-bien-largo" };
const PASS_TYPE = "pass.test.bookea";
const SERIAL = "11111111-1111-1111-1111-111111111111";

describe("calcularTokenHmac", () => {
  it("es estable: el mismo pase da siempre el mismo token", () => {
    const a = calcularTokenHmac(1, PASS_TYPE, SERIAL, ENV_V1);
    const b = calcularTokenHmac(1, PASS_TYPE, SERIAL, ENV_V1);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("da null si esa versión no tiene secreto configurado", () => {
    expect(calcularTokenHmac(1, PASS_TYPE, SERIAL, {})).toBeNull();
    expect(calcularTokenHmac(2, PASS_TYPE, SERIAL, ENV_V1)).toBeNull(); // solo V1 está seteada
  });

  it("dos seriales distintos dan tokens distintos", () => {
    const a = calcularTokenHmac(1, PASS_TYPE, SERIAL, ENV_V1);
    const b = calcularTokenHmac(1, PASS_TYPE, "22222222-2222-2222-2222-222222222222", ENV_V1);
    expect(a).not.toBe(b);
  });

  it("dos Pass Type ID distintos dan tokens distintos (mismo serial)", () => {
    const a = calcularTokenHmac(1, "pass.uno", SERIAL, ENV_V1);
    const b = calcularTokenHmac(1, "pass.dos", SERIAL, ENV_V1);
    expect(a).not.toBe(b);
  });

  it("nunca incluye el secreto en el token producido", () => {
    const token = calcularTokenHmac(1, PASS_TYPE, SERIAL, ENV_V1)!;
    expect(token).not.toContain(ENV_V1.APPLE_PASS_AUTH_SECRET_V1);
  });
});

describe("versionHmacVigente", () => {
  it("null si no hay ninguna variable APPLE_PASS_AUTH_SECRET_V* configurada", () => {
    expect(versionHmacVigente({})).toBeNull();
  });

  it("encuentra la V1", () => {
    expect(versionHmacVigente(ENV_V1)).toBe(1);
  });

  it("prefiere la versión más ALTA configurada, para que subir de versión sea agregar la variable nueva", () => {
    const env = { ...ENV_V1, APPLE_PASS_AUTH_SECRET_V2: "otro-secreto-bien-largo-tambien" };
    expect(versionHmacVigente(env)).toBe(2);
  });
});

describe("tokenEsperadoDe / verificarTokenApple", () => {
  it("version 0 (legacy): el token esperado es el guardado, tal cual", () => {
    const pase = { passTypeIdentifier: PASS_TYPE, serialNumber: SERIAL, version: 0, tokenLegacyGuardado: "token-guardado-a-mano" };
    expect(tokenEsperadoDe(pase, ENV_V1)).toBe("token-guardado-a-mano");
    expect(verificarTokenApple("token-guardado-a-mano", pase, ENV_V1)).toBe(true);
    expect(verificarTokenApple("otro-token", pase, ENV_V1)).toBe(false);
  });

  it("version 0 sin token legacy guardado: rechaza, nunca acepta un token vacío como válido", () => {
    const pase = { passTypeIdentifier: PASS_TYPE, serialNumber: SERIAL, version: 0, tokenLegacyGuardado: null };
    expect(tokenEsperadoDe(pase, ENV_V1)).toBeNull();
    expect(verificarTokenApple("", pase, ENV_V1)).toBe(false);
  });

  it("version 1: el token esperado se RECALCULA, no se lee de ningún lado guardado", () => {
    const pase = { passTypeIdentifier: PASS_TYPE, serialNumber: SERIAL, version: 1, tokenLegacyGuardado: null };
    const esperado = calcularTokenHmac(1, PASS_TYPE, SERIAL, ENV_V1);
    expect(tokenEsperadoDe(pase, ENV_V1)).toBe(esperado);
    expect(verificarTokenApple(esperado!, pase, ENV_V1)).toBe(true);
    expect(verificarTokenApple("token-incorrecto", pase, ENV_V1)).toBe(false);
  });

  it("version 1 sin secreto configurado: rechaza en vez de aceptar cualquier cosa", () => {
    const pase = { passTypeIdentifier: PASS_TYPE, serialNumber: SERIAL, version: 1, tokenLegacyGuardado: null };
    expect(verificarTokenApple("cualquier-cosa", pase, {})).toBe(false);
  });

  it("un pase version 2 sigue autenticando aunque solo V1 esté vigente para EMITIR pases nuevos — secretos anteriores se mantienen mientras existan pases con esa versión", () => {
    const envConDos = { ...ENV_V1, APPLE_PASS_AUTH_SECRET_V2: "secreto-version-2-bien-largo" };
    const paseV1 = { passTypeIdentifier: PASS_TYPE, serialNumber: SERIAL, version: 1, tokenLegacyGuardado: null };
    const tokenV1 = calcularTokenHmac(1, PASS_TYPE, SERIAL, envConDos)!;
    // Aunque la versión VIGENTE para pases nuevos ya sea la 2, un pase
    // viejo emitido con la 1 se sigue autenticando con su propio secreto.
    expect(versionHmacVigente(envConDos)).toBe(2);
    expect(verificarTokenApple(tokenV1, paseV1, envConDos)).toBe(true);
  });
});
