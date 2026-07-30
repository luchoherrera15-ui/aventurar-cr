import { NextResponse } from "next/server";
import { otorgarPuntosPorCita } from "@/lib/lealtad/citas";

/**
 * "Esta cita quedó cumplida — otorgá los puntos de lealtad" — lo llama
 * la app móvil después de marcar la asistencia (el update lo hace ella
 * misma con la sesión del dueño; la RLS ya lo permite). Mismo diseño
 * que /api/citas/[id]/confirmacion:
 *
 *  - El cuerpo del pedido no se lee nunca: el helper verifica en la
 *    base que la cita esté realmente 'cumplida' (solo el dueño puede
 *    ponerla así) antes de otorgar nada.
 *  - Idempotente: la referencia `cita:{id}` hace que martillar este
 *    endpoint jamás otorgue puntos dos veces.
 *  - Siempre responde 200 con {ok} para no servir de oráculo.
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  await otorgarPuntosPorCita(id);

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
}
