import Anthropic from "@anthropic-ai/sdk";
import { adminDeLaPeticion } from "@/lib/auth";
import { modeloDe, motivoParaNoGastar } from "@/lib/ia/config-ia";
import { registrarDesdeUsage, registrarFalloIA } from "@/lib/ia/registrar-uso";
import { MODELOS, type AgenteIA, type ModeloIA } from "@/lib/ia/modelos";

/**
 * POST /api/invitaciones/chat
 *
 * El chat libre del asistente de invitaciones: el cliente se expresa
 * en sus palabras y el "diseñador" conversa, sugiere y, cuando el
 * cliente confirma, emite el brief final entre <prompt_final> (y un
 * <titulo>) que el front usa para estimar costo y generar.
 *
 * Requiere sesión (cada mensaje gasta tokens reales).
 *
 * Son DOS agentes con modelos distintos: conversar es la llamada que
 * más se repite y va en el modelo barato; el brief de cierre se corre
 * una sola vez por invitación y decide cómo sale la invitación entera,
 * así que va en el mejor. Ahí está casi todo el ahorro del chat.
 *
 * Body: {
 *   mensajes: [{ rol: "usuario" | "asistente", texto: string }],
 *   imagenes_count?: number,
 *   videos_count?: number,
 *   audios_count?: number,
 *   forzar_brief?: boolean   // el botón "Generar": exige el brief YA
 * }
 * Response: { success, respuesta, prompt_final?, titulo?, costo_usd,
 *             costo_crc, tipo_cambio, modelo, input_tokens, output_tokens }
 */

export const maxDuration = 60;

const SYSTEM_CHAT = `Sos el diseñador de invitaciones digitales de Bookea (Costa Rica).
Conversás con el cliente para entender EXACTAMENTE la invitación que
quiere y ayudarlo a imaginarla mejor.

CÓMO CONVERSÁS:
- Español de Costa Rica (voseo), cálido y directo. Respuestas cortas:
  2-4 oraciones, y cuando ayude, una pregunta concreta o 2-3
  sugerencias de diseño para elegir.
- Sos proactivo: proponé temática, paleta de colores, tipografías,
  animaciones CSS (pétalos, brillos, cuenta regresiva, parallax...),
  efectos y secciones según lo que el cliente cuente. Tipo: "¿te
  gustaría que caigan pétalos al hacer scroll?".
- No inventés datos del evento: si faltan, preguntá lo esencial
  (ocasión, nombres, fecha y lugar si quiere incluirlos).
- Si te aviso que el cliente adjuntó fotos o videos, incorporalos al
  diseño (portada, galería, marcos) y mencionalo.
- Nada de marcas registradas: para personajes con copyright ofrecé
  "inspirado en" con elementos genéricos (colores, ambiente).
- La invitación final es HTML full-screen animado SIN <script> (solo
  CSS y atributos inline) y SIN botón de confirmar asistencia (la
  plataforma agrega su propio RSVP). No expliqués estos tecnicismos
  salvo que pregunten.

CUANDO EL CLIENTE CONFIRME QUE ESTÁ LISTO (o pida generarla ya):
Cerrá con una frase corta y DESPUÉS agregá exactamente estos bloques:
<titulo>título corto del evento (máx 8 palabras)</titulo>
<prompt_final>
Un brief completo y detallado para el generador HTML: ocasión y datos
del evento, estilo visual y paleta, tipografías, secciones en orden,
animaciones CSS y efectos, ambiente general, y las URLs o menciones de
las fotos si las hay. Terminá el brief con estas reglas literales:
- HTML + CSS completamente embebido, sin <script>: animaciones con CSS
  e interactividad con atributos inline
- Responsive, elegante, a pantalla completa
- Sin botón de confirmar asistencia (la plataforma agrega el suyo)
- Retorna SOLO el HTML válido, sin explicaciones ni markdown
</prompt_final>

NUNCA uses esos bloques antes de que el cliente confirme.`;

interface MensajeChat {
  rol: "usuario" | "asistente";
  texto: string;
}

