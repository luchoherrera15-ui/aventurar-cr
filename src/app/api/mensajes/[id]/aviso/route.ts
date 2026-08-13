import { NextResponse, after } from "next/server";
import { notificarMensajeNuevo } from "@/lib/notificaciones-mensaje";
import { responderConAsistente } from "@/lib/asistente-ia";

/**
 * "Avisale al otro participante de este mensaje" — lo llaman la app
 * móvil y el chat flotante de la web después de insertar un mensaje
 * directo en Supabase (ninguno de los dos pasa por una acción de
 * servidor que pueda avisar sola). Mismo diseño que
 * /api/reservas/[id]/confirmacion:
 *
 *  - El cuerpo del pedido no se lee nunca: el destinatario sale
 *    únicamente de la conversación del mensaje, así que no hay
 *    ninguna entrada por donde decidir a quién se le avisa.
 *  - El helper solo avisa una vez por mensaje (bandera push_enviado
 *    reclamada dentro del UPDATE) y solo si el mensaje es reciente.
 *    Martillar este endpoint no manda ni un aviso de más — el correo
 *    va después de esa misma bandera, así que tampoco se duplica.
 *  - Siempre responde 200 con {ok} para no servir de oráculo.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El teléfono puede irse a segundo plano entre el insert y este aviso.
const VENTANA_MINUTOS = 120;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  // El aviso (push + correo) y el asistente de IA corren juntos: los
  // mensajes que nacen en la app móvil o en el chat flotante también
  // deben recibir respuesta automática (el asistente valida solo el
  // autor y los negocios activos, y nunca lanza — ver
  // src/lib/asistente-ia.ts).
  //
  // Todo eso va en after(), después de responder: quien pega acá lo
  // hace sin esperar (void fetch) mientras se le abre el chat, y el
  // correo puede tardar. La fila del mensaje ya está guardada — es la
  // fuente de verdad —, así que si algo de esto falla la consulta
  // sigue estando en el chat igual.
  after(async () => {
    await Promise.all([
      notificarMensajeNuevo(id, { maxAntiguedadMinutos: VENTANA_MINUTOS }),
      responderConAsistente(id),
    ]);
  });

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
}
