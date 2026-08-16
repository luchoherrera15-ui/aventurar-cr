import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { hayCredencialesApple, validarApple } from "./apple";

/**
 * Los certificados de prueba se generan con node-forge (no con openssl,
 * a diferencia de firma.test.ts) porque acá hace falta control fino
 * sobre los CAMPOS del subject (UID = Pass Type ID, OU = Team ID) — el
 * alias "UID" de `openssl req -subj` no es portable entre versiones de
 * OpenSSL, y este archivo no puede depender de eso para ser confiable.
 */

const PASS_TYPE_ID = "pass.test.bookea.prueba";
const TEAM_ID = "TEAMPRUEBA1";

function generarPar() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  return keys;
}

function crearCA() {
  const keys = generarPar();
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 365 * 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const attrs = [
    { name: "commonName", value: "Prueba WWDR" },
    { name: "organizationName", value: "Prueba Apple" },
    { shortName: "OU", value: "G0" },
    { shortName: "C", value: "US" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, keys };
}

function crearCertificadoDePase(opts: {
  ca: { cert: forge.pki.Certificate; keys: forge.pki.rsa.KeyPair };
  passTypeId?: string;
  teamId?: string;
  vencido?: boolean;
  llaveDistinta?: boolean;
}) {
  const keys = generarPar();
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "02";
  cert.validity.notBefore = new Date(Date.now() - 30 * 86_400_000);
  cert.validity.notAfter = opts.vencido
    ? new Date(Date.now() - 1 * 86_400_000)
    : new Date(Date.now() + 365 * 86_400_000);

  cert.setSubject([
    { type: "0.9.2342.19200300.100.1.1", value: opts.passTypeId ?? PASS_TYPE_ID },
    { shortName: "CN", value: `Pass Type ID: ${opts.passTypeId ?? PASS_TYPE_ID}` },
    { shortName: "OU", value: opts.teamId ?? TEAM_ID },
    { shortName: "O", value: "Prueba Bookea" },
    { shortName: "C", value: "US" },
  ]);
  cert.setIssuer(opts.ca.cert.subject.attributes);
  cert.sign(opts.ca.keys.privateKey, forge.md.sha256.create());

  const llaveParaExportar = opts.llaveDistinta ? generarPar().privateKey : keys.privateKey;

  return {
    certificadoPem: forge.pki.certificateToPem(cert),
    llavePem: forge.pki.privateKeyToPem(llaveParaExportar),
  };
}

function b64(pem: string): string {
  return Buffer.from(pem, "utf8").toString("base64");
}

function envCompleto(overrides: Partial<Record<string, string | undefined>> = {}): Record<string, string | undefined> {
  const ca = crearCA();
  const pase = crearCertificadoDePase({ ca });
  return {
    APPLE_PASS_CERT_B64: b64(pase.certificadoPem),
    APPLE_PASS_KEY_B64: b64(pase.llavePem),
    APPLE_WWDR_CERT_B64: b64(forge.pki.certificateToPem(ca.cert)),
    APPLE_PASS_TYPE_ID: PASS_TYPE_ID,
    APPLE_TEAM_ID: TEAM_ID,
    ...overrides,
  } as Record<string, string | undefined>;
}

describe("validarApple — variables faltantes", () => {
  it("estado 'incompleto' si falta cualquiera de las 5", () => {
    const env = envCompleto({ APPLE_TEAM_ID: undefined });
    const r = validarApple(env);
    expect(r.estado).toBe("incompleto");
    expect(r.profundidad).toBeNull();
    expect(r.accionesHumanas.some((a) => a.includes("APPLE_TEAM_ID"))).toBe(true);
  });

  it("estado 'incompleto' con env completamente vacío", () => {
    const r = validarApple({} as Record<string, string | undefined>);
    expect(r.estado).toBe("incompleto");
    expect(r.variables.every((v) => !v.presente)).toBe(true);
  });
});

describe("validarApple — formato", () => {
  it("estado 'error_formato' si APPLE_PASS_CERT_B64 no es Base64 válido", () => {
    const env = envCompleto({ APPLE_PASS_CERT_B64: "###no-es-base64###" });
    const r = validarApple(env);
    expect(r.estado).toBe("error_formato");
  });

  it("estado 'error_formato' si el PEM decodificado está truncado", () => {
    const env = envCompleto({ APPLE_PASS_CERT_B64: b64("-----BEGIN CERTIFICATE-----\nMIIB\n") });
    const r = validarApple(env);
    expect(r.estado).toBe("error_formato");
  });
});

describe("validarApple — validación profunda con certificados reales", () => {
  it("estado 'ok' cuando certificado, llave, WWDR, Pass Type ID y Team ID corresponden entre sí", () => {
    const r = validarApple(envCompleto());
    expect(r.estado).toBe("ok");
    expect(r.profundidad?.certificadoVsLlave.ok).toBe(true);
    expect(r.profundidad?.certificadoVsPassTypeId.ok).toBe(true);
    expect(r.profundidad?.certificadoVsTeamId.ok).toBe(true);
    expect(r.profundidad?.cadenaCertificadoWwdr.ok).toBe(true);
    expect(r.profundidad?.vigencia.ok).toBe(true);
    expect(r.profundidad?.firmaDePrueba.ok).toBe(true);
    expect(r.accionesHumanas).toEqual([]);
  });

  it("nunca incluye el PEM del certificado ni de la llave en la respuesta", () => {
    const r = validarApple(envCompleto());
    const json = JSON.stringify(r);
    expect(json).not.toContain("BEGIN CERTIFICATE");
    expect(json).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(json).not.toContain("BEGIN PRIVATE KEY");
  });

  it("detecta que el certificado y la llave NO corresponden entre sí", () => {
    const ca = crearCA();
    const pase = crearCertificadoDePase({ ca, llaveDistinta: true });
    const env = envCompleto();
    env.APPLE_PASS_CERT_B64 = b64(pase.certificadoPem);
    env.APPLE_PASS_KEY_B64 = b64(pase.llavePem);
    const r = validarApple(env);
    expect(r.estado).toBe("error_formato");
    expect(r.profundidad?.certificadoVsLlave.ok).toBe(false);
  });

  it("detecta que el certificado NO corresponde al APPLE_PASS_TYPE_ID declarado", () => {
    const ca = crearCA();
    const pase = crearCertificadoDePase({ ca, passTypeId: "pass.otro.negocio" });
    const env = envCompleto();
    env.APPLE_PASS_CERT_B64 = b64(pase.certificadoPem);
    env.APPLE_PASS_KEY_B64 = b64(pase.llavePem);
    const r = validarApple(env);
    expect(r.estado).toBe("error_formato");
    expect(r.profundidad?.certificadoVsPassTypeId.ok).toBe(false);
    expect(r.accionesHumanas.some((a) => a.includes("pass.otro.negocio"))).toBe(true);
  });

  it("detecta que el certificado NO corresponde al APPLE_TEAM_ID declarado", () => {
    const ca = crearCA();
    const pase = crearCertificadoDePase({ ca, teamId: "OTROEQUIPO0" });
    const env = envCompleto();
    env.APPLE_PASS_CERT_B64 = b64(pase.certificadoPem);
    env.APPLE_PASS_KEY_B64 = b64(pase.llavePem);
    const r = validarApple(env);
    expect(r.estado).toBe("error_formato");
    expect(r.profundidad?.certificadoVsTeamId.ok).toBe(false);
  });

  it("detecta un certificado VENCIDO y da la fecha exacta", () => {
    const ca = crearCA();
    const pase = crearCertificadoDePase({ ca, vencido: true });
    const env = envCompleto();
    env.APPLE_PASS_CERT_B64 = b64(pase.certificadoPem);
    env.APPLE_PASS_KEY_B64 = b64(pase.llavePem);
    const r = validarApple(env);
    expect(r.estado).toBe("error_formato");
    expect(r.profundidad?.vigencia.ok).toBe(false);
    expect(r.profundidad?.vigencia.motivo).toMatch(/venció/);
  });

  it("detecta una cadena WWDR que NO firmó el certificado del pase", () => {
    const caReal = crearCA();
    const caImpostora = crearCA();
    const pase = crearCertificadoDePase({ ca: caReal });
    const env = envCompleto();
    env.APPLE_PASS_CERT_B64 = b64(pase.certificadoPem);
    env.APPLE_PASS_KEY_B64 = b64(pase.llavePem);
    env.APPLE_WWDR_CERT_B64 = b64(forge.pki.certificateToPem(caImpostora.cert));
    const r = validarApple(env);
    expect(r.estado).toBe("error_formato");
    expect(r.profundidad?.cadenaCertificadoWwdr.ok).toBe(false);
  });
});

describe("hayCredencialesApple", () => {
  it("true cuando las 5 variables están presentes, sin importar el formato", () => {
    expect(hayCredencialesApple(envCompleto())).toBe(true);
  });
  it("false cuando falta alguna", () => {
    expect(hayCredencialesApple(envCompleto({ APPLE_WWDR_CERT_B64: undefined }))).toBe(false);
  });
  it("false con env vacío", () => {
    expect(hayCredencialesApple({} as Record<string, string | undefined>)).toBe(false);
  });
});