export async function POST(request: Request) {
  try {
    // El sitio autentica por cookies; la app móvil manda su token en
    // el header. Se prueba el token primero porque una petición del
    // app nunca trae cookies y no tiene sentido ir a buscarlas.
    // El id del usuario se guarda: cada llamada queda a nombre de quien
    // la gastó, que es lo que después mira el panel de consumo.
    // SOLO ADMIN. Antes bastaba con estar logueado, así que cualquiera
    // que se creara una cuenta podía conversar con Opus a costa de la
    // plataforma. Las invitaciones las genera el equipo desde el panel.
    const { ok: esAdmin, usuarioId } = await adminDeLaPeticion(request);
    if (!esAdmin) {
      return Response.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json(
        { success: false, error: "ANTHROPIC_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const mensajes = (body.mensajes ?? []) as MensajeChat[];
    const imagenesCount = Number(body.imagenes_count) || 0;
    const videosCount = Number(body.videos_count) || 0;
    const audiosCount = Number(body.audios_count) || 0;
    const forzarBrief = body.forzar_brief === true;

    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      return Response.json(
        { success: false, error: "mensajes requeridos" },
        { status: 400 }
      );
    }
    if (mensajes.length > 60) {
      return Response.json(
        { success: false, error: "La conversación es demasiado larga; generá la invitación o empezá de nuevo" },
        { status: 400 }
      );
    }
    const total = mensajes.reduce((n, m) => n + (m.texto?.length ?? 0), 0);
    if (total > 40000) {
      return Response.json(
        { success: false, error: "La conversación es demasiado larga" },
        { status: 400 }
      );
    }

    // Dos agentes distintos con dos modelos distintos. Si la
    // configuración no se puede leer se sigue con estos, que son los
    // mismos que trae el panel por defecto: nunca se cae el chat por
    // no poder consultar qué modelo usar.
    const agente: AgenteIA = forzarBrief ? "invitacion_brief" : "invitacion_chat";
    let modelo: ModeloIA = forzarBrief ? "claude-opus-5" : "claude-haiku-4-5";
    try {
      modelo = await modeloDe(agente);
    } catch {
      // Se queda con el modelo por defecto.
    }

    // El freno de gasto se consulta ANTES de quemar tokens, y si la
    // consulta falla se corta igual. El criterio es a propósito el
    // contrario al del modelo: elegir modelo por defecto no gasta nada
    // de más, pero dejar pasar el freno cuando no se pudo leer volvería
    // opcionales el interruptor general y el tope del mes — una base
    // caída alcanzaría para evadirlos y seguir facturando. leerConfigIA
    // ya absorbe los casos esperables (sin service key, sin migración)
    // devolviendo los valores por defecto, así que un throw acá es un
    // problema real y merece frenar.
    let motivo: string | null = null;
    try {
      motivo = await motivoParaNoGastar();
    } catch (e) {
      console.error("[invitaciones/chat] No se pudo consultar el freno de gasto:", e);
      motivo =
        "No pudimos verificar el estado del asistente; probá de nuevo en un momento.";
    }
    if (motivo) {
      return Response.json({ success: false, error: motivo }, { status: 503 });
    }

    // El historial va tal cual; el aviso de media se antepone al último
    // mensaje del usuario para que el diseñador lo tenga presente.
    const historial = mensajes.map((m, i) => {
      let texto = String(m.texto ?? "");
      if (
        i === mensajes.length - 1 &&
        m.rol === "usuario" &&
        (imagenesCount > 0 || videosCount > 0 || audiosCount > 0)
      ) {
        texto =
          `[El cliente tiene adjuntas ${imagenesCount} foto(s), ${videosCount} video(s) y ` +
          `${audiosCount} pista(s) de música para la invitación]\n${texto}`;
      }
      return {
        role: m.rol === "usuario" ? ("user" as const) : ("assistant" as const),
        content: texto,
      };
    });

    // Cuánto margen darle a la respuesta depende del modelo: los que
    // razonan por su cuenta (Opus, Sonnet, Fable) meten ese
    // razonamiento dentro de este mismo tope y con márgenes chicos el
    // brief salía cortado a la mitad. Haiku no razona por defecto, así
    // que el tope entero es para el texto y alcanza con mucho menos.
    const razona = MODELOS[modelo].razonaPorDefecto;
    const topeDeseado = razona
      ? forzarBrief
        ? 12000
        : 8000
      : forzarBrief
        ? 6000
        : 3000;
    const maxTokens = Math.min(topeDeseado, MODELOS[modelo].salidaMaxima);

    const client = new Anthropic({ apiKey });
    const arranque = Date.now();
    const response = await client.messages.create({
      model: modelo,
      max_tokens: maxTokens,
      system: forzarBrief
        ? SYSTEM_CHAT +
          `\n\nEL CLIENTE YA CONFIRMÓ CON EL BOTÓN DE GENERAR: respondé
ÚNICAMENTE con los bloques <titulo> y <prompt_final> completos,
basados en TODA la conversación. Sin saludos ni texto extra.`
        : SYSTEM_CHAT,
      messages: historial,
    });
    const tiempoMs = Date.now() - arranque;

    // El SDK reporta los tokens de caché como number | null; el
    // registro los quiere en números, así que se normalizan una vez.
    const uso = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    };

    // Estos tokens ya se facturaron aunque el cliente no reciba nada
    // útil, así que los caminos de error también dejan constancia.
    const registrarFallo = (error: string) =>
      registrarFalloIA({
        agente,
        modelo,
        tokensInput: uso.input_tokens,
        tokensOutput: uso.output_tokens,
        tokensCacheWrite: uso.cache_creation_input_tokens,
        tokensCacheRead: uso.cache_read_input_tokens,
        tiempoMs,
        error,
        usuarioId,
      });

    // stop_reason se mira ANTES de tocar content, igual que en
    // refiner-prompt.ts y leer-agenda.ts. El brief corre en un modelo
    // que razona por defecto, y ese razonamiento comparte el tope de
    // max_tokens con el texto: si se corta mientras piensa, content
    // trae solo el bloque de pensamiento y ningún texto. Mirando el
    // texto primero, ese caso se reportaba como "respuesta vacía" —
    // mensaje inútil para el cliente y diagnóstico falso en uso_ia,
    // justo lo que el panel viene a mostrar.

    // Respuesta truncada: mandar un brief cortado produciría una
    // invitación a medias que igual se cobra.
    if (response.stop_reason === "max_tokens") {
      const gasto = await registrarFallo("La respuesta se cortó por max_tokens");
      return Response.json(
        {
          success: false,
          error:
            "La respuesta quedó incompleta. Pedile el resumen de nuevo o contale la idea en menos palabras.",
          costo_usd: gasto.costoUSD,
          costo_crc: gasto.costoCRC,
          tipo_cambio: gasto.tipoCambio,
          modelo,
        },
        { status: 502 }
      );
    }

    // Los clasificadores de seguridad pueden declinar: llega HTTP 200
    // con content vacío, así que también hay que atajarlo antes.
    if (response.stop_reason === "refusal") {
      const gasto = await registrarFallo("El modelo declinó responder (refusal)");
      return Response.json(
        {
          success: false,
          error:
            "El asistente no puede trabajar con esa idea. Contale la invitación con otras palabras.",
          costo_usd: gasto.costoUSD,
          costo_crc: gasto.costoCRC,
          tipo_cambio: gasto.tipoCambio,
          modelo,
        },
        { status: 502 }
      );
    }

    const bloqueTexto = response.content.find(
      (b): b is Extract<typeof b, { type: "text" }> => b.type === "text"
    );
    let respuesta = (bloqueTexto?.text ?? "").trim();
    if (!respuesta) {
      // Acá ya se descartaron las causas conocidas de un content sin
      // texto; el stop_reason va en el registro para que el panel
      // muestre la causa real y no una etiqueta genérica.
      const gasto = await registrarFallo(
        `El asistente devolvió una respuesta vacía (stop_reason: ${response.stop_reason ?? "desconocido"})`
      );
      return Response.json(
        {
          success: false,
          error: "El asistente no respondió; intentá de nuevo",
          costo_usd: gasto.costoUSD,
          costo_crc: gasto.costoCRC,
          tipo_cambio: gasto.tipoCambio,
          modelo,
        },
        { status: 502 }
      );
    }

    // Extraer los bloques finales si el diseñador ya cerró el brief.
    let prompt_final: string | null = null;
    let titulo: string | null = null;

    const matchPrompt = respuesta.match(/<prompt_final>([\s\S]*?)<\/prompt_final>/);
    if (matchPrompt) {
      prompt_final = matchPrompt[1].trim();
      respuesta = respuesta.replace(matchPrompt[0], "").trim();
    }
    const matchTitulo = respuesta.match(/<titulo>([\s\S]*?)<\/titulo>/);
    if (matchTitulo) {
      titulo = matchTitulo[1].trim();
      respuesta = respuesta.replace(matchTitulo[0], "").trim();
    }

    // Con el botón de generar, el brief no es opcional: si el modelo
    // no usó los bloques, toda su respuesta ES el brief.
    if (forzarBrief && !prompt_final && respuesta) {
      prompt_final = respuesta;
      respuesta = "";
    }

    // Un brief demasiado corto no alcanza para generar nada decente.
    if (prompt_final && prompt_final.length < 80) {
      const gasto = await registrarFallo("El brief quedó demasiado corto");
      return Response.json(
        {
          success: false,
          error:
            "El resumen quedó muy corto. Contale un poco más del evento y volvé a intentar.",
          costo_usd: gasto.costoUSD,
          costo_crc: gasto.costoCRC,
          tipo_cambio: gasto.tipoCambio,
          modelo,
        },
        { status: 502 }
      );
    }

    const gasto = await registrarDesdeUsage(uso, {
      agente,
      modelo,
      tiempoMs,
      usuarioId,
    });

    return Response.json({
      success: true,
      respuesta,
      prompt_final,
      titulo,
      // costo_usd se mantiene por el front viejo; costo_crc y
      // tipo_cambio son lo que se muestra en pantalla.
      costo_usd: gasto.costoUSD,
      costo_crc: gasto.costoCRC,
      tipo_cambio: gasto.tipoCambio,
      modelo,
      input_tokens: uso.input_tokens,
      output_tokens: uso.output_tokens,
      error: null,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en invitaciones/chat:", errorMsg);
    return Response.json(
      { success: false, error: "El asistente tuvo un problema; intentá de nuevo" },
      { status: 500 }
    );
  }
}
