import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { modeloDe, motivoParaNoGastar } from "@/lib/ia/config-ia";
import {
  ErrorGeneracionIA,
  generarInvitacionHTML,
} from "@/lib/ia/generador-invitaciones";
import {
  calcularCosto,
  normalizarModelo,
  preciosVigentes,
  type ModeloIA,
} from "@/lib/ia/modelos";
import { registrarDesdeUsage, registrarFalloIA } from "@/lib/ia/registrar-uso";

// La generación tarda minutos (Opus/Fable con thinking): sin esto,
// Vercel mata la función con el techo por defecto y la invitación
// queda en "generando" para siempre.
export const maxDuration = 300;

/**
 * Cuánto puede durar una generación "en curso" antes de darla por muerta.
 * La ruta tiene maxDuration = 300s; con unos minutos de margen por encima,
 * una fila que sigue en "generando" ya no tiene ningún proceso vivo detrás
 * (timeout de Vercel, redeploy a mitad, OOM) y hay que dejar reintentar.
 */
const GENERACION_VENCIDA_MS = 8 * 60 * 1000;

/**
 * Columna donde se anota cuándo arrancó la generación en curso. Se lee y se
 * escribe aparte del resto porque la tabla `invitaciones` no la tenía (solo
 * tiene created_at, que es el nacimiento de la fila y no sirve para medir la
 * antigüedad de una generación): mientras la migración no corra, el código
 * degrada al comportamiento anterior en vez de romper la ruta.
 */
const COLUMNA_INICIO = "generacion_iniciada_en";

/**
 * El modelo configurado en /admin/ia es el TECHO de gasto: el panel gobierna
 * la plata, el cliente puede elegir uno más barato pero nunca uno más caro.
 * Sin esto el selector del bot (que siempre manda "opus" o "fable") ignora
 * por completo la configuración del admin, y cualquier cliente autenticado
 * puede forzar el modelo más caro del catálogo.
 *
 * La comparación es por precio real y vigente (promos incluidas), no por el
 * orden de LISTA_MODELOS, que es un detalle de presentación del panel.
 * "No más caro" = no cuesta más ni en entrada ni en salida; si un modelo es
 * más barato en una dimensión y más caro en la otra, se lo trata como más
 * caro y manda el configurado.
 */
function modeloConTecho(pedido: unknown, techo: ModeloIA): ModeloIA {
  if (typeof pedido !== "string" || !pedido.trim()) return techo;

  const elegido = normalizarModelo(pedido, techo);
  if (elegido === techo) return techo;

  const ahora = new Date();
  const precioElegido = preciosVigentes(elegido, ahora);
  const precioTecho = preciosVigentes(techo, ahora);
  const noEsMasCaro =
    precioElegido.entradaUSD <= precioTecho.entradaUSD &&
    precioElegido.salidaUSD <= precioTecho.salidaUSD;

  return noEsMasCaro ? elegido : techo;
}

/**
 * true si la generación marcada como "en curso" es tan vieja que ya no puede
 * haber un proceso vivo detrás. Se consulta la columna en una query aparte
 * —y solo en este caso, que es raro— porque pedir una columna inexistente
 * haría fallar la lectura completa de la invitación y todo cliente vería un
 * 404. Si no se puede saber la antigüedad, se mantiene el bloqueo.
 */
