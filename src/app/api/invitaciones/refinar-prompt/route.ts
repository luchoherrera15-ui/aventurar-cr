import { modeloDe, motivoParaNoGastar } from "@/lib/ia/config-ia";
import type { ModeloIA } from "@/lib/ia/modelos";
import { ErrorRefinarIA, refinarPromptConIA } from "@/lib/ia/refiner-prompt";
import { registrarDesdeUsage, registrarFalloIA } from "@/lib/ia/registrar-uso";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tope por usuario contra el denial-of-wallet: exigir sesión frena al
 * anónimo, pero cualquier cuenta registrada podía martillar el endpoint
 * y quemar el presupuesto de Anthropic sin límite. Cada llamada refina
 * con Haiku (barato), pero sin techo el volumen igual factura.
 *
 * Se cuenta con `media_rate_limit_tomar` (0113), el mismo contador de
 * ventana fija que ya usa `/ayuda`: genérico pese al nombre, y por
 * `service_role`. Ventana de una hora; el freno global de gasto
 * (`motivoParaNoGastar`) sigue siendo la última red para el total del
 * mes.
 */
const LIMITE_REFINAR = { limite: 20, ventanaSegundos: 3600 } as const;

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

    // Tope por usuario ANTES de gastar un token, y a prueba de fallos:
    // si el contador no puede correr —sin service key o error de la
    // base— se cierra la puerta, nunca se deja pasar. Un contador roto
    // no puede volver opcional el freno de gasto (mismo criterio que el
    // rate limit de `/ayuda` y el de `motivoParaNoGastar` de abajo).
    const admin = createAdminClient();
    let permitido = false;
    if (admin) {
      const { data, error } = await admin.rpc("media_rate_limit_tomar", {
        p_clave: `ia-refinar:${user.id}`,
        p_limite: LIMITE_REFINAR.limite,
        p_ventana_segundos: LIMITE_REFINAR.ventanaSegundos,
      });
      if (error) {
        console.error(
          "[refinar-prompt] El contador de uso falló, se cierra la puerta:",
          error.message
        );
      } else {
        const fila = Array.isArray(data) ? data[0] : data;
        permitido = (fila as { permitido?: boolean } | null)?.permitido === true;
      }
    } else {
      console.error(
        "[refinar-prompt] Sin service key: no se puede contar el uso, se cierra la puerta."
      );
    }
    if (!permitido) {
      return Response.json(
        {
          success: false,
          error:
            "Estás pidiendo variantes muy seguido. Esperá unos minutos y volvé a intentar.",
        },
        { status: 429 }
      );
    }

    // El modelo va en su propio try: si no se puede leer la configuración
    // se refina con el barato de siempre, que es lo mismo que hacía antes.
    let modelo: ModeloIA = "claude-haiku-4-5";
    try {
      modelo = await modeloDe("invitacion_refinar");
    } catch (e) {
      console.error("[refinar-prompt] No se pudo leer el modelo configurado:", e);
    }

    // El freno de gasto se consulta ANTES de quemar tokens, y en su propio
    // try: si la consulta falla se corta igual. El criterio es a propósito
    // el contrario al del modelo — elegir modelo por defecto no gasta de
    // más, pero dejar pasar el freno cuando no se pudo leer volvería
    // opcionales el interruptor general y el tope del mes: una base caída
    // alcanzaría para evadirlos y seguir facturando. leerConfigIA ya
    // absorbe los casos esperables (sin service key, sin migración)
    // devolviendo los valores por defecto, así que un throw acá es un
    // problema real y merece frenar.
    let motivo: string | null = null;
    try {
      motivo = await motivoParaNoGastar();
    } catch (e) {
      console.error("[refinar-prompt] No se pudo consultar el freno de gasto:", e);
      motivo =
        "No pudimos verificar el estado del asistente; probá de nuevo en un momento.";
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
