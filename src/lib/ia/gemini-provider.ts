import { ApiError, FinishReason, GoogleGenAI, type Content, type Part } from "@google/genai";
import type { AIProvider, ResultadoIA, SolicitudIA, UsoIAProveedor } from "./ai-provider";

/**
 * Todo lo que sabe de Gemini vive ACÁ, espejo de `claude-provider.ts`:
 * el SDK oficial (`@google/genai`, `npm i @google/genai`), cómo se arma
 * el request y cómo se lee `candidates` / `finishReason` / `usageMetadata`
 * de la respuesta. `asistente-ia.ts` no necesita saber que existe.
 *
 * SDK y modelo verificados contra la documentación oficial y, sobre
 * todo, contra los TIPOS REALES instalados en
 * `node_modules/@google/genai/dist/genai.d.ts` el 2026-08-19 — la
 * prosa de ai.google.dev se contradijo entre sí en más de un punto
 * (nombre del campo del prompt de sistema, si existe o no un
 * "finish reason" en la API nueva) mientras investigaba, así que la
 * forma exacta del request/response de este archivo sale de los
 * tipos compilados del SDK instalado, no de la documentación en
 * prosa. Fuentes con URL y fecha en el reporte de esta fase.
 *
 * Se construye sobre `ai.models.generateContent()` — el método
 * "clásico", estable, el que sigue mostrando el propio README del SDK
 * como uso básico — y NO sobre la "Interactions API" más nueva
 * (`ai.interactions`, pensada para agentes con tools/function calling
 * y memoria del lado del servidor): esta fase prohíbe explícitamente
 * tools y function calling, así que `generateContent` es el ajuste
 * correcto, no una elección de conveniencia.
 */

/** Gemini usa "model" donde Claude usa "assistant". */
function comoContenidoGemini(turnos: SolicitudIA["turnos"]): Content[] {
  return turnos.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));
}

/**
 * `finishReason` que significan "el modelo no completó una respuesta
 * utilizable por una razón de contenido/política" — nunca por corte
 * de longitud. Es el análogo de Anthropic `stop_reason: "refusal"`,
 * pero Gemini reparte ese concepto en varios valores en vez de uno
 * solo:
 *  - SAFETY / PROHIBITED_CONTENT / BLOCKLIST / SPII: bloqueado por
 *    políticas de contenido — la razón central de "refused".
 *  - RECITATION: el modelo se frenó porque el texto se parecía
 *    demasiado a contenido con el que se entrenó — no es un problema
 *    de longitud ni un error técnico, es el modelo negándose a seguir
 *    por esa respuesta puntual, así que cae en el mismo bucket.
 *  - LANGUAGE: se frenó por usar un idioma no soportado — mismo
 *    criterio: no es "vacío" ni "cortado", es una negativa del modelo
 *    a esa respuesta puntual.
 */
const RAZONES_DE_RECHAZO = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
  FinishReason.LANGUAGE,
]);

/**
 * El `usageMetadata` de Gemini, traducido a la forma genérica.
 *
 * `tokensCacheEscritura` siempre sale `null`: Gemini no tiene un
 * concepto de "costo de escribir a la caché" dentro de esta misma
 * llamada como sí tiene Anthropic — su caché de contexto se crea
 * aparte, explícitamente, con `ai.caches.create()`. Inventar un `0`
 * acá diría "no hay costo de caché" cuando la verdad es "este
 * proveedor no reporta ese concepto en absoluto" — por eso
 * `UsoIAProveedor` (ai-provider.ts) admite `null` en ese campo.
 *
 * `tokensCacheLectura` SÍ tiene equivalente real: `cachedContentTokenCount`
 * son los tokens del prompt que vinieron de una caché ya creada.
 */
function usoGenerico(
  usage: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number } | undefined,
): UsoIAProveedor | null {
  if (!usage) return null;
  return {
    tokensEntrada: usage.promptTokenCount ?? 0,
    tokensSalida: usage.candidatesTokenCount ?? 0,
    tokensCacheEscritura: null,
    tokensCacheLectura: usage.cachedContentTokenCount ?? null,
  };
}

/** Concatena los bloques de texto de un candidato, igual que el
 *  getter `.text` del propio SDK: excluye los bloques de "thought"
 *  (razonamiento interno), que no son la respuesta para el cliente. */
function textoDelCandidato(parts: Part[] | undefined): string {
  return (parts ?? [])
    .filter((p) => p.thought !== true && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim();
}

export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generar({ modelo, maxTokens, system, turnos }: SolicitudIA): Promise<ResultadoIA> {
    let respuesta;
    try {
      respuesta = await this.client.models.generateContent({
        model: modelo,
        contents: comoContenidoGemini(turnos),
        config: {
          systemInstruction: system,
          maxOutputTokens: maxTokens,
        },
      });
    } catch (e) {
      // `ApiError` es del SDK: la llamada SÍ llegó a la API y volvió
      // con un status de error (401, 429, 500...) — eso es
      // provider_error. Cualquier otra excepción (red caída, DNS,
      // timeout de conexión) no llegó a ser una respuesta de la API:
      // se deja propagar, igual que un `fetch` que tira en
      // ClaudeProvider — el try/catch general de `responderConAsistente`
      // ya la cubre.
      if (e instanceof ApiError) {
        return { outcome: "provider_error", mensaje: `API ${e.status}: ${e.message}` };
      }
      throw e;
    }

    const usage = usoGenerico(respuesta.usageMetadata);
    const candidato = respuesta.candidates?.[0];

    // Cero candidatos: la API rechazó el PROMPT antes de generar nada
    // (distinto de que el modelo generara y lo frenara a mitad de
    // camino). `promptFeedback.blockReason` presente confirma que fue
    // un bloqueo de contenido — mismo bucket que "refused". Sin
    // `blockReason`, es una respuesta rara sin candidatos y sin
    // motivo declarado: no hay texto que mostrar, así que es
    // empty_response, no un error de HTTP (la llamada sí respondió).
    if (!candidato) {
      if (respuesta.promptFeedback?.blockReason) {
        return { outcome: "refused", usage };
      }
      return { outcome: "empty_response", usage, detalleProveedor: null };
    }

    const finishReason = candidato.finishReason ?? null;
    if (finishReason && RAZONES_DE_RECHAZO.has(finishReason)) {
      return { outcome: "refused", usage };
    }
    // MAX_TOKENS se mira ANTES que el texto, mismo criterio que
    // ClaudeProvider con "max_tokens": aunque haya texto parcial, está
    // cortado a mitad de una idea — no es una respuesta utilizable.
    if (finishReason === FinishReason.MAX_TOKENS) {
      return { outcome: "max_output", usage };
    }

    const texto = textoDelCandidato(candidato.content?.parts);
    if (!texto) {
      return { outcome: "empty_response", usage, detalleProveedor: finishReason };
    }

    return { outcome: "success", texto, usage };
  }
}
