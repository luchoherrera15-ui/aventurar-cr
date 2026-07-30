import { NextResponse } from "next/server";
import { notificarMensajeNuevo } from "@/lib/notificaciones-mensaje";

/**
 * "Avisale al otro participante de este mensaje" — lo llama la app
 * móvil después de insertar un mensaje en Supabase (no tiene servidor
 * propio para mandar el push). Mismo diseño que
 * /api/reservas/[id]/confirmacion:
 *
 *  - El cuerpo del pedido no se lee nunca: el destinatario sale
 *    únicamente de la conversación del mensaje, así que no hay
 *    ninguna entrada por donde decidir a quién se le avisa.
 *  - El helper solo avisa una vez por mensaje (bandera push_enviado
 *    reclamada dentro del UPDATE) y solo si el mensaje es reciente.
 *    Martillar este endpoint no manda ni un aviso de más.
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

  await notificarMensajeNuevo(id, { maxAntiguedadMinutos: VENTANA_MINUTOS });

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
}
