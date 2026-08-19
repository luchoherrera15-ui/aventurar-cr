import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaudeProvider } from "./claude-provider";

/**
 * Nunca pega a la API real: cada test define lo que `fetch` debe
 * devolver y comprueba qué hizo `ClaudeProvider` con eso. El objetivo
 * es fijar el contrato de `ResultadoIA` contra la forma real de la
 * respuesta de Anthropic, para que un cambio futuro (p. ej. al mover
 * esto a un SDK, o al escribir GeminiProvider) tenga con qué compararse.
 */

function mockFetchOk(cuerpo: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(cuerpo),
    text: () => Promise.resolve(JSON.stringify(cuerpo)),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ClaudeProvider.generar", () => {
  it("manda la solicitud a la Messages API con el body y los headers esperados", async () => {
    const fetchMock = mockFetchOk({
      content: [{ type: "text", text: "Hola" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ClaudeProvider("clave-de-prueba");
    await provider.generar({
      modelo: "claude-haiku-4-5",
      maxTokens: 800,
      system: "Sos un asistente.",
      turnos: [{ role: "user", content: "Hola" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "x-api-key": "clave-de-prueba",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: "Sos un asistente.",
      messages: [{ role: "user", content: "Hola" }],
    });
  });

  it("una respuesta exitosa se transforma en outcome success con el texto y el usage", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        content: [
          { type: "text", text: "Primera parte." },
          { type: "text", text: "Segunda parte." },
        ],
        stop_reason: "end_turn",
        usage: {
          input_tokens: 120,
          output_tokens: 45,
          cache_creation_input_tokens: 8,
          cache_read_input_tokens: 3,
        },
      }),
    );

    const resultado = await new ClaudeProvider("k").generar({
      modelo: "claude-haiku-4-5",
      maxTokens: 800,
      system: "s",
      turnos: [{ role: "user", content: "hola" }],
    });

    expect(resultado).toEqual({
      outcome: "success",
      texto: "Primera parte.\nSegunda parte.",
      usage: {
        tokensEntrada: 120,
        tokensSalida: 45,
        tokensCacheEscritura: 8,
        tokensCacheLectura: 3,
      },
    });
  });

  it("ignora bloques de contenido que no son de texto (p. ej. thinking)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        content: [
          { type: "thinking", text: "no debería aparecer" },
          { type: "text", text: "Sí esto." },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );

    const resultado = await new ClaudeProvider("k").generar({
      modelo: "claude-opus-5",
      maxTokens: 8000,
      system: "s",
      turnos: [{ role: "user", content: "hola" }],
    });

    expect(resultado.outcome).toBe("success");
    expect(resultado).toMatchObject({ texto: "Sí esto." });
  });

  it('stop_reason "refusal" se transforma en outcome refused, preservando el usage', async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        content: [],
        stop_reason: "refusal",
        usage: { input_tokens: 50, output_tokens: 0 },
      }),
    );

    const resultado = await new ClaudeProvider("k").generar({
      modelo: "claude-haiku-4-5",
      maxTokens: 800,
      system: "s",
      turnos: [{ role: "user", content: "hola" }],
    });

    expect(resultado).toEqual({
      outcome: "refused",
      usage: {
        tokensEntrada: 50,
        tokensSalida: 0,
        tokensCacheEscritura: 0,
        tokensCacheLectura: 0,
      },
    });
  });

  it('stop_reason "max_tokens" se transforma en outcome max_output, preservando el usage', async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        content: [{ type: "text", text: "corta" }],
        stop_reason: "max_tokens",
        usage: { input_tokens: 700, output_tokens: 800 },
      }),
    );

    const resultado = await new ClaudeProvider("k").generar({
      modelo: "claude-sonnet-5",
      maxTokens: 800,
      system: "s",
      turnos: [{ role: "user", content: "hola" }],
    });

    // "max_tokens" se detecta ANTES de mirar el contenido: aunque haya
    // texto parcial, el outcome es max_output, no success — el texto
    // cortado no es una respuesta utilizable.
    expect(resultado.outcome).toBe("max_output");
    expect(resultado).toMatchObject({
      usage: { tokensEntrada: 700, tokensSalida: 800 },
    });
  });

  it("una respuesta sin ningún bloque de texto se detecta como empty_response, con el stop_reason crudo para diagnóstico", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        content: [],
        stop_reason: "end_turn",
        usage: { input_tokens: 30, output_tokens: 0 },
      }),
    );

    const resultado = await new ClaudeProvider("k").generar({
      modelo: "claude-haiku-4-5",
      maxTokens: 800,
      system: "s",
      turnos: [{ role: "user", content: "hola" }],
    });

    expect(resultado).toEqual({
      outcome: "empty_response",
      detalleProveedor: "end_turn",
      usage: {
        tokensEntrada: 30,
        tokensSalida: 0,
        tokensCacheEscritura: 0,
        tokensCacheLectura: 0,
      },
    });
  });

  it("un texto que es solo espacios en blanco también cuenta como empty_response", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        content: [{ type: "text", text: "   \n  " }],
        stop_reason: "end_turn",
      }),
    );

    const resultado = await new ClaudeProvider("k").generar({
      modelo: "claude-haiku-4-5",
      maxTokens: 800,
      system: "s",
      turnos: [{ role: "user", content: "hola" }],
    });

    expect(resultado.outcome).toBe("empty_response");
  });

  it("una respuesta HTTP no-2xx se transforma en provider_error sin intentar leer usage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('{"error":{"message":"rate limited"}}'),
      }),
    );

    const resultado = await new ClaudeProvider("k").generar({
      modelo: "claude-haiku-4-5",
      maxTokens: 800,
      system: "s",
      turnos: [{ role: "user", content: "hola" }],
    });

    expect(resultado).toEqual({
      outcome: "provider_error",
      mensaje: 'API 429: {"error":{"message":"rate limited"}}',
    });
  });

  it("sin usage en la respuesta, el resultado lleva usage null (nunca inventa ceros)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        content: [{ type: "text", text: "ok" }],
        stop_reason: "end_turn",
      }),
    );

    const resultado = await new ClaudeProvider("k").generar({
      modelo: "claude-haiku-4-5",
      maxTokens: 800,
      system: "s",
      turnos: [{ role: "user", content: "hola" }],
    });

    expect(resultado).toMatchObject({ outcome: "success", usage: null });
  });

  it("un fetch que tira (red caída) propaga la excepción — no la atrapa como provider_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(
      new ClaudeProvider("k").generar({
        modelo: "claude-haiku-4-5",
        maxTokens: 800,
        system: "s",
        turnos: [{ role: "user", content: "hola" }],
      }),
    ).rejects.toThrow("network down");
  });
});
