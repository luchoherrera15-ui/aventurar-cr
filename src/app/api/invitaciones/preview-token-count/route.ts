import { estimarCostoInvitacion, formatearCosto } from "@/lib/ia/token-counter";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/invitaciones/preview-token-count
 *
 * Calcula el costo estimado de una invitación SIN gastar tokens.
 * Usa la preview API de Anthropic (token-counting-v1).
 *
 * Requiere sesión (cookies): el conteo usa la API key del servidor y
 * no queremos regalarle el rate limit a anónimos.
 *
 * Body:
 * {
 *   "prompt": "string",
 *   "modelo": "opus" | "fable",
 *   "estimado_output_tokens": number (optional, default 4000)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "input_tokens": number,
 *   "output_tokens": number,
 *   "model": "opus" | "fable",
 *   "costo_usd": number,
 *   "costo_formateado": "$0.1234",
 *   "error": null
 * }
 */

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prompt, modelo = "opus" } = body;

    if (!prompt || typeof prompt !== "string") {
      return Response.json(
        { success: false, error: "prompt requerido (string)" },
        { status: 400 }
      );
    }

    if (prompt.length > 20000) {
      return Response.json(
        { success: false, error: "El prompt es demasiado largo (máx 20.000 caracteres)" },
        { status: 400 }
      );
    }

    if (!["opus", "fable"].includes(modelo)) {
      return Response.json(
        { success: false, error: "modelo debe ser 'opus' o 'fable'" },
        { status: 400 }
      );
    }

    // Validar y acotar el estimado de output (un string daría $NaN).
    const estimadoCrudo = Number(body.estimado_output_tokens);
    const estimado_output_tokens = Number.isFinite(estimadoCrudo)
      ? Math.min(Math.max(Math.round(estimadoCrudo), 100), 16384)
      : 4000;

    const estimado = await estimarCostoInvitacion(
      prompt,
      modelo,
      estimado_output_tokens
    );

    return Response.json({
      success: true,
      input_tokens: estimado.input_tokens,
      output_tokens: estimado.output_tokens,
      model: estimado.model,
      costo_usd: estimado.costo_usd,
      costo_formateado: formatearCosto(estimado.costo_usd),
      costo_tokens_input: estimado.costo_tokens_input,
      costo_tokens_output: estimado.costo_tokens_output,
      error: null,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en preview-token-count:", errorMsg);
    return Response.json(
      {
        success: false,
        error: errorMsg || "Error al estimar costo. Intenta de nuevo.",
        error_detail: errorMsg,
      },
      { status: 500 }
    );
  }
}
