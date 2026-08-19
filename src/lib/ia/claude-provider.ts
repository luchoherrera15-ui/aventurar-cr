import type { AIProvider, ResultadoIA, SolicitudIA, UsoIAProveedor } from "./ai-provider";

/**
 * Todo lo que sabe de Anthropic vive ACÁ, y en ningún otro lado a
 * partir de este refactor: la URL de `api.anthropic.com`, los headers
 * (`x-api-key`, `anthropic-version`), la forma del body, y cómo leer
 * `content` / `stop_reason` / `usage` de la respuesta. `asistente-ia.ts`
 * ya no conoce nada de esto — solo el contrato genérico de
 * `ai-provider.ts`.
 *
 * Es un traslado 1:1 del `fetch` que antes vivía en `asistente-ia.ts`:
 * mismo endpoint, mismos headers, mismo body, misma lectura de
 * `stop_reason` antes que `content` (un "refusal" o un "max_tokens"
 * llegan con HTTP 200 y sin texto). El comportamiento para quien usa
 * el asistente es exactamente el mismo de antes.
 *
 * Lo que NO atrapa a propósito: un `fetch` que tira (red caída) o un
 * `.json()` que tira (cuerpo no es JSON válido) suben como excepción,
 * igual que pasaba antes de este refactor — el try/catch general de
 * `responderConAsistente` ya los cubre. Solo se convierte en
 * `ResultadoIA` lo que la API de Anthropic ya contestó, bien o mal.
 */

/** El `usage` tal como lo devuelve la Messages API de Anthropic — el
 *  único lugar del código que conoce estos nombres de campo. */
type UsageAnthropicCruda = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

type CuerpoRespuestaAnthropic = {
  content?: { type: string; text?: string }[];
  stop_reason?: string | null;
  usage?: UsageAnthropicCruda;
};

function usoGenerico(usage: UsageAnthropicCruda | undefined): UsoIAProveedor | null {
  if (!usage) return null;
  return {
    tokensEntrada: usage.input_tokens ?? 0,
    tokensSalida: usage.output_tokens ?? 0,
    tokensCacheEscritura: usage.cache_creation_input_tokens ?? 0,
    tokensCacheLectura: usage.cache_read_input_tokens ?? 0,
  };
}

export class ClaudeProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generar({ modelo, maxTokens, system, turnos }: SolicitudIA): Promise<ResultadoIA> {
    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: maxTokens,
        system,
        messages: turnos,
      }),
    });

    if (!respuesta.ok) {
      return { outcome: "provider_error", mensaje: `API ${respuesta.status}: ${await respuesta.text()}` };
    }

    const cuerpo = (await respuesta.json()) as CuerpoRespuestaAnthropic;
    const usage = usoGenerico(cuerpo.usage);

    // stop_reason antes que content: un "refusal" y un "max_tokens"
    // llegan con HTTP 200 y sin texto, y sin mirarlo los dos se
    // confundían con "no hubo respuesta" y desaparecían sin rastro.
    const stop = typeof cuerpo.stop_reason === "string" ? cuerpo.stop_reason : null;
    if (stop === "refusal") return { outcome: "refused", usage };
    if (stop === "max_tokens") return { outcome: "max_output", usage };

    const texto = (cuerpo.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();

    if (!texto) return { outcome: "empty_response", usage, detalleProveedor: stop };

    return { outcome: "success", texto, usage };
  }
}
