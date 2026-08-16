import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hayCredencialesGoogle, validarGoogleOffline } from "./google";

function generarPrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function cuentaDeServicioValida(overrides: Record<string, unknown> = {}) {
  return {
    type: "service_account",
    project_id: "bookea-prueba-123",
    private_key_id: "abc123",
    private_key: generarPrivateKeyPem(),
    client_email: "bookea-pases@bookea-prueba-123.iam.gserviceaccount.com",
    client_id: "111111111111111111111",
    token_uri: "https://oauth2.googleapis.com/token",
    ...overrides,
  };
}

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function env(issuerId: string | undefined, saJson: unknown, envIssuerRaw?: string): Record<string, string | undefined> {
  return {
    GOOGLE_WALLET_ISSUER_ID: envIssuerRaw ?? issuerId,
    GOOGLE_WALLET_SA_KEY_B64: saJson === undefined ? undefined : b64(saJson),
  } as Record<string, string | undefined>;
}

describe("validarGoogleOffline — variables faltantes", () => {
  it("'incompleto' si falta GOOGLE_WALLET_ISSUER_ID", () => {
    const r = validarGoogleOffline(env(undefined, cuentaDeServicioValida()));
    expect(r.estado).toBe("incompleto");
  });

  it("'incompleto' si falta GOOGLE_WALLET_SA_KEY_B64", () => {
    const r = validarGoogleOffline(env("123456789012345678", undefined));
    expect(r.estado).toBe("incompleto");
    expect(r.cuentaDeServicio).toBeNull();
  });

  it("'incompleto' con env vacío", () => {
    const r = validarGoogleOffline({} as Record<string, string | undefined>);
    expect(r.estado).toBe("incompleto");
  });
});

describe("validarGoogleOffline — formato", () => {
  it("'error_formato' si el Issuer ID no es numérico", () => {
    const r = validarGoogleOffline(env("no-es-numerico", cuentaDeServicioValida()));
    expect(r.estado).toBe("error_formato");
  });

  it("'error_formato' si GOOGLE_WALLET_SA_KEY_B64 no decodifica a Base64 válido", () => {
    const conBase64Roto: Record<string, string | undefined> = {
      GOOGLE_WALLET_ISSUER_ID: "123456789012345678",
      GOOGLE_WALLET_SA_KEY_B64: "###no-es-base64###",
    } as Record<string, string | undefined>;
    const r = validarGoogleOffline(conBase64Roto);
    expect(r.estado).toBe("error_formato");
  });

  it("'error_formato' si el contenido decodificado no es JSON", () => {
    const noEsJson: Record<string, string | undefined> = {
      GOOGLE_WALLET_ISSUER_ID: "123456789012345678",
      GOOGLE_WALLET_SA_KEY_B64: Buffer.from("esto no es json", "utf8").toString("base64"),
    } as Record<string, string | undefined>;
    const r = validarGoogleOffline(noEsJson);
    expect(r.estado).toBe("error_formato");
  });

  it("'error_formato' si falta client_email en el JSON", () => {
    const r = validarGoogleOffline(env("123456789012345678", cuentaDeServicioValida({ client_email: undefined })));
    expect(r.estado).toBe("error_formato");
  });

  it("'error_formato' si falta private_key en el JSON", () => {
    const r = validarGoogleOffline(env("123456789012345678", cuentaDeServicioValida({ private_key: undefined })));
    expect(r.estado).toBe("error_formato");
  });

  it("'error_formato' si private_key no tiene forma de PEM válido", () => {
    const r = validarGoogleOffline(env("123456789012345678", cuentaDeServicioValida({ private_key: "no es un PEM" })));
    expect(r.estado).toBe("error_formato");
  });

  it("'error_formato' si client_email no tiene forma de cuenta de servicio", () => {
    const r = validarGoogleOffline(
      env("123456789012345678", cuentaDeServicioValida({ client_email: "cualquiera@gmail.com" })),
    );
    expect(r.estado).toBe("error_formato");
  });
});

describe("validarGoogleOffline — caso válido", () => {
  it("estado 'ok' con Issuer ID numérico y JSON de cuenta de servicio completo", () => {
    const r = validarGoogleOffline(env("123456789012345678", cuentaDeServicioValida()));
    expect(r.estado).toBe("ok");
    expect(r.cuentaDeServicio?.projectId).toBe("bookea-prueba-123");
    expect(r.cuentaDeServicio?.clientEmailPareceValido).toBe(true);
    expect(r.cuentaDeServicio?.privateKeyEsPemValido).toBe(true);
    expect(r.accionesHumanas).toEqual([]);
  });

  it("nunca incluye la llave privada en la respuesta", () => {
    const r = validarGoogleOffline(env("123456789012345678", cuentaDeServicioValida()));
    const json = JSON.stringify(r);
    expect(json).not.toContain("BEGIN PRIVATE KEY");
  });
});

describe("hayCredencialesGoogle", () => {
  it("true cuando las 2 variables están presentes", () => {
    expect(hayCredencialesGoogle(env("123456789012345678", cuentaDeServicioValida()))).toBe(true);
  });
  it("false cuando falta alguna", () => {
    expect(hayCredencialesGoogle(env(undefined, cuentaDeServicioValida()))).toBe(false);
  });
});
