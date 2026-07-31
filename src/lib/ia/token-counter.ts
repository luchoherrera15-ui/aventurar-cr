/**
 * Token counting y cálculo de costo usando el endpoint count_tokens de Anthropic
 * (POST /v1/messages/count_tokens). No gasta tokens, solo los cuenta.
 *
 * Acá NO viven precios. Este archivo tenía su propia tabla de tarifas escrita
 * a mano, que no conocía Haiku ni Sonnet ni el precio de lanzamiento de
 * Sonnet 5, y que iba a quedar vieja en silencio apenas Anthropic moviera una
 * tarifa. El catálogo de modelos.ts es la única fuente de verdad: acá solo se
 * cuentan tokens y se le pregunta a calcularCosto cuánto valen.
 */

import { SYSTEM_PROMPT_DEFAULT } from "./generador-invitaciones";
import { MODELOS, calcularCosto, formatearUSD, normalizarModelo, type ModeloIA } from "./modelos";

/**
 * Las etiquetas cortas que todavía hablan el bot y el generador viejo.
 * Se aceptan por compatibilidad; normalizarModelo las traduce al catálogo.
 */
export type AliasModelo = "opus" | "fable" | "sonnet" | "haiku";

/** Lo que se le puede pasar a estas funciones: un id del catálogo o un alias. */
export type ModeloOAlias = ModeloIA | AliasModelo;

interface TokenCountResult {
  input_tokens: number;
}

/**
 * El costo estimado de una generación. El input ya está contado de verdad;
 * lo único incierto es cuánto HTML escriba el modelo, por eso además del
 * valor central viaja el rango entero: la UI no puede prometer un precio
 * cerrado que después se le triplica al cliente.
 */
export interface EstimacionCosto {
  input_tokens: number;
  /** Salida del escenario central (la que usa costo_usd). */
  output_tokens: number;
  /** El id real del catálogo con el que se cotizó. */
  model: ModeloIA;
  costo_usd: number;
  costo_tokens_input: number;
  costo_tokens_output: number;
  /** Piso y techo razonables, para poder mostrar "de X a Y". */
  rango: {
    output_tokens_min: number;
    output_tokens_max: number;
    costo_usd_min: number;
    costo_usd_max: number;
  };
}

/**
 * Cuánto HTML escribe el modelo según lo cargada que salga la invitación.
 * El piso es una invitación sobria (texto y un par de transiciones); el
 * techo lo pone el generador, que pide max_tokens = 16.384 (ver
 * generador-invitaciones.ts): más que eso la respuesta se corta sola.
 * El valor central es una invitación normal, ni pelada ni recargada.
 */
export const SALIDA_SENCILLA = 3_000;
export const SALIDA_TIPICA = 4_000;
export const SALIDA_TOPE_GENERADOR = 16_384;

/**
 * El techo real para un modelo dado: Haiku responde como mucho 64k y los
 * demás 128k, pero el generador nunca pide más de 16.384. Cotizar por
 * encima de lo que se va a pedir sería inventar plata.
 */
export function salidaMaximaDe(modelo: ModeloOAlias): number {
  const id = normalizarModelo(modelo);
  return Math.min(SALIDA_TOPE_GENERADOR, MODELOS[id].salidaMaxima);
}

/**
 * Cuenta tokens en un mensaje SIN gastar tokens (endpoint count_tokens).
 * Los ids del catálogo son los mismos que acepta la API, así que el modelo
 * se manda tal cual después de normalizarlo.
 */
export async function contarTokensPrompt(
  prompt: string,
  systemPrompt?: string,
  modelo: ModeloOAlias = "claude-opus-5"
): Promise<TokenCountResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }

  const id = normalizarModelo(modelo);
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
        model: id,
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
 * No llama a ningún API: delega en el catálogo, que sabe de precios de
 * lanzamiento vigentes y de los modelos que este archivo no conocía.
 */
export function calcularCostoUSD(
  input_tokens: number,
  output_tokens: number,
  modelo: ModeloOAlias
): number {
  return calcularCosto(normalizarModelo(modelo), input_tokens, output_tokens);
}

/**
 * Estima el costo de generar una invitación.
 * - prompt: el input del usuario
 * - modelo: un id del catálogo o un alias corto ("opus", "fable")
 * - estimado_output_tokens: escenario central para la salida (default 4.000)
 *
 * El rango que se devuelve no es decorativo: entre una invitación sobria y
 * una llena de animaciones hay 5x de diferencia en el HTML escrito, y un
 * número único se leía como precio cerrado.
 */
export async function estimarCostoInvitacion(
  prompt: string,
  modelo: ModeloOAlias = "claude-opus-5",
  estimado_output_tokens: number = SALIDA_TIPICA
): Promise<EstimacionCosto> {
  const id = normalizarModelo(modelo);

  // El mismo system prompt que usa la generación real, para que el
  // conteo de input coincida con lo que se va a facturar.
  const conteo = await contarTokensPrompt(prompt, SYSTEM_PROMPT_DEFAULT, id);
  const entrada = conteo.input_tokens;

  const techo = salidaMaximaDe(id);
  // El escenario central nunca puede caer fuera del rango que se muestra:
  // si quien llama pide 16.384 como central, el piso deja de ser el piso.
  const central = Math.min(Math.max(Math.round(estimado_output_tokens), 1), techo);
  const piso = Math.min(SALIDA_SENCILLA, central);

  // Una sola fecha para las tres cotizaciones: si un precio de lanzamiento
  // venciera entre línea y línea, el mínimo saldría más caro que el máximo.
  const ahora = new Date();

  return {
    input_tokens: entrada,
    output_tokens: central,
    model: id,
    costo_usd: calcularCosto(id, entrada, central, ahora),
    costo_tokens_input: entrada,
    costo_tokens_output: central,
    rango: {
      output_tokens_min: piso,
      output_tokens_max: techo,
      costo_usd_min: calcularCosto(id, entrada, piso, ahora),
      costo_usd_max: calcularCosto(id, entrada, techo, ahora),
    },
  };
}

/**
 * Formatea el costo en dólares, que es la moneda en que cobra Anthropic.
 * Delega en el catálogo para que los montos chicos se vean igual en todo
 * el producto (cuatro decimales debajo de un centavo, dos arriba).
 */
export function formatearCosto(costoUSD: number): string {
  return formatearUSD(costoUSD);
}

/**
 * Convierte tokens a "puntos" para display (1 token ≈ 0.25 palabras).
 */
export function tokensAPalabrasAprox(tokens: number): number {
  return Math.round(tokens * 0.25);
}
