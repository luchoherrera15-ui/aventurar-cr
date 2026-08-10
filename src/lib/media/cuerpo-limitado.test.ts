import { describe, expect, it } from "vitest";
import {
  MAX_BYTES_CUERPO,
  enteroDe,
  leerCuerpoLimitado,
  leerJsonLimitado,
  textoDe,
  uuidDe,
} from "./cuerpo-limitado";

/** Un Request cuyo cuerpo llega por trozos, como en la red de verdad. */
function pedido(
  texto: string,
  opciones: { trozo?: number; contentLength?: string; romper?: boolean } = {},
): Request {
  const bytes = new TextEncoder().encode(texto);
  const trozo = opciones.trozo ?? 1024;
  let i = 0;
  const cuerpo = new ReadableStream<Uint8Array>({
    pull(c) {
      if (opciones.romper) {
        c.error(new Error("se cortó la conexión"));
        return;
      }
      if (i >= bytes.length) {
        c.close();
        return;
      }
      c.enqueue(bytes.slice(i, i + trozo));
      i += trozo;
    },
  });
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Se puede declarar un Content-Length que MIENTE, a propósito.
  if (opciones.contentLength !== undefined) headers["content-length"] = opciones.contentLength;
  return new Request("https://bookea.lat/api/media/sesion", {
    method: "POST",
    headers,
    body: cuerpo,
    // @ts-expect-error duplex es obligatorio en Node para un body stream
    duplex: "half",
  });
}

describe("el tope de 8 KiB", () => {
  it("es 8192 bytes", () => {
    expect(MAX_BYTES_CUERPO).toBe(8192);
  });

  it("un cuerpo normal pasa", async () => {
    const r = await leerCuerpoLimitado(pedido('{"a":1}'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBe('{"a":1}');
  });

  it("justo en el tope pasa", async () => {
    const r = await leerCuerpoLimitado(pedido("x".repeat(MAX_BYTES_CUERPO)));
    expect(r.ok).toBe(true);
  });

  it("un byte por encima → 413", async () => {
    const r = await leerCuerpoLimitado(pedido("x".repeat(MAX_BYTES_CUERPO + 1)));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("muy-grande");
      expect(r.error.http).toBe(413);
    }
  });

  it("corta aunque el cuerpo llegue en trozos chicos", async () => {
    const r = await leerCuerpoLimitado(pedido("x".repeat(50_000), { trozo: 64 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.http).toBe(413);
  });

  it("un Content-Length que MIENTE no engaña: manda lo leído", async () => {
    // Declara 10 bytes y manda 50 000. Un chequeo de la cabecera lo
    // habría dejado pasar y después habría leído los 50 000 igual.
    const r = await leerCuerpoLimitado(
      pedido("x".repeat(50_000), { contentLength: "10", trozo: 4096 }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("muy-grande");
  });

  it("sin Content-Length también funciona", async () => {
    const r = await leerCuerpoLimitado(pedido('{"a":1}', { contentLength: undefined }));
    expect(r.ok).toBe(true);
  });

  it("cuerpo vacío → 400", async () => {
    const r = await leerCuerpoLimitado(pedido(""));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("vacio");
  });

  it("sin cuerpo → 400", async () => {
    const req = new Request("https://bookea.lat/x", { method: "POST" });
    const r = await leerCuerpoLimitado(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("vacio");
  });

  it("un stream que se corta → 400, no una excepción", async () => {
    const r = await leerCuerpoLimitado(pedido("algo", { romper: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("ilegible");
  });
});

describe("leerJsonLimitado", () => {
  it("devuelve el objeto", async () => {
    const r = await leerJsonLimitado(pedido('{"solicitudId":"x","bytes":5}'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.bytes).toBe(5);
  });

  it("JSON inválido → 400", async () => {
    const r = await leerJsonLimitado(pedido("{no es json"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("json-invalido");
  });

  it("un array o un número NO son un cuerpo utilizable", async () => {
    for (const t of ["[1,2,3]", "42", '"texto"', "null"]) {
      const r = await leerJsonLimitado(pedido(t));
      expect(r.ok, t).toBe(false);
      if (!r.ok) expect(r.error.codigo).toBe("json-invalido");
    }
  });

  it("el tope se aplica ANTES de parsear", async () => {
    const enorme = '{"a":"' + "x".repeat(20_000) + '"}';
    const r = await leerJsonLimitado(pedido(enorme));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("muy-grande");
  });
});

describe("validadores de campo", () => {
  it("uuidDe acepta uuids y rechaza el resto", () => {
    expect(uuidDe("11111111-1111-4111-8111-111111111111")).not.toBe(null);
    for (const v of ["", "no", 42, null, "11111111-1111-4111-8111-11111111111"]) {
      expect(uuidDe(v), String(v)).toBe(null);
    }
  });

  it("enteroDe respeta el rango y rechaza NaN/Infinity/decimales", () => {
    expect(enteroDe(5, 1, 10)).toBe(5);
    expect(enteroDe(1, 1, 10)).toBe(1);
    expect(enteroDe(10, 1, 10)).toBe(10);
    for (const v of [0, 11, 1.5, NaN, Infinity, -Infinity, "5", null]) {
      expect(enteroDe(v, 1, 10), String(v)).toBe(null);
    }
  });

  it("textoDe recorta y acota", () => {
    expect(textoDe("  hola  ", 10)).toBe("hola");
    expect(textoDe("   ", 10)).toBe(null);
    expect(textoDe("x".repeat(11), 10)).toBe(null);
    expect(textoDe(42, 10)).toBe(null);
  });
});
