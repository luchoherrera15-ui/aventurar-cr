import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { calcularCostoUSD } from "@/lib/ia/token-counter";

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
 * Body: {
 *   mensajes: [{ rol: "usuario" | "asistente", texto: string }],
 *   imagenes_count?: number,
 *   videos_count?: number,
 *   forzar_brief?: boolean   // el botón "Generar": exige el brief YA
 * }
 * Response: { success, respuesta, prompt_final?, titulo?, costo_usd,
 *             input_tokens, output_tokens }
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

    // El historial va tal cual; el aviso de media se antepone al último
    // mensaje del usuario para que el diseñador lo tenga presente.
    const historial = mensajes.map((m, i) => {
      let texto = String(m.texto ?? "");
      if (
        i === mensajes.length - 1 &&
        m.rol === "usuario" &&
        (imagenesCount > 0 || videosCount > 0)
      ) {
        texto = `[El cliente tiene adjuntas ${imagenesCount} foto(s) y ${videosCount} video(s) para la invitación]\n${texto}`;
      }
      return {
        role: m.rol === "usuario" ? ("user" as const) : ("assistant" as const),
        content: texto,
      };
    });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: forzarBrief ? 2500 : 1500,
      system: forzarBrief
        ? SYSTEM_CHAT +
          `\n\nEL CLIENTE YA CONFIRMÓ CON EL BOTÓN DE GENERAR: respondé
ÚNICAMENTE con los bloques <titulo> y <prompt_final> completos,
basados en TODA la conversación. Sin saludos ni texto extra.`
        : SYSTEM_CHAT,
      messages: historial,
    });

    const bloqueTexto = response.content.find(
      (b): b is Extract<typeof b, { type: "text" }> => b.type === "text"
    );
    let respuesta = (bloqueTexto?.text ?? "").trim();
    if (!respuesta) {
      return Response.json(
        { success: false, error: "El asistente no respondió; intentá de nuevo" },
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

    const costo_usd = calcularCostoUSD(
      response.usage.input_tokens,
      response.usage.output_tokens,
      "opus"
    );

    return Response.json({
      success: true,
      respuesta,
      prompt_final,
      titulo,
      costo_usd,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
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
