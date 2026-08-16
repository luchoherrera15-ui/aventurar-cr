import { describe, expect, it } from "vitest";
import {
  detectarTipoContenido,
  diagnosticarBase64,
  normalizarSaltosDeLineaLiterales,
  validarEstructuraPem,
} from "./base64";

const PEM_DE_PRUEBA =
  "-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQA=\n-----END CERTIFICATE-----\n";
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

describe("diagnosticarBase64", () => {
  it("decodifica un valor Base64 simple sin advertencias", () => {
    const r = diagnosticarBase64(b64("hola mundo"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.decodificado.toString("utf8")).toBe("hola mundo");
      expect(r.advertencias).toEqual([]);
    }
  });

  it("acepta relleno con un solo '=' y no lo recorta", () => {
    const original = "hola!"; // 5 bytes (5 mod 3 = 2) -> base64 con un '=' de relleno
    const codificado = b64(original);
    expect(codificado.endsWith("=")).toBe(true);
    const r = diagnosticarBase64(codificado);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.decodificado.toString("utf8")).toBe(original);
  });

  it("acepta relleno con '==' y no lo recorta", () => {
    const original = "hola"; // 4 bytes -> base64 con '==' de relleno
    const codificado = b64(original);
    expect(codificado.endsWith("==")).toBe(true);
    const r = diagnosticarBase64(codificado);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.decodificado.toString("utf8")).toBe(original);
  });

  it("recorta espacios y saltos de línea accidentales, y lo reporta", () => {
    const codificado = b64(PEM_DE_PRUEBA);
    const conEspacios = codificado.slice(0, 10) + "\n  " + codificado.slice(10);
    const r = diagnosticarBase64(conEspacios);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.decodificado.toString("utf8")).toBe(PEM_DE_PRUEBA);
      expect(r.advertencias).toContain("espacios_o_saltos_de_linea");
    }
  });

  it("recorta retornos de carro (\\r) de Windows y lo reporta", () => {
    const codificado = b64("contenido");
    const conCr = codificado.slice(0, 4) + "\r" + codificado.slice(4);
    const r = diagnosticarBase64(conCr);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.advertencias).toContain("retorno_de_carro");
  });

  it("recorta comillas envolventes (dobles) y lo reporta", () => {
    const codificado = b64("secreto");
    const r = diagnosticarBase64(`"${codificado}"`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.decodificado.toString("utf8")).toBe("secreto");
      expect(r.advertencias).toContain("comillas_envolventes");
    }
  });

  it("recorta comillas envolventes (simples) y lo reporta", () => {
    const codificado = b64("secreto");
    const r = diagnosticarBase64(`'${codificado}'`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.advertencias).toContain("comillas_envolventes");
  });

  it("rechaza un valor vacío", () => {
    expect(diagnosticarBase64("").ok).toBe(false);
    expect(diagnosticarBase64(undefined).ok).toBe(false);
    expect(diagnosticarBase64(null).ok).toBe(false);
  });

  it("rechaza un valor truncado (longitud no múltiplo de 4 en Base64 estándar)", () => {
    const codificado = b64("contenido de prueba mas largo");
    const truncado = codificado.slice(0, -3);
    const r = diagnosticarBase64(truncado);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/truncado|múltiplo de 4/);
  });

  it("detecta caracteres fuera del alfabeto Base64 (prefijo/sufijo pegado por error)", () => {
    const codificado = b64("contenido");
    const r = diagnosticarBase64(`data:base64,${codificado}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/posición/);
  });

  it("decodifica Base64 URL-safe (- y _) y lo marca", () => {
    const original = Buffer.from([0xfb, 0xff, 0xfe]); // produce +/ en estándar
    const urlSafe = original.toString("base64url");
    const r = diagnosticarBase64(urlSafe);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.decodificado.equals(original)).toBe(true);
      expect(r.advertencias).toContain("base64_url_safe");
    }
  });

  it("rechaza un valor que mezcla caracteres estándar y URL-safe", () => {
    const r = diagnosticarBase64("abc+def-ghi_jkl/mno=");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/mezcla/);
  });

  it("detecta el tipo de contenido PEM", () => {
    const r = diagnosticarBase64(b64(PEM_DE_PRUEBA));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tipoContenido).toBe("PEM");
  });

  it("detecta el tipo de contenido JSON", () => {
    const r = diagnosticarBase64(b64(JSON.stringify({ a: 1 })));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tipoContenido).toBe("JSON");
  });

  it("marca posible doble codificación cuando el resultado decodificado es a su vez Base64", () => {
    const doble = b64(b64("contenido con suficiente longitud para no dar falso positivo"));
    const r = diagnosticarBase64(doble);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.advertencias).toContain("posible_doble_codificacion");
  });
});

describe("detectarTipoContenido", () => {
  it("reconoce un PEM por su encabezado", () => {
    expect(detectarTipoContenido(Buffer.from(PEM_DE_PRUEBA))).toBe("PEM");
  });
  it("reconoce un objeto JSON", () => {
    expect(detectarTipoContenido(Buffer.from('{"client_email":"x"}'))).toBe("JSON");
  });
  it("no confunde texto plano con JSON ni PEM", () => {
    expect(detectarTipoContenido(Buffer.from("esto no es nada reconocible"))).toBe("desconocido");
  });
});

describe("validarEstructuraPem", () => {
  it("acepta un PEM bien formado con saltos de línea REALES", () => {
    const r = validarEstructuraPem(PEM_DE_PRUEBA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tipo).toBe("CERTIFICATE");
  });

  it("rechaza un valor sin ningún encabezado BEGIN", () => {
    const r = validarEstructuraPem("esto no tiene forma de PEM");
    expect(r.ok).toBe(false);
  });

  it("rechaza un PEM con BEGIN sin su END (truncado)", () => {
    const r = validarEstructuraPem("-----BEGIN CERTIFICATE-----\nMIIB\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/incompleto|truncado/);
  });

  it("rechaza un PEM donde el BEGIN y el END no coinciden", () => {
    const r = validarEstructuraPem(
      "-----BEGIN CERTIFICATE-----\nMIIB\n-----END PRIVATE KEY-----\n",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/abre como/);
  });
});

describe("normalizarSaltosDeLineaLiterales", () => {
  it("convierte saltos de línea LITERALES (\\n de dos caracteres) a saltos reales", () => {
    const literal = "-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----";
    const normalizado = normalizarSaltosDeLineaLiterales(literal);
    expect(normalizado).toBe("-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----");
  });

  it("NO toca un valor que ya tiene saltos de línea reales", () => {
    // Si ya vinieran saltos reales, "corregir" una subcadena \n literal
    // que apareciera dentro de un comentario del propio PEM sería un bug.
    const conSaltosReales = "línea1\nlínea2\\nno-tocar";
    expect(normalizarSaltosDeLineaLiterales(conSaltosReales)).toBe(conSaltosReales);
  });

  it("no cambia un valor sin ningún \\n literal", () => {
    expect(normalizarSaltosDeLineaLiterales("sin saltos de ningún tipo")).toBe("sin saltos de ningún tipo");
  });
});
