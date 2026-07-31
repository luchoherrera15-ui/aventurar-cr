/**
 * Generador de invitaciones HTML usando Claude.
 *
 * El modelo ya no está clavado acá: lo decide quien llama (el cliente que
 * eligió, o el que el admin configuró en /admin/ia). Este archivo solo
 * sabe hablarle a Anthropic y devolver el consumo para que la ruta lo
 * registre en uso_ia.
 */

import Anthropic from "@anthropic-ai/sdk";
import { MODELOS, type ModeloIA } from "./modelos";
import type { UsageAnthropic } from "./registrar-uso";

interface GenerarInvitacionOpts {
  prompt: string;
  modelo: ModeloIA;
  systemPrompt?: string;
}

interface GenerarInvitacionResult {
  html: string;
  usage: UsageAnthropic;
  input_tokens: number;
  output_tokens: number;
  tiempo_ms: number;
}

/**
 * Falla que ocurrió DESPUÉS de que Anthropic ya cobró los tokens: una
 * respuesta cortada por max_tokens, un rechazo, o texto que no era HTML.
 * Lleva el usage encima para que la ruta pueda dejar constancia del gasto.
 */
export class ErrorGeneracionIA extends Error {
  readonly usage: UsageAnthropic | null;
  readonly tiempoMs: number;

  constructor(mensaje: string, usage: UsageAnthropic | null, tiempoMs: number) {
    super(mensaje);
    this.name = "ErrorGeneracionIA";
    this.usage = usage;
    this.tiempoMs = tiempoMs;
  }
}

export const SYSTEM_PROMPT_DEFAULT = `Eres un diseñador experto en invitaciones digitales interactivas.
Tu trabajo es generar HTML + CSS de alta calidad, full-screen y animado.

REGLAS CLAVE:
1. Responde SOLO con el HTML válido, sin explicaciones ni markdown.
2. Incluye un <style> embebido con todo el CSS (un solo archivo).
3. PROHIBIDO usar etiquetas <script>: la página donde se publica NO las
   ejecuta. Toda animación va con CSS (@keyframes, transitions) y la
   interactividad puntual con atributos inline (onclick="...").
4. Las animaciones y efectos deben ser suaves y profesionales.
5. Responsive: funciona en móvil (vertical) y desktop.
6. Soporta scroll vertical si hay mucho contenido.
7. Usa colores y tipografía profesional según la temática.
8. Si el prompt trae URLs de fotos o videos del cliente, usalas con
   <img>/<video>; si no trae, NO inventes imágenes externas.
9. Genera HTML completamente autónomo (sin dependencias externas).
10. NO incluyas formulario ni botón de "Confirmar asistencia": la
    plataforma agrega su propio bloque de RSVP justo debajo del HTML.

El HTML se inserta dentro de la página pública de la invitación, así
que no incluyas <html>, <head> ni <body> — solo el contenido con su
<style>.`;

/**
 * Llama al modelo que le pasen para generar el HTML.
 * Retorna { html, usage, input_tokens, output_tokens, tiempo_ms }
 */
