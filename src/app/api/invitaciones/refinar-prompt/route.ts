import { modeloDe, motivoParaNoGastar } from "@/lib/ia/config-ia";
import type { ModeloIA } from "@/lib/ia/modelos";
import { ErrorRefinarIA, refinarPromptConIA } from "@/lib/ia/refiner-prompt";
import { registrarDesdeUsage, registrarFalloIA } from "@/lib/ia/registrar-uso";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/invitaciones/refinar-prompt
 *
 * Toma una descripción simple del usuario y genera N variantes
 * de prompts mejorados para que elija. Requiere sesión: cada llamada
 * gasta tokens reales de Anthropic.
 *
 * Body:
 * {
 *   "descripcion": "quiero una invitación para mi cumpleaños con temática de harry potter",
 *   "numero_variantes": 3 (optional, default)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "variantes": [
 *     {
 *       "numero": 1,
 *       "titulo": "...",
 *       "prompt": "..."
 *     },
 *     ...
 *   ],
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
    const { descripcion, numero_variantes = 3 } = body;

    if (typeof descripcion === "string" && descripcion.length > 4000) {
      return Response.json(
        { success: false, error: "La descripción es demasiado larga (máx 4.000 caracteres)" },
        { status: 400 }
      );
    }

    if (!descripcion || typeof descripcion !== "string") {
      return Response.json(
        { success: false, error: "descripcion requerida (string)" },
        { status: 400 }
      );
    }

    if (descripcion.length < 10) {
      return Response.json(
        {
          success: false,
          error: "Describe un poco más qué invitación quieres (mínimo 10 caracteres)",
        },
        { status: 400 }
      );
    }

    if (numero_variantes < 1 || numero_variantes > 5) {
      return Response.json(
        {
          success: false,
          error: "numero_variantes debe estar entre 1 y 5",
        },
        { status: 400 }
      );
    }

    // Antes de gastar: si la IA está apagada o el mes llegó al tope, se
    // contesta sin llamar a Anthropic. Si la configuración no se puede
    // leer, el cliente sigue como antes en vez de quedarse sin servicio.
    let motivo: string | null = null;
    let modelo: ModeloIA = "claude-haiku-4-5";
    try {
      motivo = await motivoParaNoGastar();
      modelo = await modeloDe("invitacion_refinar");
    } catch (e) {
      console.error("[refinar-prompt] No se pudo leer la configuración de IA:", e);
    }
    if (motivo) {
      return Response.json({ success: false, error: motivo }, { status: 503 });
    }

    try {
      const { variantes, usage, tiempoMs } = await refinarPromptConIA(
        descripcion,
        numero_variantes,
        modelo
      );

      await registrarDesdeUsage(usage, {
        agente: "invitacion_refinar",
        modelo,
        tiempoMs,
        usuarioId: user.id,
      });

      return Response.json({
        success: true,
        variantes,
        error: null,
      });
    } catch (e) {
      // El modelo puede haber cobrado antes de fallar: ese gasto se
      // asienta igual para que el panel no muestre un mes irreal.
      if (e instanceof ErrorRefinarIA) {
        await registrarFalloIA({
          agente: "invitacion_refinar",
          modelo,
          tokensInput: e.usage?.input_tokens ?? 0,
          tokensOutput: e.usage?.output_tokens ?? 0,
          tokensCacheWrite: e.usage?.cache_creation_input_tokens ?? 0,
          tokensCacheRead: e.usage?.cache_read_input_tokens ?? 0,
          tiempoMs: e.tiempoMs,
          error: e.message,
          usuarioId: user.id,
        });
      }
      throw e;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en refinar-prompt:", errorMsg);
    return Response.json(
      {
        success: false,
        error: errorMsg || "Error al refinar el prompt",
        error_detail: errorMsg,
      },
      { status: 500 }
    );
  }
}
