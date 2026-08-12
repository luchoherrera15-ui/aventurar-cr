import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  certificadoVigente,
  construirManifest,
  firmarManifest,
  type CredencialesPase,
} from "./firma";
import { empaquetarPase } from "./empaquetar";

/**
 * El pase se firma con node-forge porque en Vercel no hay openssl. La
 * prueba de fuego es que la firma que produce sea VERIFICABLE por
 * openssl: si openssl la acepta, el iPhone también.
 *
 * Las credenciales reales no están en el repo, así que se genera un
 * par propio al vuelo. Lo que se prueba es la MECÁNICA de la firma —
 * que sea PKCS#7 detached bien formado— no el certificado de Apple.
 */

function credencialesDePrueba(): CredencialesPase {
  const dir = mkdtempSync(join(tmpdir(), "pase-"));
  try {
    const key = join(dir, "k.pem");
    const cert = join(dir, "c.pem");
    execFileSync("openssl", ["genrsa", "-out", key, "2048"], { stdio: "ignore" });
    execFileSync(
      "openssl",
      [
        "req", "-new", "-x509", "-key", key, "-out", cert, "-days", "2",
        "-subj", "/CN=Prueba Bookea",
      ],
      { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
    );
    const pem = readFileSync(cert, "utf8");
    return {
      certificado: pem,
      llave: readFileSync(key, "utf8"),
      // Se reusa el mismo como "intermedio": acá no se prueba la
      // cadena de Apple, solo que la firma se arme bien.
      wwdr: pem,
      passTypeIdentifier: "pass.lat.bookea.prueba",
      teamIdentifier: "TEAMPRUEBA",
    };
  } finally {
    // El directorio se borra al final del test que lo use.
  }
}

const CRED = credencialesDePrueba();
const HOY = new Date();

describe("construirManifest", () => {
  it("saca el SHA-1 de cada archivo", () => {
    const manifest = JSON.parse(
      construirManifest({ "pass.json": Buffer.from("hola"), "icon.png": Buffer.from("x") }),
    );
    // SHA-1 de "hola", comprobado aparte.
    expect(manifest["pass.json"]).toBe("99800b85d3383e3a2fb45eb7d0066a4879a9dad0");
    expect(Object.keys(manifest)).toEqual(["pass.json", "icon.png"]);
  });

  it("un byte distinto cambia el hash", () => {
    const a = construirManifest({ "pass.json": Buffer.from("hola") });
    const b = construirManifest({ "pass.json": Buffer.from("holA") });
    expect(a).not.toBe(b);
  });
});

describe("firmarManifest", () => {
  it("openssl acepta la firma que produce node-forge", () => {
    const manifest = construirManifest({ "pass.json": Buffer.from('{"a":1}') });
    const firma = firmarManifest(manifest, CRED);

    const dir = mkdtempSync(join(tmpdir(), "verif-"));
    try {
      writeFileSync(join(dir, "manifest.json"), manifest);
      writeFileSync(join(dir, "signature"), firma);
      writeFileSync(join(dir, "cert.pem"), CRED.certificado);

      // -verify sin -noverify comprueba la firma criptográfica contra
      // el contenido: es exactamente lo que hace el iPhone.
      const salida = execFileSync(
        "openssl",
        [
          "smime", "-verify", "-binary", "-inform", "DER",
          "-in", join(dir, "signature"),
          "-content", join(dir, "manifest.json"),
          "-CAfile", join(dir, "cert.pem"),
          "-purpose", "any", "-partial_chain",
          "-out", process.platform === "win32" ? "NUL" : "/dev/null",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      expect(String(salida)).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("la firma es DETACHED — no lleva el manifest adentro", () => {
    const manifest = construirManifest({ "pass.json": Buffer.from('{"marca":"BOOKEA-XYZ"}') });
    const firma = firmarManifest(manifest, CRED);
    // Si el contenido viajara dentro de la firma, esta cadena estaría.
    // Adjuntarlo produce algo que openssl valida y el iPhone rechaza.
    expect(firma.toString("binary")).not.toContain("BOOKEA-XYZ");
  });
});

describe("certificadoVigente", () => {
  it("acepta el certificado dentro de su ventana", () => {
    expect(certificadoVigente(CRED, HOY)).toEqual({ vigente: true });
  });

  it("avisa con fecha cuando ya venció, en vez de fallar al firmar", () => {
    const dentroDeUnAnio = new Date(HOY.getTime() + 365 * 86_400_000);
    const r = certificadoVigente(CRED, dentroDeUnAnio);
    expect(r.vigente).toBe(false);
    if (!r.vigente) expect(r.motivo).toContain("venció");
  });
});

describe("empaquetarPase", () => {
  const archivos = {
    "pass.json": Buffer.from('{"formatVersion":1}'),
    "icon.png": Buffer.from("PNG-falso"),
  };

  it("arma un zip plano con manifest y signature adentro", async () => {
    const pkpass = await empaquetarPase({ archivos, credenciales: CRED, ahora: HOY });
    const zip = await JSZip.loadAsync(pkpass);
    const nombres = Object.keys(zip.files).sort();

    expect(nombres).toEqual(["icon.png", "manifest.json", "pass.json", "signature"]);
    // Sin carpetas: un zip con un directorio adentro no abre en iOS.
    expect(nombres.some((n) => n.includes("/"))).toBe(false);
  });

  it("el manifest del zip cubre los archivos, no a sí mismo", async () => {
    const pkpass = await empaquetarPase({ archivos, credenciales: CRED, ahora: HOY });
    const zip = await JSZip.loadAsync(pkpass);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));

    expect(Object.keys(manifest).sort()).toEqual(["icon.png", "pass.json"]);
    expect(manifest["manifest.json"]).toBeUndefined();
    expect(manifest["signature"]).toBeUndefined();
  });

  it("se planta si falta icon.png, que es el error más difícil de ver", async () => {
    await expect(
      empaquetarPase({
        archivos: { "pass.json": archivos["pass.json"] },
        credenciales: CRED,
        ahora: HOY,
      }),
    ).rejects.toThrow(/icon\.png/);
  });

  it("se planta si el certificado venció, antes de producir nada", async () => {
    const dentroDeUnAnio = new Date(HOY.getTime() + 365 * 86_400_000);
    await expect(
      empaquetarPase({ archivos, credenciales: CRED, ahora: dentroDeUnAnio }),
    ).rejects.toThrow(/venció/);
  });
});
