import { NextResponse } from "next/server";
import { notificarCitaConfirmada } from "@/lib/notificaciones-cita";

/**
 * "Mandá los avisos de esta cita" — lo llama la app móvil apenas el
 * RPC crear_cita le devuelve el id. Mismo diseño que
 * /api/reservas/[id]/confirmacion:
 *
 *  - El cuerpo del pedido no se lee nunca: los destinatarios salen de
 *    la cita y del perfil del dueño, nada más.
 *  - El helper avisa una sola vez por cita (bandera reclamada dentro
 *    del UPDATE) y solo si es reciente. Martillar este endpoint no
 *    manda ni un correo de más.
 *  - Siempre responde 200 con {ok} para no servir de oráculo.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  await notificarCitaConfirmada(id, { maxAntiguedadMinutos: VENTANA_MINUTOS });

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
}