async function generacionVencida(
  supabase: SupabaseClient,
  invitacionId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("invitaciones")
    .select(COLUMNA_INICIO)
    .eq("id", invitacionId)
    .single();

  // Sin la columna (migración pendiente) PostgREST devuelve error: se
  // conserva el comportamiento anterior, que es bloquear.
  if (error || !data) return false;

  const inicio = (data as Record<string, unknown>)[COLUMNA_INICIO];
  // La columna existe pero está vacía: es una fila trabada de antes de este
  // arreglo, así que no hay nada vivo que proteger.
  if (inicio === null || inicio === undefined) return true;
  if (typeof inicio !== "string") return false;

  const desde = Date.parse(inicio);
  if (!Number.isFinite(desde)) return false;
  return Date.now() - desde > GENERACION_VENCIDA_MS;
}

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
 *   "modelo": "opus" | "fable" | id de modelo (opcional: el modelo del
 *              panel /admin/ia es el techo de gasto — si el cliente pide
 *              uno más caro se ignora y corre el configurado),
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
      modelo: modeloPedido,
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

    // Guard de concurrencia: dos POST para la misma invitación serían dos
    // generaciones pagadas donde la última pisa a la primera. Pero el
    // proceso puede morir sin pasar ni por el try (completado) ni por su
    // catch (error) —timeout de Vercel, redeploy a mitad, OOM— y ahí la fila
    // se quedaría en "generando" para siempre, devolviendo 409 eternamente y
    // sin forma de salir desde el producto. Pasado el margen se la da por
    // muerta y se deja reintentar.
    if (invitacion.estado_generacion === "generando") {
      if (!(await generacionVencida(supabase, invitacion_id))) {
        return Response.json(
          {
            success: false,
            error: "Ya hay una generación en curso para esta invitación.",
          },
          { status: 409 }
        );
      }
      console.warn(
        `[generar-con-ia] Generación vencida en ${invitacion_id}: se permite reintentar.`
      );
    }

    // Interruptor general y tope del mes ANTES que nada, y en su propio try:
    // si la configuración no se puede leer, no se genera. Un error leyendo la
    // configuración no puede ser la forma de evadir la IA apagada ni el tope
    // de gasto (antes compartía try con el modelo y se generaba igual).
    let motivo: string | null = null;
    try {
      motivo = await motivoParaNoGastar();
    } catch (e) {
      console.error("[generar-con-ia] No se pudo verificar el freno de gasto:", e);
      motivo =
        "No pudimos verificar la configuración de IA en este momento. Probá de nuevo en unos minutos.";
    }

    // Freno de gasto: se corta antes de subir media y de llamar al modelo,
    // y sin dejar la invitación marcada como "generando".
    if (motivo) {
      return Response.json({ success: false, error: motivo }, { status: 503 });
    }

    // El modelo del panel es el techo; el cliente puede pedir uno más barato.
    // Si la configuración no se puede leer, el techo es Opus (el mismo valor
    // por defecto que usa config-ia para este agente).
    let modelo: ModeloIA = "claude-opus-5";
    try {
      modelo = modeloConTecho(modeloPedido, await modeloDe("invitacion_generar"));
    } catch (e) {
      console.error("[generar-con-ia] No se pudo leer el modelo configurado:", e);
      modelo = modeloConTecho(modeloPedido, modelo);
    }

    // Marcar como "generando" y anotar cuándo arrancó: esa marca de tiempo es
    // lo único que después le permite al guard soltar una generación muerta.
    const marcado = await supabase
      .from("invitaciones")
      .update({
        estado_generacion: "generando",
        [COLUMNA_INICIO]: new Date().toISOString(),
      })
      .eq("id", invitacion_id);

    if (marcado.error) {
      // La columna todavía no existe (migración pendiente) y el update falla
      // entero: se marca sin ella para no dejar la invitación sin guard.
      console.error(
        "[generar-con-ia] No se pudo anotar el inicio de la generación:",
        marcado.error.message
      );
      await supabase
        .from("invitaciones")
        .update({ estado_generacion: "generando" })
        .eq("id", invitacion_id);
    }

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
        modelo,
      });

      // Costo real del modelo que efectivamente corrió. El registro en
      // uso_ia devuelve el mismo número; si ese registro fallara, el
      // cálculo local igual deja el costo bien guardado en la invitación.
      let costo_usd = calcularCosto(
        modelo,
        resultado.input_tokens,
        resultado.output_tokens
      );
      try {
        const registro = await registrarDesdeUsage(resultado.usage, {
          agente: "invitacion_generar",
          modelo,
          tiempoMs: resultado.tiempo_ms,
          usuarioId: user.id,
          referenciaId: invitacion_id,
        });
        costo_usd = registro.costoUSD;
      } catch (e) {
        console.error("[generar-con-ia] No se pudo registrar el consumo:", e);
      }

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

      // Si el modelo alcanzó a gastar tokens antes de fallar (respuesta
      // cortada, rechazo, HTML vacío), Anthropic los cobra igual: quedan
      // asentados como gasto fallido.
      if (generationError instanceof ErrorGeneracionIA) {
        await registrarFalloIA({
          agente: "invitacion_generar",
          modelo,
          tokensInput: generationError.usage?.input_tokens ?? 0,
          tokensOutput: generationError.usage?.output_tokens ?? 0,
          tokensCacheWrite:
            generationError.usage?.cache_creation_input_tokens ?? 0,
          tokensCacheRead: generationError.usage?.cache_read_input_tokens ?? 0,
          tiempoMs: generationError.tiempoMs,
          error: errorMsg,
          usuarioId: user.id,
          referenciaId: invitacion_id,
        });
      }

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
