import { NextResponse } from "next/server";
import { notificarReservaAprobada } from "@/lib/notificaciones-reserva";

/**
 * "Avisale al cliente que le aprobé la reserva" — lo llama el panel del
 * proveedor en la app móvil, que confirma escribiendo directo contra
 * Supabase y por lo tanto no puede mandar el correo por su cuenta (la
 * API key de Resend es un secreto de servidor).
 *
 * Mismas defensas que /api/reservas/[id]/confirmacion:
 *  - El cuerpo del pedido no se lee nunca. El destinatario sale sólo de
 *    reservas.correo, así que esto no sirve para escribirle a nadie más.
 *  - El helper exige que la reserva ya esté 'confirmada' y solo avisa
 *    una vez, así que pegarle mil veces no manda ni un correo de más.
 *
 * Siempre 200 con {ok} para no servir de oráculo sobre qué reservas
 * existen.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// El pedido no se lee a propósito — ver el comentario de arriba.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const resultado = await notificarReservaAprobada(id);

  return NextResponse.json(
    { ok: resultado.notificada },
    { status: 200, headers: CORS },
  );
}
