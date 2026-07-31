import {
  SALIDA_TIPICA,
  estimarCostoInvitacion,
  formatearCosto,
  salidaMaximaDe,
} from "@/lib/ia/token-counter";
import { leerConfigIA, modeloDe } from "@/lib/ia/config-ia";
import { MODELOS, normalizarModelo, type ModeloIA } from "@/lib/ia/modelos";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/invitaciones/preview-token-count
 *
 * Calcula el costo estimado de una invitación SIN gastar tokens
 * (endpoint count_tokens de Anthropic).
 *
 * Requiere sesión (cookies): el conteo usa la API key del servidor y
 * no queremos regalarle el rate limit a anónimos.
 *
 * Body:
 * {
 *   "prompt": "string",
 *   "modelo": id del catálogo o alias corto ("opus", "fable"...) — opcional,
 *             por defecto el que el admin tenga configurado para generar
 *   "estimado_output_tokens": number (opcional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "input_tokens": number,
 *   "output_tokens": number,
 *   "model": "claude-opus-5",
 *   "modelo_nombre": "Opus 5",
 *   "costo_usd": number,
 *   "costo_formateado": "$0.1234",
 *   "costo_usd_min": number, "costo_usd_max": number,
 *   "output_tokens_min": number, "output_tokens_max": number,
 *   "tipo_cambio": number,
 *   "error": null
 * }
 */

/**
 * Resuelve el modelo que mandó el cliente sin clavar la lista acá.
 * normalizarModelo cae en su valor por defecto cuando no reconoce nada, así
 * que se lo llama con dos valores por defecto distintos: si ambos coinciden
 * es porque de verdad reconoció el texto. Así la validación no se queda
 * vieja cuando el catálogo suma un modelo o un alias nuevo.
 */
function modeloPedido(valor: unknown): ModeloIA | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const conOpus = normalizarModelo(valor, "claude-opus-5");
  const conHaiku = normalizarModelo(valor, "claude-haiku-4-5");
  return conOpus === conHaiku ? conOpus : null;
}

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

    // El cuerpo llega sin tipo: se lee como desconocido y se valida campo
    // por campo en vez de confiar en lo que mande el navegador.
    const body = (await request.json()) as Record<string, unknown>;
    const { prompt } = body;

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

    // Sin modelo explícito se cotiza el que realmente va a correr: el que
    // el admin configuró para el generador. Antes estaba clavado en "opus"
    // y la vista previa mentía apenas el panel cambiaba a Sonnet o Haiku.
    const pidioModelo = body.modelo !== undefined && body.modelo !== null && body.modelo !== "";
    const pedido = pidioModelo ? modeloPedido(body.modelo) : null;
    if (pidioModelo && !pedido) {
      return Response.json(
        { success: false, error: "modelo desconocido" },
        { status: 400 }
      );
    }
    const modelo: ModeloIA = pedido ?? (await modeloDe("invitacion_generar"));

    // Validar y acotar el estimado de output (un string daría $NaN). El
    // techo depende del modelo: el generador nunca pide más de 16.384 y
    // Haiku no da más de 64k.
    const techo = salidaMaximaDe(modelo);
    const estimadoCrudo = Number(body.estimado_output_tokens);
    const estimado_output_tokens = Number.isFinite(estimadoCrudo)
      ? Math.min(Math.max(Math.round(estimadoCrudo), 100), techo)
      : Math.min(SALIDA_TIPICA, techo);

    const estimado = await estimarCostoInvitacion(
      prompt,
      modelo,
      estimado_output_tokens
    );

    // El tipo de cambio viaja en la respuesta para que la vista previa
    // muestre colones sin inventarse el número: tiene que ser el mismo con
    // el que después se registra el gasto real.
    const { tipoCambio } = await leerConfigIA();

    return Response.json({
      success: true,
      input_tokens: estimado.input_tokens,
      output_tokens: estimado.output_tokens,
      model: estimado.model,
      modelo_nombre: MODELOS[estimado.model].nombre,
      costo_usd: estimado.costo_usd,
      costo_formateado: formatearCosto(estimado.costo_usd),
      costo_tokens_input: estimado.costo_tokens_input,
      costo_tokens_output: estimado.costo_tokens_output,
      // El rango honesto: no se puede adivinar cuánto HTML escribe el modelo.
      output_tokens_min: estimado.rango.output_tokens_min,
      output_tokens_max: estimado.rango.output_tokens_max,
      costo_usd_min: estimado.rango.costo_usd_min,
      costo_usd_max: estimado.rango.costo_usd_max,
      costo_min_formateado: formatearCosto(estimado.rango.costo_usd_min),
      costo_max_formateado: formatearCosto(estimado.rango.costo_usd_max),
      tipo_cambio: tipoCambio,
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
