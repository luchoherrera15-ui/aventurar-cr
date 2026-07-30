/**
 * Token counting y cálculo de costo usando el endpoint count_tokens de Anthropic
 * (POST /v1/messages/count_tokens). No gasta tokens, solo los cuenta.
 */

import { SYSTEM_PROMPT_DEFAULT } from "./generador-invitaciones";

interface TokenCountResult {
  input_tokens: number;
}

interface CostEstimate {
  input_tokens: number;
  output_tokens: number;
  model: "opus" | "fable";
  costo_usd: number;
  costo_tokens_input: number;
  costo_tokens_output: number;
}

// Precios en USD por 1M tokens (julio 2026). Ojo: Fable 5 es el
// modelo Mythos-class por ENCIMA de Opus — cuesta el doble, no menos.
const PRECIOS_MODELO = {
  opus: {
    input: 5, // claude-opus-5: $5 per 1M input tokens
    output: 25, // $25 per 1M output tokens
  },
  fable: {
    input: 10, // claude-fable-5: $10 per 1M input tokens
    output: 50, // $50 per 1M output tokens
  },
};

const MODEL_ID = {
  opus: "claude-opus-5",
  fable: "claude-fable-5",
} as const;

/**
 * Cuenta tokens en un mensaje SIN gastar tokens (endpoint count_tokens).
 */
export async function contarTokensPrompt(
  prompt: string,
  systemPrompt?: string,
  modelo: "opus" | "fable" = "opus"
): Promise<TokenCountResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }

  const messages = [{ role: "user" as const, content: prompt }];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID[modelo],
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Token counting API error:", error);
      throw new Error(`Token counting failed: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      input_tokens: (data.input_tokens as number) ?? 0,
    };
  } catch (e) {
    console.error("Error en token-counter:", e);
    throw e;
  }
}

/**
 * Calcula el costo en USD a partir de conteos de tokens ya conocidos
 * (por ejemplo, el usage real que devuelve la generación).
 * No llama a ningún API.
 */
export function calcularCostoUSD(
  input_tokens: number,
  output_tokens: number,
  modelo: "opus" | "fable"
): number {
  const precios = PRECIOS_MODELO[modelo];
  const costo =
    (input_tokens / 1_000_000) * precios.input +
    (output_tokens / 1_000_000) * precios.output;
  return Math.round(costo * 10000) / 10000; // 4 decimales
}

/**
 * Estima el costo de generar una invitación.
 * - prompt: el input del usuario
 * - modelo: "opus" | "fable"
 * - estimado_output_tokens: aproximación para output (default 4000,
 *   una invitación HTML completa con animaciones)
 *
 * Retorna { input_tokens, output_tokens, model, costo_usd, ... }
 */
export async function estimarCostoInvitacion(
  prompt: string,
  modelo: "opus" | "fable" = "opus",
  estimado_output_tokens: number = 4000
): Promise<CostEstimate> {
  // El mismo system prompt que usa la generación real, para que el
  // conteo de input coincida con lo que se va a facturar.
  const conteo = await contarTokensPrompt(prompt, SYSTEM_PROMPT_DEFAULT, modelo);
  const outputTokens = estimado_output_tokens;

  const precios = PRECIOS_MODELO[modelo];
  const costo_input = (conteo.input_tokens / 1_000_000) * precios.input;
  const costo_output = (outputTokens / 1_000_000) * precios.output;
  const costo_usd = costo_input + costo_output;

  return {
    input_tokens: conteo.input_tokens,
    output_tokens: outputTokens,
    model: modelo,
    costo_usd: Math.round(costo_usd * 10000) / 10000, // 4 decimales
    costo_tokens_input: conteo.input_tokens,
    costo_tokens_output: outputTokens,
  };
}

/**
 * Formatea el costo a moneda CR (₡) si es local, o USD ($) si es en esa moneda.
 * Como Anthropic cobra en USD, lo mostramos en $.
 */
export function formatearCosto(costoUSD: number): string {
  return `$${costoUSD.toFixed(4)}`;
}

/**
 * Convierte tokens a "puntos" para display (1 token ≈ 0.25 palabras).
 */
export function tokensAPalabrasAprox(tokens: number): number {
  return Math.round(tokens * 0.25);
}
