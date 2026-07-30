import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generarInvitacionHTML } from "@/lib/ia/generador-invitaciones";
import { calcularCostoUSD } from "@/lib/ia/token-counter";

// La generación tarda minutos (Opus/Fable con thinking): sin esto,
// Vercel mata la función con el techo por defecto y la invitación
// queda en "generando" para siempre.
export const maxDuration = 300;

/**
 * Sube los data URLs (base64) del cliente al bucket público y devuelve
 * URLs; los que ya son http(s) pasan tal cual. Así el prompt lleva
 * URLs livianas y la fila no guarda megas de base64.
 */
async function subirMediaAStorage(
  supabase: SupabaseClient,
  invitacionId: string,
  dataUrls: string[],
  prefijo: "img" | "vid"
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const item = dataUrls[i];
    if (!item.startsWith("data:")) {
      urls.push(item);
      continue;
    }
    const match = item.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) continue;
    const [, mime, base64] = match;
    const ext = (mime.split("/")[1] || "bin").split("+")[0];
    const path = `invitaciones/${invitacionId}/${prefijo}-${i}.${ext}`;
    const { error } = await supabase.storage
      .from("ranchos-fotos")
      .upload(path, Buffer.from(base64, "base64"), {
        contentType: mime,
        upsert: true,
      });
    if (error) {
      console.error("Error subiendo media de invitación:", error.message);
      continue;
    }
    const { data } = supabase.storage.from("ranchos-fotos").getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  return urls;
}

/**
 * POST /api/invitaciones/generar-con-ia
 *
 * Genera una invitación HTML usando Claude y la guarda en la base.
 * REQUIERE: Authorization header con token de usuario autenticado.
 *
 * Body:
 * {
 *   "invitacion_id": "uuid",
 *   "prompt": "string",
 *   "modelo": "opus" | "fable",
 *   "config_ia": { ... },
 *   "imagenes_urls": [ ... ],
 *   "videos_urls": [ ... ]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "invitacion_id": "uuid",
 *   "html": "string",
 *   "input_tokens": number,
 *   "output_tokens": number,
 *   "costo_usd": number,
 *   "tiempo_ms": number,
 *   "error": null
 * }
 */

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { success: false, error: "Se requiere token de autenticación" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const body = await request.json();
    const {
      invitacion_id,
      prompt,
      modelo = "opus",
      config_ia,
      imagenes_urls,
      videos_urls,
    } = body;

    if (!invitacion_id || !prompt) {
      return Response.json(
        {
          success: false,
          error: "invitacion_id y prompt requeridos",
        },
        { status: 400 }
      );
    }

    if (!["opus", "fable"].includes(modelo)) {
      return Response.json(
        { success: false, error: "modelo debe ser 'opus' o 'fable'" },
        { status: 400 }
      );
    }

    // Verificar que el usuario tenga acceso a esta invitación
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: invitacion, error: errorQuery } = await supabase
      .from("invitaciones")
      .select("id, cliente_id, estado_generacion")
      .eq("id", invitacion_id)
      .single();

    if (errorQuery || !invitacion) {
      return Response.json(
        { success: false, error: "Invitación no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que sea el dueño (comparar cliente_id con el token)
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user || user.id !== invitacion.cliente_id) {
      return Response.json(
        { success: false, error: "No tienes acceso a esta invitación" },
        { status: 403 }
      );
    }

    // Guard de concurrencia: dos POST para la misma invitación serían
    // dos generaciones pagadas donde la última pisa a la primera.
    if (invitacion.estado_generacion === "generando") {
      return Response.json(
        {
          success: false,
          error: "Ya hay una generación en curso para esta invitación.",
        },
        { status: 409 }
      );
    }

    // Marcar como "generando"
    await supabase
      .from("invitaciones")
      .update({ estado_generacion: "generando" })
      .eq("id", invitacion_id);

    try {
      // Subir la media a Storage (los data URLs base64 se convierten
      // en URLs públicas) e incluirla en el prompt — si no, Claude
      // nunca ve las fotos del cliente.
      const imagenesFinales = await subirMediaAStorage(
        supabase,
        invitacion_id,
        (imagenes_urls ?? []) as string[],
        "img"
      );
      const videosFinales = await subirMediaAStorage(
        supabase,
        invitacion_id,
        (videos_urls ?? []) as string[],
        "vid"
      );

      let promptFinal = prompt as string;
      if (imagenesFinales.length > 0) {
        promptFinal += `\n\nFOTOS DEL CLIENTE (incluilas en la invitación con <img src="...">):\n${imagenesFinales.join("\n")}`;
      }
      if (videosFinales.length > 0) {
        promptFinal += `\n\nVIDEOS DEL CLIENTE (incluilos con <video src="..." autoplay muted loop playsinline>):\n${videosFinales.join("\n")}`;
      }

      // Generar el HTML
      const resultado = await generarInvitacionHTML({
        prompt: promptFinal,
        modelo: modelo as "opus" | "fable",
      });

      // Costo real basado en el usage que devolvió la generación
      const costo_usd = calcularCostoUSD(
        resultado.input_tokens,
        resultado.output_tokens,
        modelo as "opus" | "fable"
      );

      // Guardar en base (incluido el título que trajo el brief, para
      // que la página pública y el historial no digan "Nueva invitación")
      const tituloBrief =
        config_ia && typeof config_ia.titulo === "string" && config_ia.titulo.trim()
          ? String(config_ia.titulo).trim().slice(0, 200)
          : null;

      const { error: updateError } = await supabase
        .from("invitaciones")
        .update({
          ...(tituloBrief ? { titulo: tituloBrief } : {}),
          html_personalizado: resultado.html,
          prompt_generado: promptFinal,
          costo_tokens_input: resultado.input_tokens,
          costo_tokens_output: resultado.output_tokens,
          costo_usd,
          modelo_usado: modelo,
          config_ia: config_ia || null,
          imagenes_urls: imagenesFinales,
          videos_urls: videosFinales,
          estado_generacion: "completado",
          error_generacion: null,
          tiempo_generacion_ms: resultado.tiempo_ms,
        })
        .eq("id", invitacion_id);

      if (updateError) {
        throw new Error(`Error guardando invitación: ${updateError.message}`);
      }

      return Response.json({
        success: true,
        invitacion_id,
        html: resultado.html,
        input_tokens: resultado.input_tokens,
        output_tokens: resultado.output_tokens,
        costo_usd,
        costo_formateado: `$${costo_usd.toFixed(4)}`,
        tiempo_ms: resultado.tiempo_ms,
        error: null,
      });
    } catch (generationError) {
      // Marcar como error
      const errorMsg =
        generationError instanceof Error
          ? generationError.message
          : "Error desconocido";
      await supabase
        .from("invitaciones")
        .update({
          estado_generacion: "error",
          error_generacion: errorMsg,
        })
        .eq("id", invitacion_id);

      throw generationError;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en generar-con-ia:", errorMsg);
    return Response.json(
      {
        success: false,
        error: errorMsg || "Error al generar invitación",
        error_detail: errorMsg,
      },
      { status: 500 }
    );
  }
}
