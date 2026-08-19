import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Nunca pega a la API real: se mockea `@google/genai` entero, pero
 * reexportando las clases/enums REALES (`ApiError`, `FinishReason`)
 * — son solo tipos y constantes, no hacen red, y usarlos de verdad
 * evita que el test se invente su propia versión de "cómo se ve un
 * ApiError" separada de la que el SDK realmente lanza.
 */
const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock("@google/genai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@google/genai")>();
  return {
    ...real,
    // Función normal, no arrow: el provider hace `new GoogleGenAI(...)`,
    // y una implementación arrow no se puede invocar con `new`.
    GoogleGenAI: vi.fn().mockImplementation(function () {
      return { models: { generateContent: generateContentMock } };
    }),
  };
});

const { ApiError, FinishReason } = await import("@google/genai");
const { GeminiProvider } = await import("./gemini-provider");

afterEach(() => {
  generateContentMock.mockReset();
});

const SOLICITUD_BASE = {
  modelo: "gemini-3.5-flash-lite",
  maxTokens: 800,
  system: "Sos un asistente.",
  turnos: [{ role: "user" as const, content: "Hola" }],
};

describe("GeminiProvider.generar", () => {
  it("Test 1 — manda la solicitud a generateContent con el modelo, el historial y el tope de salida", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "Hola" }] }, finishReason: FinishReason.STOP }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
    });

    await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const params = generateContentMock.mock.calls[0][0];
    expect(params.model).toBe("gemini-3.5-flash-lite");
    expect(params.config.maxOutputTokens).toBe(800);
    expect(params.contents).toEqual([{ role: "user", parts: [{ text: "Hola" }] }]);
  });

  it("Test 2 — una respuesta con texto se transforma en outcome success", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [
        { content: { parts: [{ text: "¡Buenas! ¿En qué ayudo?" }] }, finishReason: FinishReason.STOP },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 6 },
    });

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado).toMatchObject({ outcome: "success", texto: "¡Buenas! ¿En qué ayudo?" });
  });

  it("Test 3 — múltiples bloques de texto se unen, y los bloques de 'thought' (razonamiento) se excluyen", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { text: "razonamiento interno, no es la respuesta", thought: true },
              { text: "Primera parte." },
              { text: "Segunda parte." },
            ],
          },
          finishReason: FinishReason.STOP,
        },
      ],
    });

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado).toMatchObject({
      outcome: "success",
      texto: "Primera parte.\nSegunda parte.",
    });
  });

  it("Test 4 — una respuesta sin texto (STOP pero sin bloques) se detecta como empty_response", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [] }, finishReason: FinishReason.STOP }],
      usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 0 },
    });

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado).toEqual({
      outcome: "empty_response",
      detalleProveedor: FinishReason.STOP,
      usage: { tokensEntrada: 8, tokensSalida: 0, tokensCacheEscritura: null, tokensCacheLectura: null },
    });
  });

  it("Test 5a — finishReason SAFETY (con candidato) se transforma en outcome refused", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [] }, finishReason: FinishReason.SAFETY }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 0 },
    });

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado.outcome).toBe("refused");
  });

  it("Test 5b — un prompt bloqueado ANTES de generar (cero candidatos + promptFeedback.blockReason) también es refused", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [],
      promptFeedback: { blockReason: "SAFETY" },
      usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 0 },
    });

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado.outcome).toBe("refused");
  });

  it("Test 6 — finishReason MAX_TOKENS se transforma en outcome max_output, incluso con texto parcial", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "una respuesta a medi" }] }, finishReason: FinishReason.MAX_TOKENS }],
      usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 800 },
    });

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado.outcome).toBe("max_output");
  });

  it("Test 7 — un ApiError (la API respondió con un status de error) se transforma en provider_error", async () => {
    generateContentMock.mockRejectedValue(new ApiError({ message: "Rate limit exceeded", status: 429 }));

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado).toEqual({
      outcome: "provider_error",
      mensaje: "API 429: Rate limit exceeded",
    });
  });

  it("Test 8 — un error de red (no es ApiError) se propaga como excepción, no se atrapa", async () => {
    generateContentMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(new GeminiProvider("clave").generar(SOLICITUD_BASE)).rejects.toThrow("fetch failed");
  });

  it("Test 9 — el usage presente se mapea a UsoIAProveedor, incluida la lectura de caché", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: FinishReason.STOP }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45, cachedContentTokenCount: 30 },
    });

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado).toMatchObject({
      usage: {
        tokensEntrada: 120,
        tokensSalida: 45,
        // Gemini no tiene equivalente a "tokens de escritura de
        // caché" — nunca se inventa un número acá.
        tokensCacheEscritura: null,
        tokensCacheLectura: 30,
      },
    });
  });

  it("Test 10 — sin usageMetadata en la respuesta, el resultado lleva usage null (nunca inventa ceros)", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: FinishReason.STOP }],
    });

    const resultado = await new GeminiProvider("clave").generar(SOLICITUD_BASE);

    expect(resultado).toMatchObject({ outcome: "success", usage: null });
  });

  it("Test 11 — el system prompt se manda tal cual en config.systemInstruction", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: FinishReason.STOP }],
    });

    await new GeminiProvider("clave").generar({
      ...SOLICITUD_BASE,
      system: "Sos el asistente de Rancho Las Torres, respondé en 1-2 oraciones.",
    });

    const params = generateContentMock.mock.calls[0][0];
    expect(params.config.systemInstruction).toBe(
      "Sos el asistente de Rancho Las Torres, respondé en 1-2 oraciones.",
    );
  });

  it("Test 12 — el historial se transforma a Content[] preservando el orden y mapeando assistant→model", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: FinishReason.STOP }],
    });

    await new GeminiProvider("clave").generar({
      ...SOLICITUD_BASE,
      turnos: [
        { role: "user", content: "¿Tenés lugar el sábado?" },
        { role: "assistant", content: "Sí, el sábado hay disponibilidad." },
        { role: "user", content: "¿Y el precio?" },
      ],
    });

    const params = generateContentMock.mock.calls[0][0];
    expect(params.contents).toEqual([
      { role: "user", parts: [{ text: "¿Tenés lugar el sábado?" }] },
      { role: "model", parts: [{ text: "Sí, el sábado hay disponibilidad." }] },
      { role: "user", parts: [{ text: "¿Y el precio?" }] },
    ]);
  });

  it("Test 13 — el modelo viene de la solicitud, nunca hardcodeado dentro del provider", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: FinishReason.STOP }],
    });
    const provider = new GeminiProvider("clave");

    await provider.generar({ ...SOLICITUD_BASE, modelo: "gemini-3.1-flash-lite" });
    await provider.generar({ ...SOLICITUD_BASE, modelo: "gemini-2.5-flash-lite" });

    expect(generateContentMock.mock.calls[0][0].model).toBe("gemini-3.1-flash-lite");
    expect(generateContentMock.mock.calls[1][0].model).toBe("gemini-2.5-flash-lite");
  });

  it("Test 14 — la clave nunca viaja en el body del request ni en un mensaje de error", async () => {
    const CLAVE = "AIzaSy-super-secreta-de-prueba";
    generateContentMock.mockRejectedValue(new ApiError({ message: "Invalid argument", status: 400 }));

    const resultado = await new GeminiProvider(CLAVE).generar(SOLICITUD_BASE);

    // La clave solo puede ir al constructor de GoogleGenAI (fuera de
    // esta llamada) — nunca dentro de los parámetros de generateContent.
    const params = generateContentMock.mock.calls[0][0];
    expect(JSON.stringify(params)).not.toContain(CLAVE);
    // Y el resultado que se loguea/propaga tampoco puede filtrarla.
    expect(JSON.stringify(resultado)).not.toContain(CLAVE);
  });
});
