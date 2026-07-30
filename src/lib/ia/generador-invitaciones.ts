/**
 * Generador de invitaciones HTML usando Claude.
 * Soporta Opus y Fable con diferentes niveles de creatividad.
 */

import Anthropic from "@anthropic-ai/sdk";

interface GenerarInvitacionOpts {
  prompt: string;
  modelo: "opus" | "fable";
  systemPrompt?: string;
}

interface GenerarInvitacionResult {
  html: string;
  input_tokens: number;
  output_tokens: number;
  tiempo_ms: number;
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
 * Llama a Claude (Opus o Fable) para generar el HTML.
 * Retorna { html, input_tokens, output_tokens, tiempo_ms }
 */
export async function generarInvitacionHTML(
  opts: GenerarInvitacionOpts
): Promise<GenerarInvitacionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }

  const client = new Anthropic({ apiKey });
  const modelMap = {
    opus: "claude-opus-5",
    fable: "claude-fable-5",
  };

  const inicio = Date.now();

  try {
    const response = await client.messages.create({
      model: modelMap[opts.modelo],
      max_tokens: 16384,
      system: opts.systemPrompt || SYSTEM_PROMPT_DEFAULT,
      messages: [
        {
          role: "user",
          content: opts.prompt,
        },
      ],
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "La invitación quedó incompleta (se alcanzó el límite de tokens). Intenta con un prompt más corto o menos efectos."
      );
    }
    if (response.stop_reason === "refusal") {
      throw new Error(
        "La IA declinó generar este contenido. Ajusta la descripción e intenta de nuevo."
      );
    }

    // Con thinking activo (siempre en Fable 5, adaptativo en Opus 5) el
    // primer bloque es "thinking" — hay que buscar el bloque de texto.
    const bloqueTexto = response.content.find(
      (b): b is Extract<typeof b, { type: "text" }> => b.type === "text"
    );
    const html = bloqueTexto ? limpiarHTML(bloqueTexto.text) : "";

    if (!html) {
      throw new Error("La IA no devolvió HTML. Intenta de nuevo.");
    }

    const tiempoMs = Date.now() - inicio;

    return {
      html,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      tiempo_ms: tiempoMs,
    };
  } catch (e) {
    console.error("Error en generador-invitaciones:", e);
    throw e;
  }
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