export async function generarInvitacionHTML(
  opts: GenerarInvitacionOpts
): Promise<GenerarInvitacionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }

  const client = new Anthropic({ apiKey });
  const info = MODELOS[opts.modelo];

  // El tope se dimensiona según el modelo, igual que en el chat, el
  // refinador y el asistente: los que razonan por defecto (Opus 5,
  // Sonnet 5, Fable 5) sacan el razonamiento de ESTE MISMO presupuesto,
  // y este es el agente con la salida más grande del producto — una
  // invitación full-screen animada con el CSS embebido son 3.000 a
  // 8.000+ tokens de HTML. Con 16k compartidos una invitación recargada
  // salía cortada: el cliente pagaba la generación entera y se quedaba
  // sin invitación. Haiku no razona, así que el tope entero es HTML y
  // con 16k le sobra. Y nunca se pide más de lo que el modelo puede dar
  // de una vez (Haiku corta en 64k, el resto en 128k).
  const maxTokens = Math.min(
    info.razonaPorDefecto ? 32768 : 16384,
    info.salidaMaxima
  );

  const inicio = Date.now();

  try {
    // Streaming obligatorio, igual que en leer-agenda.ts. El SDK estima
    // cuánto puede tardar una llamada sin stream a partir de max_tokens
    // (3600 s × max_tokens ÷ 128.000) y si le da más de 10 minutos ni
    // siquiera la manda: tira "Streaming is required for operations that
    // may take longer than 10 minutes". El corte cae en ~21.300 tokens,
    // así que los modelos que razonan (32.768) reventaban SIEMPRE y Haiku
    // (16.384) pasaba — por eso fallaba solo con Opus y Fable.
    //
    // No se arregla subiéndole el timeout al cliente: eso calla al SDK
    // pero la ruta muere igual en el maxDuration de Vercel. Con stream la
    // conexión no queda muda esperando, que es lo que rompía.
    const stream = client.messages.stream({
      model: opts.modelo,
      max_tokens: maxTokens,
      system: opts.systemPrompt || SYSTEM_PROMPT_DEFAULT,
      messages: [
        {
          role: "user",
          content: opts.prompt,
        },
      ],
    });
    // El mensaje ya armado: mismo objeto que devolvía create(), así que
    // stop_reason, content y usage se leen igual que antes.
    const response = await stream.finalMessage();

    const tiempoMs = Date.now() - inicio;
    const usage = aUsage(response.usage);

    if (response.stop_reason === "max_tokens") {
      throw new ErrorGeneracionIA(
        "La invitación quedó incompleta (se alcanzó el límite de tokens). Intenta con un prompt más corto o menos efectos.",
        usage,
        tiempoMs
      );
    }
    if (response.stop_reason === "refusal") {
      throw new ErrorGeneracionIA(
        "La IA declinó generar este contenido. Ajusta la descripción e intenta de nuevo.",
        usage,
        tiempoMs
      );
    }

    // Con los modelos que razonan por defecto (Opus 5, Sonnet 5 y Fable 5)
    // el primer bloque es "thinking" — hay que buscar el bloque de texto.
    const bloqueTexto = response.content.find(
      (b): b is Extract<typeof b, { type: "text" }> => b.type === "text"
    );
    const html = bloqueTexto ? limpiarHTML(bloqueTexto.text) : "";

    if (!html) {
      throw new ErrorGeneracionIA(
        "La IA no devolvió HTML. Intenta de nuevo.",
        usage,
        tiempoMs
      );
    }

    return {
      html,
      usage,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      tiempo_ms: tiempoMs,
    };
  } catch (e) {
    console.error("Error en generador-invitaciones:", e);
    throw e;
  }
}

/**
 * El usage del SDK trae null donde el nuestro espera número: se traduce
 * una sola vez acá para que el registro de gasto no tenga que adivinar.
 */
function aUsage(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): UsageAnthropic {
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
  };
}

/**
 * Quita fences de markdown (```html ... ```) si el modelo los agrega
 * a pesar de las instrucciones, y recorta espacios sobrantes.
 */
function limpiarHTML(texto: string): string {
  let html = texto.trim();
  const fence = html.match(/^```(?:html)?\s*\n([\s\S]*?)\n?```\s*$/);
  if (fence) {
    html = fence[1].trim();
  }
  return html;
}

/**
 * Helper para generar un prompt de invitación basado en config.
 * Esto puede ser usado en el frontend para "Refinar con IA".
 */
export function construirPromptDesdeConfig(config: {
  tematica: string;
  personajes?: string[];
  animaciones?: string[];
  efectos?: string[];
  titulo?: string;
  fecha?: string;
  lugar?: string;
  imagenes?: string[];
  videos?: string[];
  mensaje?: string;
}): string {
  let prompt = `Genera una invitación digital HTML interactiva para:

TÍTULO: ${config.titulo || "Evento especial"}
TEMÁTICA: ${config.tematica}
FECHA: ${config.fecha || "Por definir"}
LUGAR: ${config.lugar || "Ubicación a confirmar"}

DESCRIPCIÓN: ${config.mensaje || "Una invitación memorable y personalizada"}
`;

  if (config.personajes && config.personajes.length > 0) {
    prompt += `\nPERSONAJES A INCLUIR: ${config.personajes.join(", ")}`;
  }

  if (config.animaciones && config.animaciones.length > 0) {
    prompt += `\nANIMACIONES: ${config.animaciones.join(", ")}`;
  }

  if (config.efectos && config.efectos.length > 0) {
    prompt += `\nEFECTOS VISUALES: ${config.efectos.join(", ")}`;
  }

  if (config.imagenes && config.imagenes.length > 0) {
    prompt += `\nIMAGENES A INCLUIR (URLs): ${config.imagenes.join(", ")}`;
  }

  prompt += `

Genera HTML interactivo, responsive, con animaciones CSS3 y JavaScript.
Incluye un botón "Confirmar Asistencia" que abre un formulario modal.
Haz que sea memorable y acorde a la temática.`;

  return prompt;
}
