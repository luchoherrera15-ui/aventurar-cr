/**
 * Refina un prompt de invitación usando Claude.
 * El usuario describe qué quiere, Claude lo interpreta y expande.
 *
 * Retorna N variantes de prompts mejorados para que el usuario elija.
 */

import Anthropic from "@anthropic-ai/sdk";

interface RefinedPromptVariant {
  numero: number;
  titulo: string;
  prompt: string;
}

export async function refinarPromptConIA(
  descripcionUsuario: string,
  numeroVariantes: number = 3
): Promise<RefinedPromptVariant[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }

  const client = new Anthropic({ apiKey });

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

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

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
    return variantes;
  } catch (e) {
    console.error("Error en refinar-prompt:", e);
    throw e;
  }
}
