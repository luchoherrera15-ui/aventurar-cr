/**
 * Refina un prompt de invitación usando Claude.
 * El usuario describe qué quiere, Claude lo interpreta y expande.
 *
 * Retorna N variantes de prompts mejorados para que el usuario elija,
 * junto con el consumo real de la llamada: hasta ahora este punto
 * gastaba tokens que nadie contaba.
 */

import Anthropic from "@anthropic-ai/sdk";
import { MODELOS, type ModeloIA } from "./modelos";
import type { UsageAnthropic } from "./registrar-uso";

interface RefinedPromptVariant {
  numero: number;
  titulo: string;
  prompt: string;
}

export interface ResultadoRefinar {
  variantes: RefinedPromptVariant[];
  usage: UsageAnthropic;
  tiempoMs: number;
}

/**
 * Falla que ocurrió con los tokens ya gastados (el modelo respondió pero
 * no en el formato esperado, o se quedó sin espacio). La ruta la usa para
 * dejar el gasto asentado igual.
 */
export class ErrorRefinarIA extends Error {
  readonly usage: UsageAnthropic | null;
  readonly tiempoMs: number;

  constructor(mensaje: string, usage: UsageAnthropic | null, tiempoMs: number) {
    super(mensaje);
    this.name = "ErrorRefinarIA";
    this.usage = usage;
    this.tiempoMs = tiempoMs;
  }
}

export async function refinarPromptConIA(
  descripcionUsuario: string,
  numeroVariantes: number = 3,
  modelo: ModeloIA = "claude-haiku-4-5"
): Promise<ResultadoRefinar> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }

  const client = new Anthropic({ apiKey });
  const info = MODELOS[modelo];

  const systemPrompt = `Eres un experto en diseño de invitaciones digitales interactivas.
El usuario te describe en lenguaje natural qué invitación desea.
Tu trabajo es:

1. Interpretar su visión
2. Generar ${numeroVariantes} variantes de PROMPTS DETALLADOS para un generador HTML
3. Cada prompt debe ser específico, descriptivo e incluir:
   - Temática/estilo visual
   - Colores predominantes
   - Animaciones sugeridas
   - Efectos recomendados
   - Disposición de elementos

IMPORTANTE: Responde en JSON array, así:
[
  {
    "numero": 1,
    "titulo": "Variante 1: Boda minimalista",
    "prompt": "Genera una invitación HTML para boda. Temática: minimalista elegante..."
  },
  ...
]

Solo JSON, sin explicaciones.`;

  const userMessage = `El usuario quiere: "${descripcionUsuario}"

Genera ${numeroVariantes} variantes de prompts detallados para una invitación HTML interactiva.`;

  // Los modelos que razonan comparten max_tokens entre el razonamiento y
  // la respuesta: con 2048 el JSON se corta. Los que no razonan (Haiku)
  // no necesitan ese margen.
  const maxTokens = Math.min(info.razonaPorDefecto ? 8192 : 2048, info.salidaMaxima);

  const inicio = Date.now();

  const response = await client.messages.create({
    model: modelo,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const tiempoMs = Date.now() - inicio;
  const usage: UsageAnthropic = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
  };

  try {
    if (response.stop_reason === "refusal") {
      throw new Error("La IA declinó proponer variantes. Ajustá la descripción.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("La respuesta quedó incompleta. Probá con una descripción más corta.");
    }

    // Con thinking activo el primer bloque puede ser "thinking":
    // hay que buscar el bloque de texto, no asumir content[0].
    const bloqueTexto = response.content.find(
      (b): b is Extract<typeof b, { type: "text" }> => b.type === "text"
    );
    let texto = (bloqueTexto?.text ?? "[]").trim();

    // Quitar fences de markdown si el modelo los agrega igual.
    const fence = texto.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/);
    if (fence) texto = fence[1].trim();

    const variantes = JSON.parse(texto) as RefinedPromptVariant[];
    if (!Array.isArray(variantes) || variantes.length === 0) {
      throw new Error("La IA no devolvió variantes válidas");
    }
    return { variantes, usage, tiempoMs };
  } catch (e) {
    console.error("Error en refinar-prompt:", e);
    // El modelo ya cobró: el error viaja con el usage para que quede
    // registrado como gasto fallido y no como plata invisible.
    const mensaje = e instanceof Error ? e.message : "Error desconocido";
    throw new ErrorRefinarIA(mensaje, usage, tiempoMs);
  }
}
